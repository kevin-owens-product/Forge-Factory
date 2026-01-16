# Terraform Configuration for Forge Factory - US Production

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "forge-terraform-state"
    key    = "prod-us/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = "forge-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "production"
      Region      = "us-east-1"
      ManagedBy   = "terraform"
      Project     = "forge-factory"
    }
  }
}

# ============================================
# Networking
# ============================================

module "vpc" {
  source = "../../modules/vpc"

  name_prefix = "forge-prod-us"
  cidr_block  = "10.0.0.0/16"

  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24", "10.0.22.0/24"]

  enable_nat_gateway = true
  enable_dns_hostnames = true
}

# ============================================
# Database
# ============================================

module "database" {
  source = "../../modules/rds"

  identifier = "forge-prod-us"

  engine         = "postgres"
  engine_version = "16.1"
  instance_class = "db.r6g.xlarge"

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  database_name = "forge"
  port          = 5432

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.database_subnet_ids

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  multi_az = true

  performance_insights_enabled = true
  monitoring_interval          = 60

  tags = {
    Name = "forge-prod-us-db"
  }
}

# ============================================
# PgBouncer (RDS Proxy)
# ============================================

module "pgbouncer" {
  source = "../../modules/pgbouncer"

  name = "forge-prod-us-proxy"

  engine_family = "POSTGRESQL"

  vpc_id             = module.vpc.vpc_id
  vpc_subnet_ids     = module.vpc.private_subnet_ids

  db_instance_identifier = module.database.db_instance_id

  idle_client_timeout = 1800
  max_connections_percent = 100
  max_idle_connections_percent = 50

  require_tls = true

  tags = {
    Name = "forge-prod-us-pgbouncer"
  }
}

# ============================================
# Cache (ElastiCache Redis)
# ============================================

module "cache" {
  source = "../../modules/elasticache"

  cluster_id = "forge-prod-us"

  engine         = "redis"
  engine_version = "7.0"
  node_type      = "cache.r6g.large"

  num_cache_nodes = 2

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"

  automatic_failover_enabled = true
  multi_az_enabled          = true

  transit_encryption_enabled = true
  at_rest_encryption_enabled = true

  tags = {
    Name = "forge-prod-us-cache"
  }
}

# ============================================
# Application (ECS Fargate)
# ============================================

module "ecs" {
  source = "../../modules/ecs"

  cluster_name = "forge-prod-us"

  vpc_id         = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnet_ids

  services = {
    api = {
      image          = "forge/api:latest"
      cpu            = 1024
      memory         = 2048
      desired_count  = 3
      port           = 3000
      health_check_path = "/health"

      environment = {
        NODE_ENV = "production"
        DATABASE_URL = "postgresql://user:pass@${module.pgbouncer.proxy_endpoint}:5432/forge?pgbouncer=true"
        REDIS_URL = "redis://${module.cache.primary_endpoint}:6379"
      }

      auto_scaling = {
        min_capacity = 3
        max_capacity = 10
        target_cpu_utilization = 70
      }
    }
  }

  tags = {
    Name = "forge-prod-us-ecs"
  }
}

# ============================================
# CDN (CloudFront)
# ============================================

module "cdn" {
  source = "../../modules/cloudfront"

  comment = "Forge Factory US Production CDN"

  origins = {
    api = {
      domain_name = module.ecs.load_balancer_dns_name
      origin_id   = "api"
    }
  }

  default_cache_behavior = {
    target_origin_id = "api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    compress        = true
  }

  web_acl_id = module.waf.web_acl_arn

  tags = {
    Name = "forge-prod-us-cdn"
  }
}

# ============================================
# WAF
# ============================================

module "waf" {
  source = "../../modules/waf"

  name = "forge-prod-us-waf"

  scope = "CLOUDFRONT"

  rules = [
    "AWSManagedRulesCommonRuleSet",
    "AWSManagedRulesKnownBadInputsRuleSet",
    "AWSManagedRulesSQLiRuleSet",
  ]

  rate_limit = 2000

  tags = {
    Name = "forge-prod-us-waf"
  }
}

# ============================================
# Outputs
# ============================================

output "database_endpoint" {
  description = "Direct database endpoint"
  value       = module.database.db_instance_endpoint
  sensitive   = true
}

output "pgbouncer_endpoint" {
  description = "PgBouncer proxy endpoint"
  value       = module.pgbouncer.proxy_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cache endpoint"
  value       = module.cache.primary_endpoint
  sensitive   = true
}

output "cdn_domain_name" {
  description = "CloudFront distribution domain"
  value       = module.cdn.distribution_domain_name
}

output "api_url" {
  description = "API URL"
  value       = "https://${module.cdn.distribution_domain_name}"
}
