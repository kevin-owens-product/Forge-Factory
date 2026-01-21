# ADR-009: Database Connection Pooling with PgBouncer

## Status
Accepted

## Context
PostgreSQL has a limited number of connections (typically 100-200). With multiple application instances and microservices, we can quickly exhaust connections. We need a connection pooling solution.

## Decision
We will use **PgBouncer** in **transaction mode** via AWS RDS Proxy for connection pooling.

### Architecture

```
Application Instances (100 conn each)
    ↓
PgBouncer / RDS Proxy (transaction pooling)
    ↓
PostgreSQL (200 max connections)
```

### Configuration

#### Connection Strings
```bash
# Application → PgBouncer
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/forge?pgbouncer=true"

# Migrations → Direct
DATABASE_DIRECT_URL="postgresql://user:pass@rds:5432/forge"
```

#### PgBouncer Settings
```ini
[databases]
forge = host=rds port=5432 dbname=forge

[pgbouncer]
pool_mode = transaction
default_pool_size = 20
max_client_conn = 1000
max_db_connections = 200
reserve_pool_size = 5

server_idle_timeout = 600
client_idle_timeout = 300
query_timeout = 30

server_connect_timeout = 10
server_check_delay = 30
```

### Pool Sizing
- **Default pool size**: 20 connections per database
- **Max client connections**: 1000 (handles traffic spikes)
- **Max DB connections**: 200 (PostgreSQL limit minus buffer)
- **Reserve pool**: 5 connections for emergencies

### Transaction vs Session Mode

#### Transaction Mode (Chosen)
- Connection released after each transaction
- Most efficient for web applications
- **Limitation**: Cannot use prepared statements, advisory locks

#### Session Mode
- Connection held for entire session
- Needed for prepared statements
- Less efficient

**Decision**: Use transaction mode for web app, direct connection for background jobs that need session mode.

### Prisma Configuration

```typescript
// packages/prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // → PgBouncer
  directUrl = env("DATABASE_DIRECT_URL") // → PostgreSQL (migrations)
}
```

### Monitoring

Track these metrics:
- `pgbouncer_active_connections`: Current active
- `pgbouncer_waiting_connections`: Queued clients
- `pgbouncer_pool_utilization`: Percentage used

Alert thresholds:
- **Warning**: Utilization > 80% for 5 minutes
- **Critical**: Utilization > 95% for 1 minute
- **Critical**: Waiting connections > 10 for 1 minute

## Consequences

### Positive
- **Better resource utilization**: 1000 clients → 200 DB connections
- **Prevents connection exhaustion**: No more "too many connections" errors
- **Faster connection**: Connection pooling is faster than new connections
- **Handles traffic spikes**: Queue clients instead of rejecting

### Negative
- **Additional complexity**: One more component to manage
- **Transaction mode limitations**: No prepared statements, advisory locks
- **Potential latency**: Queueing when pool is full

### Mitigations
- **RDS Proxy**: Managed PgBouncer, no ops overhead
- **Direct connections for background jobs**: Use direct URL when needed
- **Monitoring**: Alert on high utilization before problems
- **Auto-scaling**: Increase pool size when utilization consistently high

## AWS RDS Proxy

For production, we use AWS RDS Proxy instead of self-hosted PgBouncer:

### Benefits
- Managed service (no maintenance)
- Automatic failover to standby
- IAM authentication support
- Built-in connection pooling

### Configuration
```terraform
resource "aws_db_proxy" "main" {
  name                   = "forge-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }

  role_arn               = aws_iam_role.db_proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids

  require_tls            = true
  idle_client_timeout    = 1800
  max_connections_percent = 100
  max_idle_connections_percent = 50
}
```

## Alternatives Considered

### 1. No Connection Pooling
**Rejected**: Would exhaust connections quickly, not scalable.

### 2. Application-Level Pooling
**Rejected**: Each app instance would still need many connections.

### 3. Separate Pool Per Microservice
**Rejected**: Doesn't scale well, complex to manage.

## Future Considerations

### Read Replicas
When read load increases:
1. Add read replica
2. Route read queries to replica
3. Pool separately for read vs write

```typescript
@UseReadReplica()
async getAnalytics() {
  // Routes to read replica automatically
}
```

### Connection Limits by Tenant
For enterprise tenants:
```typescript
interface TenantPoolConfig {
  tenantId: string;
  dedicated: boolean;
  poolSize?: number;
}
```

## References
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [AWS RDS Proxy](https://aws.amazon.com/rds/proxy/)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

## Review Date
2024-04-16 (3 months)
