# ADR-026: Transformation Project Isolation & Resource Management

## Status
Accepted

## Context

Running hundreds of concurrent transformation projects requires robust isolation to prevent interference, resource contention, and security breaches. Each project needs dedicated resources (databases, compute, storage) while optimizing for cost and operational efficiency at scale.

### Requirements

**Isolation Requirements:**
- **Security Isolation:** Projects cannot access each other's data
- **Performance Isolation:** One project cannot impact others' performance
- **Network Isolation:** Controlled communication between projects
- **Compute Isolation:** Fair CPU/memory allocation
- **Storage Isolation:** Separate databases and file storage
- **Credential Isolation:** Separate service accounts and secrets

**Resource Management Requirements:**
- Support 100-1000 projects per Forge Factory instance
- Dynamic resource allocation based on project lifecycle
- Cost optimization through resource sharing where safe
- Quota enforcement and overuse prevention
- Resource monitoring and alerting
- Automatic scaling based on demand

**Multi-Tenancy Requirements:**
- Organization-level isolation
- Shared infrastructure for cost efficiency
- Tenant-specific compliance requirements
- Cross-organization data protection
- Audit trail per organization

### Current Challenges

1. **No Resource Isolation:** Projects share resources without boundaries
2. **Noisy Neighbor Problem:** One project can impact all others
3. **Unbounded Resource Use:** No quotas or limits
4. **Manual Provisioning:** No automated resource allocation
5. **Cost Inefficiency:** Resources allocated but not used
6. **Security Risks:** Inadequate isolation between projects

## Decision

We will implement a **Multi-Layered Isolation Strategy** combining Kubernetes namespaces, database-level isolation, network policies, and resource quotas, with **Dynamic Resource Management** based on project lifecycle and usage patterns.

### Isolation Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Organization Level                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Organization A                                       │  │
│  │  ┌───────────────────┐    ┌───────────────────┐     │  │
│  │  │   Project 1       │    │   Project 2       │     │  │
│  │  │   K8s Namespace   │    │   K8s Namespace   │     │  │
│  │  │   Database        │    │   Database        │     │  │
│  │  │   Service Account │    │   Service Account │     │  │
│  │  └───────────────────┘    └───────────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Organization B                                       │  │
│  │  ┌───────────────────┐    ┌───────────────────┐     │  │
│  │  │   Project 3       │    │   Project 4       │     │  │
│  │  │   K8s Namespace   │    │   K8s Namespace   │     │  │
│  │  │   Database        │    │   Database        │     │  │
│  │  │   Service Account │    │   Service Account │     │  │
│  │  └───────────────────┘    └───────────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

Isolation Layers:
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Kubernetes Namespaces                              │
│  - Compute isolation                                        │
│  - Network policies                                         │
│  - Resource quotas                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Database Isolation                                 │
│  - Separate database per project                            │
│  - Row-level security (RLS) for shared resources            │
│  - Separate connection pools                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 3: IAM & Credentials                                  │
│  - Separate service accounts                                │
│  - Scoped API keys                                          │
│  - Isolated secrets management                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Storage Isolation                                  │
│  - Separate S3 buckets/prefixes                             │
│  - Dedicated volumes                                        │
│  - Encryption per project                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Observability Isolation                            │
│  - Separate log streams                                     │
│  - Project-specific dashboards                              │
│  - Scoped metrics namespaces                                │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Kubernetes Namespace Isolation

Each project gets a dedicated Kubernetes namespace with resource quotas and network policies.

