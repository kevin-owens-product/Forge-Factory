# Feature: GitHub Integration

**Feature ID:** FF-003
**Version:** 1.0
**Status:** Draft
**Owner:** Engineering Team

---

## Overview

Deep GitHub integration enables seamless repository connection, automatic analysis triggers via webhooks, pull request automation, and code review workflows. This is the highest priority integration (56% market share).

### User Story
> As a **development team**, I want to **connect my GitHub repositories** so that **Forge Factory can automatically analyze code changes and create improvement PRs**.

### Success Criteria
- ✓ OAuth connection flow completes in <30 seconds
- ✓ Webhooks trigger analysis within 5 seconds of push
- ✓ PRs created automatically with full context
- ✓ GitHub Actions integration for CI/CD

---

## Vertical Slice Architecture

### 1. Database Schema

```sql
-- GitHub installations (GitHub App model)
CREATE TABLE github_installations (
  id BIGINT PRIMARY KEY, -- GitHub installation ID
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_login VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'user' or 'organization'
  target_type VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,

  -- Installation access token (encrypted)
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ
);

CREATE INDEX idx_github_installations_org ON github_installations(organization_id);

-- Repository connections
CREATE TABLE repository_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_installation_id BIGINT REFERENCES github_installations(id),
  github_repo_id BIGINT NOT NULL,
  github_repo_name VARCHAR(255) NOT NULL, -- 'owner/repo'
  default_branch VARCHAR(255) NOT NULL,
  clone_url TEXT NOT NULL,
  webhook_id BIGINT, -- GitHub webhook ID
  webhook_secret TEXT, -- Encrypted

  settings JSONB DEFAULT '{
    "auto_analyze_on_push": true,
    "auto_pr_on_improvements": false,
    "require_approval": true
  }'::jsonb,

  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,

  UNIQUE(github_repo_id)
);

CREATE INDEX idx_repo_connections_github ON repository_connections(github_repo_id);

-- Pull requests created by Forge Factory
CREATE TABLE forge_pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_pr_number INTEGER NOT NULL,
  github_pr_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  head_branch VARCHAR(255) NOT NULL,
  base_branch VARCHAR(255) NOT NULL,

  -- What triggered this PR
  source_type VARCHAR(50) NOT NULL, -- 'analysis', 'refactoring', 'claude_md', 'test_generation'
  source_id UUID, -- ID of the job that created this PR

  status VARCHAR(50) NOT NULL CHECK (status IN (
    'open', 'merged', 'closed', 'draft'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Metrics
  files_changed INTEGER,
  additions INTEGER,
  deletions INTEGER,

  UNIQUE(repository_id, github_pr_number)
);

CREATE INDEX idx_forge_prs_repo ON forge_pull_requests(repository_id, status);
CREATE INDEX idx_forge_prs_source ON forge_pull_requests(source_type, source_id);

-- Webhook events log
CREATE TABLE github_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'push', 'pull_request', 'release', etc.
  delivery_id VARCHAR(255) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_repo ON github_webhook_events(repository_id, received_at DESC);
CREATE INDEX idx_webhook_events_processed ON github_webhook_events(processed) WHERE NOT processed;
```

### 2. API Endpoints

```typescript
// types/github.ts
export interface GitHubConnectionRequest {
  organizationId: string;
  installationId: number;
}

export interface GitHubRepositorySelect {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  settings?: {
    autoAnalyzeOnPush?: boolean;
    autoPrOnImprovements?: boolean;
    requireApproval?: boolean;
  };
}

export interface GitHubPullRequest {
  id: string;
  number: number;
  url: string;
  title: string;
  description: string;
  status: 'open' | 'merged' | 'closed' | 'draft';
  headBranch: string;
  baseBranch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  deliveryId: string;
  processed: boolean;
  receivedAt: string;
}
```

