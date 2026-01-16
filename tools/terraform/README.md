# Terraform Infrastructure

Infrastructure as Code for Forge Factory multi-region deployment.

## Structure

```
terraform/
├── modules/           # Reusable modules
│   ├── vpc/
│   ├── rds/
│   ├── pgbouncer/
│   ├── elasticache/
│   ├── ecs/
│   ├── cloudfront/
│   └── waf/
└── environments/      # Environment-specific configs
    ├── dev/
    ├── staging/
    ├── prod-us/
    ├── prod-eu/
    └── prod-apac/
```

## Usage

### Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured
- S3 bucket for state storage
- DynamoDB table for state locking

### Deploy to Production US

```bash
cd environments/prod-us

# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy (caution!)
terraform destroy
```

### Multi-Region Deployment

Deploy to all regions:

```bash
./deploy-all-regions.sh
```

## Modules

### VPC
- Multi-AZ networking
- Public, private, and database subnets
- NAT gateways
- Route tables

### RDS
- PostgreSQL 16
- Multi-AZ for HA
- Automated backups
- Performance Insights
- Encryption at rest

### PgBouncer (RDS Proxy)
- Connection pooling
- Automatic failover
- TLS encryption
- IAM authentication support

### ElastiCache
- Redis 7.0
- Multi-AZ replication
- Automatic failover
- Encryption in transit & at rest

### ECS Fargate
- Containerized applications
- Auto-scaling
- Load balancing
- Health checks

### CloudFront
- Global CDN
- SSL/TLS termination
- Origin failover
- WAF integration

### WAF
- OWASP rules
- Rate limiting
- SQL injection protection
- DDoS mitigation

## State Management

State is stored in S3 with DynamoDB locking:

```hcl
backend "s3" {
  bucket = "forge-terraform-state"
  key    = "prod-us/terraform.tfstate"
  region = "us-east-1"
  encrypt = true
  dynamodb_table = "forge-terraform-locks"
}
```

## Security

- All secrets stored in AWS Secrets Manager
- IAM roles for service authentication
- Encryption at rest and in transit
- Network isolation via VPC
- Security groups with least privilege

## Cost Optimization

- Right-sized instances
- Auto-scaling based on demand
- Reserved instances for predictable workloads
- S3 lifecycle policies
- CloudWatch cost monitoring

## Disaster Recovery

- Multi-AZ deployment
- Automated backups
- Cross-region replication (future)
- Tested failover procedures
- Documented runbooks