```yaml
# apps/infrastructure/k8s/project-namespace-template.yaml

apiVersion: v1
kind: Namespace
metadata:
  name: project-{{ projectId }}
  labels:
    forge.io/project-id: {{ projectId }}
    forge.io/organization-id: {{ organizationId }}
    forge.io/lifecycle-stage: {{ lifecycleStage }}
  annotations:
    forge.io/created-at: {{ createdAt }}
    forge.io/owner: {{ ownerId }}

---
# Resource Quota
apiVersion: v1
kind: ResourceQuota
metadata:
  name: project-quota
  namespace: project-{{ projectId }}
spec:
  hard:
    # Compute
    requests.cpu: {{ quota.cpu }}
    requests.memory: {{ quota.memory }}
    limits.cpu: {{ quota.cpuLimit }}
    limits.memory: {{ quota.memoryLimit }}

    # Storage
    requests.storage: {{ quota.storage }}
    persistentvolumeclaims: {{ quota.pvcCount }}

    # Objects
    pods: {{ quota.maxPods }}
    services: {{ quota.maxServices }}
    configmaps: {{ quota.maxConfigMaps }}
    secrets: {{ quota.maxSecrets }}

---
# Limit Range (default limits for pods)
apiVersion: v1
kind: LimitRange
metadata:
  name: project-limits
  namespace: project-{{ projectId }}
spec:
  limits:
  - max:
      cpu: {{ limits.pod.maxCpu }}
      memory: {{ limits.pod.maxMemory }}
    min:
      cpu: {{ limits.pod.minCpu }}
      memory: {{ limits.pod.minMemory }}
    default:
      cpu: {{ limits.pod.defaultCpu }}
      memory: {{ limits.pod.defaultMemory }}
    defaultRequest:
      cpu: {{ limits.pod.requestCpu }}
      memory: {{ limits.pod.requestMemory }}
    type: Container

---
# Network Policy - Default Deny
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: project-{{ projectId }}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Network Policy - Allow from Ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress
  namespace: project-{{ projectId }}
spec:
  podSelector:
    matchLabels:
      forge.io/exposed: "true"
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx

---
# Network Policy - Allow to Platform Services
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-platform-services
  namespace: project-{{ projectId }}
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  # Allow to platform services
  - to:
    - namespaceSelector:
        matchLabels:
          forge.io/layer: platform
  # Allow to project database
  - to:
    - podSelector:
        matchLabels:
          forge.io/service: database
  # Allow external HTTPS (for APIs, etc.)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443

---
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: project-workload
  namespace: project-{{ projectId }}
  annotations:
    forge.io/project-id: {{ projectId }}

---
# Role - Limited permissions within namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: project-workload-role
  namespace: project-{{ projectId }}
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list"]

---
# Role Binding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: project-workload-binding
  namespace: project-{{ projectId }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: project-workload-role
subjects:
- kind: ServiceAccount
  name: project-workload
  namespace: project-{{ projectId }}
```

### Layer 2: Database Isolation

Each project gets a dedicated PostgreSQL database with separate connection pool.