```typescript
// routes/github.ts
import { FastifyInstance } from 'fastify';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

export async function githubRoutes(fastify: FastifyInstance) {

  // OAuth callback - install GitHub App
  fastify.get('/api/v1/integrations/github/callback', async (request, reply) => {
    const { code, installation_id, setup_action } = request.query as any;

    if (!code || !installation_id) {
      return reply.code(400).send({ error: 'Missing required parameters' });
    }

    // Exchange code for token
    const { data: { token } } = await fastify.github.apps.createInstallationAccessToken({
      installation_id: parseInt(installation_id),
    });

    // Get installation details
    const { data: installation } = await fastify.github.apps.getInstallation({
      installation_id: parseInt(installation_id),
    });

    // Store installation
    await fastify.db.githubInstallation.upsert({
      where: { id: parseInt(installation_id) },
      create: {
        id: parseInt(installation_id),
        organizationId: request.user.organizationId,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type,
        permissions: installation.permissions,
        installedAt: new Date(installation.created_at),
        accessTokenEncrypted: await fastify.encrypt(token),
        tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
      update: {
        accessTokenEncrypted: await fastify.encrypt(token),
        tokenExpiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Redirect to repository selection
    return reply.redirect(`/app/integrations/github/select-repos?installation_id=${installation_id}`);
  });

  // List available repositories from installation
  fastify.get<{
    Querystring: { installation_id: string };
  }>('/api/v1/integrations/github/repositories', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { installation_id } = request.query;

    const installation = await fastify.db.githubInstallation.findUnique({
      where: { id: parseInt(installation_id) },
    });

    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' });
    }

    // Get installation token
    const token = await fastify.decrypt(installation.accessTokenEncrypted);
    const octokit = new Octokit({ auth: token });

    // List repositories
    const { data: { repositories } } = await octokit.apps.listReposAccessibleToInstallation();

    return repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
      language: repo.language,
      size: repo.size,
      updatedAt: repo.updated_at,
    }));
  });

  // Connect a repository
  fastify.post<{
    Body: GitHubRepositorySelect;
  }>('/api/v1/integrations/github/connect-repository', {
    preHandler: [fastify.authenticate, fastify.authorize(['repo:write'])],
  }, async (request, reply) => {
    const { githubRepoId, name, fullName, defaultBranch, settings } = request.body;

    // Get installation
    const installation = await fastify.db.githubInstallation.findFirst({
      where: { organizationId: request.user.organizationId },
    });

    if (!installation) {
      return reply.code(404).send({ error: 'GitHub not connected' });
    }

    // Create repository
    const repository = await fastify.db.repository.create({
      data: {
        organizationId: request.user.organizationId,
        name,
        provider: 'github',
        externalId: githubRepoId.toString(),
        cloneUrl: `https://github.com/${fullName}.git`,
        defaultBranch,
      },
    });

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create webhook on GitHub
    const token = await fastify.decrypt(installation.accessTokenEncrypted);
    const octokit = new Octokit({ auth: token });

    const [owner, repo] = fullName.split('/');
    const { data: webhook } = await octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url: `${fastify.config.APP_URL}/api/v1/webhooks/github`,
        content_type: 'json',
        secret: webhookSecret,
      },
      events: ['push', 'pull_request', 'release'],
    });

    // Store connection
    const connection = await fastify.db.repositoryConnection.create({
      data: {
        repositoryId: repository.id,
        githubInstallationId: installation.id,
        githubRepoId,
        githubRepoName: fullName,
        defaultBranch,
        cloneUrl: `https://github.com/${fullName}.git`,
        webhookId: webhook.id,
        webhookSecret: await fastify.encrypt(webhookSecret),
        settings: settings || {},
      },
    });

    return { repository, connection };
  });

  // Webhook receiver
  fastify.post('/api/v1/webhooks/github', {
    config: {
      rawBody: true, // Need raw body for signature verification
    },
  }, async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const deliveryId = request.headers['x-github-delivery'] as string;
    const event = request.headers['x-github-event'] as string;

    if (!signature || !deliveryId || !event) {
      return reply.code(400).send({ error: 'Missing required headers' });
    }

    // Find repository from payload
    const payload = request.body as any;
    const repoId = payload.repository?.id;

    if (!repoId) {
      return reply.code(400).send({ error: 'Missing repository in payload' });
    }

    const connection = await fastify.db.repositoryConnection.findUnique({
      where: { githubRepoId: repoId },
      include: { repository: true },
    });

    if (!connection) {
      return reply.code(404).send({ error: 'Repository not connected' });
    }

    // Verify signature
    const webhookSecret = await fastify.decrypt(connection.webhookSecret);
    const isValid = verifyGitHubSignature(
      request.rawBody as string,
      signature,
      webhookSecret,
    );

    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Store event
    const webhookEvent = await fastify.db.githubWebhookEvent.create({
      data: {
        repositoryId: connection.repository.id,
        eventType: event,
        deliveryId,
        payload,
      },
    });

    // Process event asynchronously
    await fastify.queue.add('github-webhook', {
      eventId: webhookEvent.id,
      eventType: event,
      repositoryId: connection.repository.id,
    });

    return reply.code(200).send({ received: true });
  });

  // Create pull request
  fastify.post<{
    Body: {
      repositoryId: string;
      title: string;
      description: string;
      headBranch: string;
      baseBranch?: string;
      sourceType: string;
      sourceId?: string;
    };
  }>('/api/v1/github/pull-requests', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { repositoryId, title, description, headBranch, baseBranch, sourceType, sourceId } = request.body;

    const connection = await fastify.db.repositoryConnection.findFirst({
      where: { repositoryId },
      include: {
        githubInstallation: true,
        repository: true,
      },
    });

    if (!connection) {
      return reply.code(404).send({ error: 'Repository not connected to GitHub' });
    }

    // Get installation token
    const token = await fastify.decrypt(connection.githubInstallation.accessTokenEncrypted);
    const octokit = new Octokit({ auth: token });

    // Create PR
    const [owner, repo] = connection.githubRepoName.split('/');
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body: description,
      head: headBranch,
      base: baseBranch || connection.defaultBranch,
    });

    // Store PR
    const forgePr = await fastify.db.forgePullRequest.create({
      data: {
        repositoryId,
        githubPrNumber: pr.number,
        githubPrUrl: pr.html_url,
        title,
        description,
        headBranch,
        baseBranch: baseBranch || connection.defaultBranch,
        sourceType,
        sourceId,
        status: 'open',
        filesChanged: pr.changed_files,
        additions: pr.additions,
        deletions: pr.deletions,
      },
    });

    return forgePr;
  });

  // List PRs for repository
  fastify.get<{
    Params: { repositoryId: string };
  }>('/api/v1/repositories/:repositoryId/pull-requests', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { repositoryId } = request.params;

    const prs = await fastify.db.forgePullRequest.findMany({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
    });

    return prs;
  });
}