```typescript
// apps/core/src/lib/services/project-database/

interface ProjectDatabaseConfig {
  projectId: string;
  organizationId: string;
  tier: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';
}

const DATABASE_TIERS = {
  SMALL: {
    maxConnections: 20,
    cpu: '0.5',
    memory: '1Gi',
    storage: '10Gi',
  },
  MEDIUM: {
    maxConnections: 50,
    cpu: '1',
    memory: '2Gi',
    storage: '50Gi',
  },
  LARGE: {
    maxConnections: 100,
    cpu: '2',
    memory: '4Gi',
    storage: '100Gi',
  },
  XLARGE: {
    maxConnections: 200,
    cpu: '4',
    memory: '8Gi',
    storage: '500Gi',
  },
};

class ProjectDatabaseManager {
  async provisionDatabase(config: ProjectDatabaseConfig): Promise<DatabaseInfo> {
    const dbName = `project_${config.projectId.replace(/-/g, '_')}`;
    const dbUser = `proj_${config.projectId.substring(0, 8)}`;
    const dbPassword = generateSecurePassword();

    // Create database
    await this.createDatabase(dbName);

    // Create user with limited permissions
    await this.createUser(dbUser, dbPassword, dbName);

    // Apply row-level security policies
    await this.applyRLSPolicies(dbName, config);

    // Create connection pool via PgBouncer
    const poolConfig = await this.createConnectionPool({
      database: dbName,
      user: dbUser,
      password: dbPassword,
      maxConnections: DATABASE_TIERS[config.tier].maxConnections,
      projectId: config.projectId,
    });

    // Store credentials in Vault
    await this.storeCredentials(config.projectId, {
      host: poolConfig.host,
      port: poolConfig.port,
      database: dbName,
      user: dbUser,
      password: dbPassword,
    });

    // Enable monitoring
    await this.enableMonitoring(config.projectId, dbName);

    return {
      connectionString: poolConfig.connectionString,
      database: dbName,
      user: dbUser,
    };
  }

  private async createDatabase(dbName: string): Promise<void> {
    await this.executeSQL(`
      CREATE DATABASE "${dbName}"
      WITH
        ENCODING = 'UTF8'
        LC_COLLATE = 'en_US.UTF-8'
        LC_CTYPE = 'en_US.UTF-8'
        TEMPLATE = template0;
    `);
  }

  private async createUser(
    user: string,
    password: string,
    database: string
  ): Promise<void> {
    await this.executeSQL(`
      CREATE USER "${user}" WITH PASSWORD '${password}';

      -- Grant only necessary permissions
      GRANT CONNECT ON DATABASE "${database}" TO "${user}";
      GRANT USAGE ON SCHEMA public TO "${user}";
      GRANT CREATE ON SCHEMA public TO "${user}";

      -- Prevent user from accessing other databases
      REVOKE ALL ON DATABASE postgres FROM "${user}";

      -- Set default privileges
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${user}";

      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO "${user}";

      -- Connection limit
      ALTER USER "${user}" CONNECTION LIMIT 200;

      -- Resource limits
      ALTER USER "${user}" SET statement_timeout = '30s';
      ALTER USER "${user}" SET idle_in_transaction_session_timeout = '60s';
    `);
  }

  private async applyRLSPolicies(
    database: string,
    config: ProjectDatabaseConfig
  ): Promise<void> {
    // Enable RLS on platform shared tables (if any)
    await this.executeSQL(
      `
      -- For any shared tables, enable RLS
      -- Example: audit logs shared across projects

      CREATE POLICY project_isolation_policy
      ON platform_audit_log
      FOR ALL
      TO "${database}"
      USING (project_id = '${config.projectId}');

      ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;
    `,
      database
    );
  }

  private async createConnectionPool(config: {
    database: string;
    user: string;
    password: string;
    maxConnections: number;
    projectId: string;
  }): Promise<PoolConfig> {
    // Create PgBouncer configuration for this project
    const poolName = `pool_${config.projectId.replace(/-/g, '_')}`;

    await this.configurePgBouncer({
      poolName,
      database: config.database,
      user: config.user,
      password: config.password,
      poolSize: config.maxConnections,
      poolMode: 'transaction', // Transaction-level pooling
      maxClientConn: config.maxConnections * 2,
      defaultPoolSize: Math.ceil(config.maxConnections * 0.5),
    });

    return {
      host: process.env.PGBOUNCER_HOST,
      port: 6432,
      connectionString: `postgresql://${config.user}:${config.password}@${process.env.PGBOUNCER_HOST}:6432/${config.database}`,
    };
  }

  async deprovisionDatabase(projectId: string): Promise<void> {
    const dbName = `project_${projectId.replace(/-/g, '_')}`;

    // Create backup before deletion
    await this.createBackup(dbName);

    // Terminate all connections
    await this.terminateConnections(dbName);

    // Remove from PgBouncer
    await this.removePgBouncerPool(projectId);

    // Drop database
    await this.executeSQL(`DROP DATABASE IF EXISTS "${dbName}";`);

    // Delete credentials from Vault
    await this.deleteCredentials(projectId);
  }

  async scaleDatabase(
    projectId: string,
    newTier: keyof typeof DATABASE_TIERS
  ): Promise<void> {
    const poolName = `pool_${projectId.replace(/-/g, '_')}`;
    const tierConfig = DATABASE_TIERS[newTier];

    // Update PgBouncer pool size
    await this.updatePgBouncerPool(poolName, {
      maxConnections: tierConfig.maxConnections,
    });

    // Update database resource limits if using separate DB instances
    // (This depends on your database infrastructure)
  }
}
```

### Layer 3: IAM & Credentials Isolation

```typescript
// apps/core/src/lib/services/project-iam/

class ProjectIAMManager {
  async provisionIAM(projectId: string): Promise<ProjectCredentials> {
    // Create service account for this project
    const serviceAccount = await this.createServiceAccount({
      name: `project-${projectId}`,
      projectId,
    });

    // Create scoped API key
    const apiKey = await this.createAPIKey({
      serviceAccountId: serviceAccount.id,
      scope: `project:${projectId}:*`,
      name: `${projectId}-api-key`,
    });

    // Create AWS/GCP IAM role for cloud resources
    const cloudRole = await this.createCloudRole({
      projectId,
      permissions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
        'cloudwatch:PutMetricData',
      ],
      resources: [`arn:aws:s3:::forge-project-${projectId}/*`],
    });

    // Store all credentials in Vault with project-specific path
    await this.vault.write(`projects/${projectId}/credentials`, {
      serviceAccountId: serviceAccount.id,
      apiKey: apiKey.key,
      cloudRole: cloudRole.arn,
      createdAt: new Date().toISOString(),
    });

    return {
      serviceAccountId: serviceAccount.id,
      apiKey: apiKey.key,
      cloudRoleArn: cloudRole.arn,
    };
  }

  async createServiceAccount(config: {
    name: string;
    projectId: string;
  }): Promise<ServiceAccount> {
    const serviceAccount = await db.serviceAccount.create({
      data: {
        name: config.name,
        projectId: config.projectId,
        type: 'PROJECT',
        status: 'ACTIVE',
      },
    });

    // Grant project-scoped permissions
    await db.permission.create({
      data: {
        serviceAccountId: serviceAccount.id,
        resource: `project:${config.projectId}`,
        actions: ['read', 'write', 'deploy'],
      },
    });

    return serviceAccount;
  }

  async revokeAccess(projectId: string): Promise<void> {
    // Deactivate service account
    await db.serviceAccount.updateMany({
      where: { projectId },
      data: { status: 'REVOKED' },
    });

    // Invalidate API keys
    await db.apiKey.updateMany({
      where: {
        serviceAccount: {
          projectId,
        },
      },
      data: { revokedAt: new Date() },
    });

    // Remove cloud IAM role
    await this.deleteCloudRole(projectId);

    // Delete Vault secrets
    await this.vault.delete(`projects/${projectId}`);
  }

  async rotateCredentials(projectId: string): Promise<ProjectCredentials> {
    // Revoke old credentials
    await this.revokeAccess(projectId);

    // Provision new credentials
    return await this.provisionIAM(projectId);
  }
}

interface ProjectCredentials {
  serviceAccountId: string;
  apiKey: string;
  cloudRoleArn: string;
}
```

### Layer 4: Storage Isolation

```typescript
// apps/core/src/lib/services/project-storage/