// Utility function
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

### 3. Webhook Event Processor

```typescript
// workers/github-webhook-processor.ts
export class GitHubWebhookProcessor {
  async process(eventId: string) {
    const event = await this.db.githubWebhookEvent.findUnique({
      where: { id: eventId },
      include: { repository: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    try {
      switch (event.eventType) {
        case 'push':
          await this.handlePush(event);
          break;
        case 'pull_request':
          await this.handlePullRequest(event);
          break;
        case 'release':
          await this.handleRelease(event);
          break;
        default:
          console.log(`Unhandled event type: ${event.eventType}`);
      }

      // Mark as processed
      await this.db.githubWebhookEvent.update({
        where: { id: eventId },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await this.db.githubWebhookEvent.update({
        where: { id: eventId },
        data: {
          processed: true,
          processedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  private async handlePush(event: GitHubWebhookEvent) {
    const payload = event.payload as any;

    // Check if auto-analyze is enabled
    const connection = await this.db.repositoryConnection.findFirst({
      where: { repositoryId: event.repositoryId },
    });

    if (!connection?.settings?.autoAnalyzeOnPush) {
      return;
    }

    // Trigger analysis
    await this.queue.add('analysis', {
      repositoryId: event.repositoryId,
      commitSha: payload.after,
      branch: payload.ref.replace('refs/heads/', ''),
      triggeredBy: 'github_webhook',
    });
  }

  private async handlePullRequest(event: GitHubWebhookEvent) {
    const payload = event.payload as any;

    if (payload.action === 'opened' || payload.action === 'synchronize') {
      // Analyze PR changes
      await this.queue.add('pr-analysis', {
        repositoryId: event.repositoryId,
        prNumber: payload.pull_request.number,
        headSha: payload.pull_request.head.sha,
      });
    }

    if (payload.action === 'closed' && payload.pull_request.merged) {
      // Update our PR record
      await this.db.forgePullRequest.updateMany({
        where: {
          repositoryId: event.repositoryId,
          githubPrNumber: payload.pull_request.number,
        },
        data: {
          status: 'merged',
          mergedAt: new Date(),
        },
      });
    }
  }

  private async handleRelease(event: GitHubWebhookEvent) {
    const payload = event.payload as any;

    // Trigger comprehensive analysis on release
    await this.queue.add('analysis', {
      repositoryId: event.repositoryId,
      commitSha: payload.release.tag_name,
      branch: payload.release.target_commitish,
      triggeredBy: 'release',
    });
  }
}
```