class ProjectStorageManager {
  async provisionStorage(projectId: string, quota: string): Promise<StorageInfo> {
    // Create dedicated S3 bucket (or bucket prefix)
    const bucketName = `forge-project-${projectId}`;

    await this.s3.createBucket({
      Bucket: bucketName,
      ACL: 'private',
    });

    // Enable encryption
    await this.s3.putBucketEncryption({
      Bucket: bucketName,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });

    // Enable versioning
    await this.s3.putBucketVersioning({
      Bucket: bucketName,
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });

    // Set lifecycle policies
    await this.s3.putBucketLifecycleConfiguration({
      Bucket: bucketName,
      LifecycleConfiguration: {
        Rules: [
          {
            Id: 'archive-old-versions',
            Status: 'Enabled',
            NoncurrentVersionTransitions: [
              {
                NoncurrentDays: 30,
                StorageClass: 'GLACIER',
              },
            ],
            NoncurrentVersionExpiration: {
              NoncurrentDays: 90,
            },
          },
        ],
      },
    });

    // Set quota (using custom CloudWatch metrics + Lambda)
    await this.setStorageQuota(bucketName, quota);

    // Create Kubernetes PersistentVolumeClaim
    const pvc = await this.createPVC({
      namespace: `project-${projectId}`,
      name: 'project-storage',
      size: quota,
    });

    return {
      bucketName,
      pvcName: pvc.name,
      quotaBytes: this.parseQuota(quota),
    };
  }

  private async createPVC(config: {
    namespace: string;
    name: string;
    size: string;
  }): Promise<PVCInfo> {
    const pvcManifest = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: config.name,
        namespace: config.namespace,
        labels: {
          'forge.io/resource': 'project-storage',
        },
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: config.size,
          },
        },
        storageClassName: 'fast-ssd',
      },
    };

    await this.k8s.createPVC(pvcManifest);

    return {
      name: config.name,
      namespace: config.namespace,
    };
  }

  async deprovisionStorage(projectId: string): Promise<void> {
    const bucketName = `forge-project-${projectId}`;

    // Create final backup
    await this.createBackup(bucketName);

    // Empty bucket
    await this.emptyBucket(bucketName);

    // Delete bucket
    await this.s3.deleteBucket({ Bucket: bucketName });

    // Delete PVC
    await this.k8s.deletePVC({
      namespace: `project-${projectId}`,
      name: 'project-storage',
    });
  }

  async enforceQuota(projectId: string): Promise<QuotaStatus> {
    const bucketName = `forge-project-${projectId}`;

    // Get current usage
    const usage = await this.getBucketSize(bucketName);

    // Get quota
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    const quotaBytes = this.parseQuota(project.resourceQuota.storage);

    if (usage > quotaBytes) {
      // Quota exceeded - send alert
      await this.sendQuotaAlert(projectId, usage, quotaBytes);

      // Optionally block new uploads
      await this.blockUploads(bucketName);

      return {
        exceeded: true,
        usage,
        quota: quotaBytes,
        percentage: (usage / quotaBytes) * 100,
      };
    }

    return {
      exceeded: false,
      usage,
      quota: quotaBytes,
      percentage: (usage / quotaBytes) * 100,
    };
  }
}
```

### Resource Quota Management

```typescript
// apps/core/src/lib/services/resource-quota/

interface ResourceQuota {
  cpu: string; // e.g., "4" (cores)
  memory: string; // e.g., "16Gi"
  storage: string; // e.g., "100Gi"
  maxPods: number;
  maxServices: number;
}

const QUOTA_PRESETS: Record<string, ResourceQuota> = {
  STARTER: {
    cpu: '1',
    memory: '2Gi',
    storage: '10Gi',
    maxPods: 10,
    maxServices: 5,
  },
  SMALL: {
    cpu: '2',
    memory: '4Gi',
    storage: '50Gi',
    maxPods: 20,
    maxServices: 10,
  },
  MEDIUM: {
    cpu: '4',
    memory: '8Gi',
    storage: '100Gi',
    maxPods: 50,
    maxServices: 20,
  },
  LARGE: {
    cpu: '8',
    memory: '16Gi',
    storage: '500Gi',
    maxPods: 100,
    maxServices: 50,
  },
  XLARGE: {
    cpu: '16',
    memory: '32Gi',
    storage: '1Ti',
    maxPods: 200,
    maxServices: 100,
  },
};

class ResourceQuotaManager {
  async applyQuota(projectId: string, quota: ResourceQuota): Promise<void> {
    const namespace = `project-${projectId}`;

    // Update Kubernetes ResourceQuota
    await this.k8s.applyResourceQuota(namespace, {
      hard: {
        'requests.cpu': quota.cpu,
        'requests.memory': quota.memory,
        'limits.cpu': this.calculateLimit(quota.cpu, 1.5), // 1.5x burst
        'limits.memory': this.calculateLimit(quota.memory, 1.2), // 1.2x burst
        'requests.storage': quota.storage,
        pods: quota.maxPods.toString(),
        services: quota.maxServices.toString(),
      },
    });

    // Update database quota
    await this.dbManager.scaleDatabase(projectId, this.dbTierForQuota(quota));

    // Update storage quota
    await this.storageManager.updateQuota(projectId, quota.storage);

    // Record quota change
    await db.projectQuotaHistory.create({
      data: {
        projectId,
        quota,
        changedAt: new Date(),
      },
    });
  }

  async scaleBasedOnLifecycle(
    projectId: string,
    lifecycle: ProjectStatus
  ): Promise<void> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    const baseQuota = project.resourceQuota as ResourceQuota;

    let scaledQuota: ResourceQuota;

    switch (lifecycle) {
      case ProjectStatus.ACTIVE:
        // Full quota
        scaledQuota = baseQuota;
        break;

      case ProjectStatus.MAINTENANCE:
        // 50% of full quota
        scaledQuota = this.scaleQuota(baseQuota, 0.5);
        break;

      case ProjectStatus.SUSPENDED:
        // Minimal quota (10%)
        scaledQuota = this.scaleQuota(baseQuota, 0.1);
        break;

      case ProjectStatus.ARCHIVED:
        // Zero compute, only storage for snapshot
        scaledQuota = {
          cpu: '0',
          memory: '0',
          storage: baseQuota.storage,
          maxPods: 0,
          maxServices: 0,
        };
        break;

      default:
        scaledQuota = baseQuota;
    }

    await this.applyQuota(projectId, scaledQuota);
  }

  async monitorQuotaUsage(projectId: string): Promise<QuotaUsage> {
    const namespace = `project-${projectId}`;

    // Get Kubernetes metrics
    const k8sMetrics = await this.k8s.getResourceUsage(namespace);

    // Get database usage
    const dbUsage = await this.dbManager.getDatabaseSize(projectId);

    // Get storage usage
    const storageUsage = await this.storageManager.getUsage(projectId);

    // Get quota limits
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });
    const quota = project.resourceQuota as ResourceQuota;

    const usage: QuotaUsage = {
      cpu: {
        used: k8sMetrics.cpu.used,
        limit: quota.cpu,
        percentage: (parseFloat(k8sMetrics.cpu.used) / parseFloat(quota.cpu)) * 100,
      },
      memory: {
        used: k8sMetrics.memory.used,
        limit: quota.memory,
        percentage:
          (this.parseBytes(k8sMetrics.memory.used) /
            this.parseBytes(quota.memory)) *
          100,
      },
      storage: {
        used: storageUsage.bytes,
        limit: this.parseBytes(quota.storage),
        percentage: (storageUsage.bytes / this.parseBytes(quota.storage)) * 100,
      },
      database: {
        used: dbUsage.bytes,
        limit: dbUsage.limit,
        percentage: (dbUsage.bytes / dbUsage.limit) * 100,
      },
    };

    // Update project current usage
    await db.transformationProject.update({
      where: { id: projectId },
      data: {
        currentUsage: usage,
        updatedAt: new Date(),
      },
    });

    // Check for quota violations
    await this.checkQuotaViolations(projectId, usage, quota);

    return usage;
  }

  private async checkQuotaViolations(
    projectId: string,
    usage: QuotaUsage,
    quota: ResourceQuota
  ): Promise<void> {
    const violations: string[] = [];

    if (usage.cpu.percentage > 90) {
      violations.push(`CPU usage at ${usage.cpu.percentage.toFixed(1)}%`);
    }
    if (usage.memory.percentage > 90) {
      violations.push(`Memory usage at ${usage.memory.percentage.toFixed(1)}%`);
    }
    if (usage.storage.percentage > 95) {
      violations.push(`Storage usage at ${usage.storage.percentage.toFixed(1)}%`);
    }

    if (violations.length > 0) {
      await sendAlert({
        projectId,
        severity: 'WARNING',
        type: 'QUOTA_VIOLATION',
        message: `Resource quota violations: ${violations.join(', ')}`,
      });
    }
  }

  private scaleQuota(quota: ResourceQuota, factor: number): ResourceQuota {
    return {
      cpu: (parseFloat(quota.cpu) * factor).toString(),
      memory: this.scaleMemory(quota.memory, factor),
      storage: quota.storage, // Don't scale storage
      maxPods: Math.ceil(quota.maxPods * factor),
      maxServices: Math.ceil(quota.maxServices * factor),
    };
  }
}