### 4. UI Components

```typescript
// components/GitHubConnectButton.tsx
'use client';

import { Button } from '@/components/ui/button';
import { GitBranchIcon } from 'lucide-react';

export function GitHubConnectButton() {
  const handleConnect = () => {
    // Redirect to GitHub App installation
    const clientId = process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/v1/integrations/github/callback`;
    window.location.href = `https://github.com/apps/forge-factory/installations/new`;
  };

  return (
    <Button onClick={handleConnect} size="lg">
      <GitBranchIcon className="mr-2 h-5 w-5" />
      Connect GitHub
    </Button>
  );
}

// components/RepositorySelector.tsx
export function RepositorySelector({ installationId }: { installationId: string }) {
  const { data: repos, isLoading } = useGitHubRepositories(installationId);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleConnect = async () => {
    for (const repoId of selected) {
      const repo = repos.find(r => r.id === repoId);
      await connectRepository(repo);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="space-y-2">
        {repos.map(repo => (
          <Card key={repo.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h4 className="font-semibold">{repo.fullName}</h4>
                <p className="text-sm text-muted-foreground">{repo.description}</p>
              </div>
              <Checkbox
                checked={selected.has(repo.id)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selected);
                  if (checked) {
                    newSelected.add(repo.id);
                  } else {
                    newSelected.delete(repo.id);
                  }
                  setSelected(newSelected);
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleConnect}
        disabled={selected.size === 0}
        className="mt-4"
      >
        Connect {selected.size} Repositories
      </Button>
    </div>
  );
}
```

### 5. Tests

```typescript
// tests/github-integration.test.ts
describe('GitHub Integration', () => {
  it('verifies webhook signature', () => {
    const payload = JSON.stringify({ test: 'data' });
    const secret = 'test-secret';
    const signature = createGitHubSignature(payload, secret);

    const isValid = verifyGitHubSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('handles push webhook', async () => {
    const event = await createWebhookEvent('push', {
      repository: { id: 123 },
      ref: 'refs/heads/main',
      after: 'abc123',
    });

    await processor.process(event.id);

    // Should trigger analysis
    expect(queue.add).toHaveBeenCalledWith('analysis', expect.objectContaining({
      commitSha: 'abc123',
    }));
  });
});
```

---

## Implementation Plan

- **Week 1:** GitHub App setup + OAuth flow
- **Week 2:** Webhook processing + repository connection
- **Week 3:** PR automation
- **Week 4:** Testing + documentation

---

**Status:** Ready for implementation