interface QuotaUsage {
  cpu: ResourceUsage;
  memory: ResourceUsage;
  storage: { used: number; limit: number; percentage: number };
  database: { used: number; limit: number; percentage: number };
}

interface ResourceUsage {
  used: string;
  limit: string;
  percentage: number;
}
```

### Cost Optimization

```typescript
// apps/core/src/lib/services/cost-optimization/

class CostOptimizationService {
  async optimizeResources(): Promise<void> {
    // Identify idle projects
    const idleProjects = await this.findIdleProjects();

    for (const project of idleProjects) {
      await this.downscaleProject(project.id);
    }

    // Identify over-provisioned projects
    const overProvisioned = await this.findOverProvisionedProjects();

    for (const project of overProvisioned) {
      await this.suggestDownscaling(project.id);
    }

    // Identify under-provisioned projects
    const underProvisioned = await this.findUnderProvisionedProjects();

    for (const project of underProvisioned) {
      await this.suggestUpscaling(project.id);
    }

    // Consolidate shared resources
    await this.consolidateSharedResources();
  }

  private async findIdleProjects(): Promise<TransformationProject[]> {
    // Find projects with <5% resource usage for 7+ days
    return await db.transformationProject.findMany({
      where: {
        status: ProjectStatus.ACTIVE,
        // Custom query based on usage metrics
      },
    });
  }

  private async downscaleProject(projectId: string): Promise<void> {
    const project = await db.transformationProject.findUnique({
      where: { id: projectId },
    });

    // Reduce quota by 50%
    const currentQuota = project.resourceQuota as ResourceQuota;
    const reducedQuota = this.resourceQuotaManager.scaleQuota(currentQuota, 0.5);

    await this.resourceQuotaManager.applyQuota(projectId, reducedQuota);

    // Notify project owner
    await sendNotification({
      to: project.ownerId,
      type: 'RESOURCES_DOWNSCALED',
      data: {
        projectId,
        reason: 'Low usage detected',
        oldQuota: currentQuota,
        newQuota: reducedQuota,
      },
    });
  }

  async estimateCost(quota: ResourceQuota): Promise<number> {
    // Simplified cost calculation
    const cpuCostPerCore = 30; // $ per month
    const memoryCostPerGi = 5; // $ per month
    const storageCostPerGi = 0.1; // $ per month

    const cpuCost = parseFloat(quota.cpu) * cpuCostPerCore;
    const memoryCost = this.parseGi(quota.memory) * memoryCostPerGi;
    const storageCost = this.parseGi(quota.storage) * storageCostPerGi;

    return cpuCost + memoryCost + storageCost;
  }
}
```

## Consequences

### Positive

1. **Strong Isolation:** Projects cannot interfere with each other
2. **Resource Fairness:** Fair allocation prevents noisy neighbor issues
3. **Security:** Credentials and data isolated per project
4. **Cost Control:** Quotas prevent runaway resource consumption
5. **Scalability:** Architecture supports 1000+ projects
6. **Lifecycle Optimization:** Resources scale based on project stage
7. **Multi-Tenancy:** Organizations isolated from each other

### Negative

1. **Resource Overhead:** Each project has its own namespace/database
2. **Complexity:** Multi-layer isolation is complex to manage
3. **Cost:** Separate resources per project increase base costs
4. **Management Burden:** 1000s of namespaces/databases to manage
5. **Network Latency:** Network policies add small latency overhead
6. **Storage Sprawl:** Each project has separate storage

### Mitigations

1. **Automation:** Fully automated provisioning/deprovisioning
2. **Monitoring:** Comprehensive resource usage tracking
3. **Cost Optimization:** Automatic downscaling of idle resources
4. **Shared Infrastructure:** Kubernetes nodes shared across projects
5. **Resource Pooling:** Database connection pooling reduces overhead
6. **Cleanup Jobs:** Automatic removal of archived project resources

## Alternatives Considered

### Alternative 1: Shared Resources with RLS Only

**Description:** Single database with row-level security

**Rejected Because:**
- Single point of failure
- Limited isolation guarantees
- Difficult to enforce quotas
- Cannot isolate noisy neighbors
- Security risk of SQL injection bypassing RLS

### Alternative 2: Separate Kubernetes Clusters per Project

**Description:** Dedicated cluster for each project

**Rejected Because:**
- Extremely expensive
- Massive management overhead
- Slow provisioning (15-30 minutes per cluster)
- Doesn't scale beyond 10-20 projects
- Overkill for most projects

### Alternative 3: Separate VMs per Project

**Description:** Virtual machine for each project

**Rejected Because:**
- High cost
- Slow provisioning
- Resource inefficiency
- Limited scalability
- Complex networking

### Alternative 4: Serverless Only (AWS Lambda/GCP Cloud Run)

**Description:** All projects run on serverless compute

**Rejected Because:**
- Cold start latency issues
- Limited execution time
- Stateful applications difficult
- Vendor lock-in
- Cost unpredictability at scale

## Implementation Plan

### Phase 1: Kubernetes Namespace Isolation (Weeks 1-2)
- Implement namespace provisioning
- Apply resource quotas
- Configure network policies
- Set up RBAC

### Phase 2: Database Isolation (Weeks 3-5)
- Automated database provisioning
- PgBouncer pooling per project
- Credential management
- Monitoring integration

### Phase 3: IAM & Credentials (Weeks 6-7)
- Service account creation
- API key generation
- Cloud IAM role provisioning
- Vault integration

### Phase 4: Storage Isolation (Weeks 8-9)
- S3 bucket per project
- PVC provisioning
- Quota enforcement
- Lifecycle policies

### Phase 5: Monitoring & Optimization (Weeks 10-12)
- Resource usage tracking
- Cost optimization automation
- Quota violation alerts
- Auto-scaling based on lifecycle

## Testing Strategy

### Unit Tests
- Quota calculation logic
- Resource scaling algorithms
- IAM permission checks

### Integration Tests
- End-to-end project provisioning
- Resource quota enforcement
- Network policy isolation
- Database isolation

### Load Tests
- Provision 100 projects concurrently
- 1000 projects running simultaneously
- Resource quota under load

### Security Tests
- Cross-project access attempts
- Credential leakage tests
- Network isolation validation
- SQL injection attempts

## Metrics & Monitoring

### Key Metrics
- **Provisioning Time:** Target <5 minutes per project
- **Resource Utilization:** Average 60-70% of quota
- **Cost per Project:** Track monthly
- **Quota Violations:** Target <5%
- **Isolation Violations:** Target 0

### Alerts
- Quota exceeded
- Provisioning failures
- Isolation violations detected
- High cost anomalies

## References

- [Kubernetes Multi-Tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [AWS Multi-Tenant SaaS](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html)

## Review Date

2026-04-20 (3 months)
