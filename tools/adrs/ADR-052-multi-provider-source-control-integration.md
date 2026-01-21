# ADR-052: Multi-Provider Source Control Integration

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P0 - Critical for Launch
**Complexity:** High
**Dependencies:** ADR-040 (Safety & Rollback), ADR-053 (PR Automation)

---

## Context

Forge Factory must integrate with customers' **source control systems** to access codebases, create branches, commit transformations, and submit pull requests. Enterprises use **diverse Git providers** with different APIs, authentication mechanisms, and feature sets.

### Business Requirements

**Target Providers (Priority Order):**
1. **GitHub** (80% of customers) - Market leader, comprehensive API
2. **GitLab** (15% of customers) - Popular in Europe, self-hosted options
3. **Bitbucket** (10% of customers) - Atlassian ecosystem integration
4. **Azure DevOps** (8% of customers) - Microsoft enterprise customers
5. **AWS CodeCommit** (2% of customers) - AWS-native teams
6. **Self-Hosted Git** (5% of customers) - Air-gapped environments

**Note:** Percentages overlap as enterprises often use multiple providers.

**Required Capabilities:**
- **Repository Discovery:** List accessible repositories
- **Code Access:** Clone/pull repository contents
- **Branch Management:** Create, delete, merge branches
- **Commit Operations:** Create commits with changes
- **Pull Request Workflow:** Create, update, merge PRs
- **Webhook Integration:** Receive events (PR merged, branch created)
- **Status Checks:** Report transformation status on PRs
- **Comments:** Add review comments on PRs
- **Organization Management:** Handle org/team permissions

### Technical Challenges

1. **API Diversity:** Each provider has unique REST/GraphQL API
2. **Authentication Variance:** OAuth, PAT, SSH keys, app installations
3. **Feature Parity:** Not all providers support same features
4. **Rate Limiting:** Different limits (GitHub: 5000/hr, GitLab: 300/min)
5. **Webhook Security:** Signature verification differs per provider
6. **Self-Hosted Versions:** GitLab, Bitbucket have on-premise versions
7. **Permissions Model:** GitHub Apps vs. OAuth Apps vs. PATs

### Provider API Comparison

| Feature | GitHub | GitLab | Bitbucket | Azure DevOps |
|---------|--------|--------|-----------|--------------|
| **REST API** | ✅ v3 | ✅ v4 | ✅ v2 | ✅ 7.1 |
| **GraphQL API** | ✅ | ✅ | ❌ | ❌ |
| **OAuth 2.0** | ✅ | ✅ | ✅ | ✅ |
| **Webhooks** | ✅ | ✅ | ✅ | ✅ |
| **Status Checks** | ✅ | ✅ Pipelines | ✅ Build Status | ✅ PR Status |
| **PR Comments** | ✅ | ✅ MR Notes | ✅ | ✅ |
| **File Contents** | ✅ | ✅ | ✅ | ✅ |
| **Branch Protection** | ✅ | ✅ Protected | ✅ | ✅ Branch Policy |
| **Code Search** | ✅ | ✅ | ✅ | ✅ |
| **Self-Hosted** | ❌ (Enterprise) | ✅ CE/EE | ✅ Server | ✅ Server |

---

## Decision

We will implement a **unified Git abstraction layer** with:

1. **Abstract Git interface** (provider-agnostic operations)
2. **Provider adapters** (GitHub, GitLab, Bitbucket, Azure DevOps)
3. **Authentication manager** (multi-provider OAuth, token storage)
4. **Webhook router** (unified webhook handling)
5. **Rate limit manager** (per-provider throttling)
6. **Caching layer** (reduce API calls)

### Architecture Overview

```typescript
interface GitProvider {
  // Provider metadata
  name: string;
  type: ProviderType;
  baseUrl: string; // For self-hosted
  capabilities: ProviderCapabilities;

  // Authentication
  authenticate(credentials: Credentials): Promise<AuthResult>;
  refreshToken(refreshToken: string): Promise<AuthResult>;

  // Repository operations
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  getRepository(owner: string, repo: string): Promise<Repository>;
  cloneRepository(repo: Repository, destination: string): Promise<void>;

  // Branch operations
  listBranches(repo: Repository): Promise<Branch[]>;
  createBranch(repo: Repository, name: string, from: string): Promise<Branch>;
  deleteBranch(repo: Repository, name: string): Promise<void>;
  getDefaultBranch(repo: Repository): Promise<string>;

  // File operations
  getFileContents(repo: Repository, path: string, ref?: string): Promise<string>;
  getDirectoryContents(repo: Repository, path: string, ref?: string): Promise<FileTree>;

  // Commit operations
  createCommit(repo: Repository, commit: CommitInput): Promise<Commit>;
  getCommit(repo: Repository, sha: string): Promise<Commit>;
  compareCommits(repo: Repository, base: string, head: string): Promise<CommitComparison>;

  // Pull request operations
  createPullRequest(repo: Repository, pr: PullRequestInput): Promise<PullRequest>;
  updatePullRequest(repo: Repository, prNumber: number, updates: Partial<PullRequestInput>): Promise<PullRequest>;
  mergePullRequest(repo: Repository, prNumber: number, method: MergeMethod): Promise<void>;
  addPRComment(repo: Repository, prNumber: number, comment: string): Promise<void>;
  listPRComments(repo: Repository, prNumber: number): Promise<Comment[]>;

  // Status checks
  createStatusCheck(repo: Repository, sha: string, status: StatusCheck): Promise<void>;
  updateStatusCheck(repo: Repository, sha: string, status: StatusCheck): Promise<void>;

  // Webhooks
  createWebhook(repo: Repository, config: WebhookConfig): Promise<Webhook>;
  deleteWebhook(repo: Repository, webhookId: string): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}
```

### Core Component 1: Abstract Git Interface

```typescript
enum ProviderType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  AZURE_DEVOPS = 'azure-devops',
  SELF_HOSTED_GIT = 'self-hosted-git',
}

interface ProviderCapabilities {
  supportsPullRequests: boolean;
  supportsStatusChecks: boolean;
  supportsInlineComments: boolean;
  supportsGraphQL: boolean;
  supportsWebhooks: boolean;
  supportsOAuth: boolean;
  maxFileSizeBytes: number;
  rateLimit: {
    requestsPerHour: number;
    resetStrategy: 'rolling' | 'fixed-window';
  };
}

class GitProviderFactory {
  static create(type: ProviderType, config: ProviderConfig): GitProvider {
    switch (type) {
      case ProviderType.GITHUB:
        return new GitHubProvider(config);
      case ProviderType.GITLAB:
        return new GitLabProvider(config);
      case ProviderType.BITBUCKET:
        return new BitbucketProvider(config);
      case ProviderType.AZURE_DEVOPS:
        return new AzureDevOpsProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }

  static detectProvider(repoUrl: string): ProviderType {
    if (repoUrl.includes('github.com')) return ProviderType.GITHUB;
    if (repoUrl.includes('gitlab.com')) return ProviderType.GITLAB;
    if (repoUrl.includes('bitbucket.org')) return ProviderType.BITBUCKET;
    if (repoUrl.includes('dev.azure.com')) return ProviderType.AZURE_DEVOPS;
    throw new Error('Cannot detect provider from URL');
  }
}
```

### Core Component 2: GitHub Provider Implementation

```typescript
class GitHubProvider implements GitProvider {
  name = 'GitHub';
  type = ProviderType.GITHUB;
  capabilities: ProviderCapabilities = {
    supportsPullRequests: true,
    supportsStatusChecks: true,
    supportsInlineComments: true,
    supportsGraphQL: true,
    supportsWebhooks: true,
    supportsOAuth: true,
    maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
    rateLimit: {
      requestsPerHour: 5000,
      resetStrategy: 'rolling',
    },
  };

  private octokit: Octokit;
  private rateLimiter: RateLimiter;

  constructor(config: ProviderConfig) {
    this.octokit = new Octokit({
      auth: config.accessToken,
      baseUrl: config.baseUrl || 'https://api.github.com',
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: this.capabilities.rateLimit.requestsPerHour,
      perInterval: 60 * 60 * 1000, // 1 hour
    });
  }

  async listRepositories(filters?: RepositoryFilters): Promise<Repository[]> {
    await this.rateLimiter.acquire();

    try {
      const response = await this.octokit.repos.listForAuthenticatedUser({
        visibility: filters?.visibility || 'all',
        sort: 'updated',
        per_page: 100,
      });

      return response.data.map(repo => this.mapToRepository(repo));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createBranch(
    repo: Repository,
    name: string,
    from: string
  ): Promise<Branch> {
    await this.rateLimiter.acquire();

    try {
      // Get SHA of the source branch
      const refResponse = await this.octokit.git.getRef({
        owner: repo.owner,
        repo: repo.name,
        ref: `heads/${from}`,
      });

      const sha = refResponse.data.object.sha;

      // Create new branch
      await this.octokit.git.createRef({
        owner: repo.owner,
        repo: repo.name,
        ref: `refs/heads/${name}`,
        sha,
      });

      return {
        name,
        sha,
        protected: false,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createCommit(repo: Repository, commit: CommitInput): Promise<Commit> {
    await this.rateLimiter.acquire();

    try {
      // Get current commit SHA
      const refResponse = await this.octokit.git.getRef({
        owner: repo.owner,
        repo: repo.name,
        ref: `heads/${commit.branch}`,
      });

      const currentSha = refResponse.data.object.sha;

      // Get current tree
      const commitResponse = await this.octokit.git.getCommit({
        owner: repo.owner,
        repo: repo.name,
        commit_sha: currentSha,
      });

      const currentTreeSha = commitResponse.data.tree.sha;

      // Create blobs for new/modified files
      const blobs = await Promise.all(
        commit.files.map(async file => {
          const blobResponse = await this.octokit.git.createBlob({
            owner: repo.owner,
            repo: repo.name,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobResponse.data.sha,
          };
        })
      );

      // Create new tree
      const treeResponse = await this.octokit.git.createTree({
        owner: repo.owner,
        repo: repo.name,
        base_tree: currentTreeSha,
        tree: blobs,
      });

      // Create commit
      const newCommitResponse = await this.octokit.git.createCommit({
        owner: repo.owner,
        repo: repo.name,
        message: commit.message,
        tree: treeResponse.data.sha,
        parents: [currentSha],
      });

      // Update ref
      await this.octokit.git.updateRef({
        owner: repo.owner,
        repo: repo.name,
        ref: `heads/${commit.branch}`,
        sha: newCommitResponse.data.sha,
      });

      return {
        sha: newCommitResponse.data.sha,
        message: commit.message,
        author: newCommitResponse.data.author,
        url: newCommitResponse.data.html_url,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPullRequest(
    repo: Repository,
    pr: PullRequestInput
  ): Promise<PullRequest> {
    await this.rateLimiter.acquire();

    try {
      const response = await this.octokit.pulls.create({
        owner: repo.owner,
        repo: repo.name,
        title: pr.title,
        body: pr.body,
        head: pr.head,
        base: pr.base,
        draft: pr.draft || false,
      });

      return {
        number: response.data.number,
        title: response.data.title,
        url: response.data.html_url,
        state: response.data.state,
        createdAt: new Date(response.data.created_at),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createStatusCheck(
    repo: Repository,
    sha: string,
    status: StatusCheck
  ): Promise<void> {
    await this.rateLimiter.acquire();

    try {
      await this.octokit.repos.createCommitStatus({
        owner: repo.owner,
        repo: repo.name,
        sha,
        state: this.mapStatusState(status.state),
        target_url: status.targetUrl,
        description: status.description,
        context: status.context || 'Forge Factory',
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // GitHub uses HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private mapToRepository(ghRepo: any): Repository {
    return {
      id: ghRepo.id.toString(),
      name: ghRepo.name,
      owner: ghRepo.owner.login,
      fullName: ghRepo.full_name,
      url: ghRepo.html_url,
      cloneUrl: ghRepo.clone_url,
      defaultBranch: ghRepo.default_branch,
      private: ghRepo.private,
      language: ghRepo.language,
      updatedAt: new Date(ghRepo.updated_at),
    };
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('Authentication failed. Please check your access token.');
    }
    if (error.status === 403) {
      return new Error('Rate limit exceeded or insufficient permissions.');
    }
    if (error.status === 404) {
      return new Error('Repository not found or access denied.');
    }
    return new Error(`GitHub API error: ${error.message}`);
  }
}
```

### Core Component 3: GitLab Provider Implementation

```typescript
class GitLabProvider implements GitProvider {
  name = 'GitLab';
  type = ProviderType.GITLAB;
  capabilities: ProviderCapabilities = {
    supportsPullRequests: true, // GitLab calls them "Merge Requests"
    supportsStatusChecks: true, // Via Pipeline status
    supportsInlineComments: true,
    supportsGraphQL: true,
    supportsWebhooks: true,
    supportsOAuth: true,
    maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
    rateLimit: {
      requestsPerHour: 300 * 60, // 300/min = 18,000/hr
      resetStrategy: 'fixed-window',
    },
  };

  private client: Gitlab;
  private rateLimiter: RateLimiter;

  constructor(config: ProviderConfig) {
    this.client = new Gitlab({
      host: config.baseUrl || 'https://gitlab.com',
      token: config.accessToken,
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: 300,
      perInterval: 60 * 1000, // 1 minute
    });
  }

  async listRepositories(filters?: RepositoryFilters): Promise<Repository[]> {
    await this.rateLimiter.acquire();

    try {
      const projects = await this.client.Projects.all({
        membership: true,
        per_page: 100,
        order_by: 'updated_at',
      });

      return projects.map(project => this.mapToRepository(project));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createBranch(
    repo: Repository,
    name: string,
    from: string
  ): Promise<Branch> {
    await this.rateLimiter.acquire();

    try {
      const branch = await this.client.Branches.create(
        repo.id,
        name,
        from
      );

      return {
        name: branch.name,
        sha: branch.commit.id,
        protected: branch.protected,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createCommit(repo: Repository, commit: CommitInput): Promise<Commit> {
    await this.rateLimiter.acquire();

    try {
      // GitLab has a convenient Commits.create API that accepts multiple files
      const actions = commit.files.map(file => ({
        action: 'update' as const,
        file_path: file.path,
        content: file.content,
      }));

      const result = await this.client.Commits.create(
        repo.id,
        commit.branch,
        commit.message,
        actions
      );

      return {
        sha: result.id,
        message: result.message,
        author: result.author_name,
        url: result.web_url,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPullRequest(
    repo: Repository,
    pr: PullRequestInput
  ): Promise<PullRequest> {
    await this.rateLimiter.acquire();

    try {
      // GitLab calls them "Merge Requests"
      const mr = await this.client.MergeRequests.create(
        repo.id,
        pr.head,
        pr.base,
        pr.title,
        {
          description: pr.body,
        }
      );

      return {
        number: mr.iid,
        title: mr.title,
        url: mr.web_url,
        state: mr.state,
        createdAt: new Date(mr.created_at),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createStatusCheck(
    repo: Repository,
    sha: string,
    status: StatusCheck
  ): Promise<void> {
    await this.rateLimiter.acquire();

    try {
      // GitLab uses Commit Status API
      await this.client.Commits.editStatus(
        repo.id,
        sha,
        this.mapStatusState(status.state),
        {
          name: status.context || 'Forge Factory',
          description: status.description,
          target_url: status.targetUrl,
        }
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // GitLab uses X-Gitlab-Token header (simple token comparison)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(secret));
  }

  private mapToRepository(glProject: any): Repository {
    return {
      id: glProject.id.toString(),
      name: glProject.path,
      owner: glProject.namespace.path,
      fullName: glProject.path_with_namespace,
      url: glProject.web_url,
      cloneUrl: glProject.http_url_to_repo,
      defaultBranch: glProject.default_branch,
      private: glProject.visibility === 'private',
      language: null, // GitLab doesn't expose primary language easily
      updatedAt: new Date(glProject.last_activity_at),
    };
  }

  private handleError(error: any): Error {
    if (error.response?.status === 401) {
      return new Error('Authentication failed. Please check your access token.');
    }
    if (error.response?.status === 403) {
      return new Error('Insufficient permissions.');
    }
    if (error.response?.status === 404) {
      return new Error('Project not found or access denied.');
    }
    return new Error(`GitLab API error: ${error.message}`);
  }
}
```

### Core Component 4: Unified Authentication Manager

```typescript
class GitAuthenticationManager {
  async authenticateProvider(
    provider: ProviderType,
    credentials: Credentials
  ): Promise<AuthResult> {
    switch (provider) {
      case ProviderType.GITHUB:
        return this.authenticateGitHub(credentials);
      case ProviderType.GITLAB:
        return this.authenticateGitLab(credentials);
      case ProviderType.BITBUCKET:
        return this.authenticateBitbucket(credentials);
      case ProviderType.AZURE_DEVOPS:
        return this.authenticateAzureDevOps(credentials);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async authenticateGitHub(credentials: Credentials): Promise<AuthResult> {
    if (credentials.type === 'oauth') {
      // OAuth flow
      const { code, redirectUri } = credentials;

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await tokenResponse.json();

      if (data.error) {
        throw new Error(`GitHub OAuth error: ${data.error_description}`);
      }

      // Get user info
      const octokit = new Octokit({ auth: data.access_token });
      const userResponse = await octokit.users.getAuthenticated();

      // Store credentials
      const storedCredentials = await this.storeCredentials({
        provider: ProviderType.GITHUB,
        userId: userResponse.data.id.toString(),
        username: userResponse.data.login,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
      });

      return {
        success: true,
        provider: ProviderType.GITHUB,
        userId: userResponse.data.id.toString(),
        username: userResponse.data.login,
        credentialsId: storedCredentials.id,
      };
    } else if (credentials.type === 'pat') {
      // Personal Access Token
      const octokit = new Octokit({ auth: credentials.token });

      try {
        const userResponse = await octokit.users.getAuthenticated();

        const storedCredentials = await this.storeCredentials({
          provider: ProviderType.GITHUB,
          userId: userResponse.data.id.toString(),
          username: userResponse.data.login,
          accessToken: credentials.token,
          expiresAt: null, // PATs don't expire
        });

        return {
          success: true,
          provider: ProviderType.GITHUB,
          userId: userResponse.data.id.toString(),
          username: userResponse.data.login,
          credentialsId: storedCredentials.id,
        };
      } catch (error) {
        throw new Error('Invalid GitHub Personal Access Token');
      }
    }

    throw new Error('Unsupported GitHub credential type');
  }

  async refreshCredentials(credentialsId: string): Promise<AuthResult> {
    const credentials = await this.db.credentials.findUnique({
      where: { id: credentialsId },
    });

    if (!credentials) {
      throw new Error('Credentials not found');
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Refresh based on provider
    switch (credentials.provider) {
      case ProviderType.GITHUB:
        return this.refreshGitHubToken(credentials);
      case ProviderType.GITLAB:
        return this.refreshGitLabToken(credentials);
      default:
        throw new Error(`Token refresh not supported for ${credentials.provider}`);
    }
  }

  private async storeCredentials(creds: StoredCredentials): Promise<{ id: string }> {
    // Encrypt access token before storing
    const encryptedToken = this.encrypt(creds.accessToken);

    return await this.db.credentials.create({
      data: {
        provider: creds.provider,
        userId: creds.userId,
        username: creds.username,
        accessToken: encryptedToken,
        refreshToken: creds.refreshToken ? this.encrypt(creds.refreshToken) : null,
        expiresAt: creds.expiresAt,
      },
    });
  }

  async getCredentials(userId: string, provider: ProviderType): Promise<Credentials | null> {
    const stored = await this.db.credentials.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (!stored) return null;

    // Check if expired
    if (stored.expiresAt && stored.expiresAt < new Date()) {
      // Attempt refresh
      if (stored.refreshToken) {
        await this.refreshCredentials(stored.id);
        return this.getCredentials(userId, provider);
      }

      return null; // Expired, no refresh token
    }

    return {
      type: 'stored',
      accessToken: this.decrypt(stored.accessToken),
      username: stored.username,
    };
  }

  private encrypt(value: string): string {
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
      crypto.randomBytes(16)
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  }

  private decrypt(encrypted: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
      crypto.randomBytes(16)
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### Core Component 5: Webhook Router

```typescript
class GitWebhookRouter {
  async handleWebhook(
    provider: ProviderType,
    headers: Record<string, string>,
    payload: any
  ): Promise<WebhookResult> {
    // Verify signature
    const verified = await this.verifyWebhook(provider, headers, payload);

    if (!verified) {
      throw new Error('Webhook signature verification failed');
    }

    // Route to appropriate handler
    switch (provider) {
      case ProviderType.GITHUB:
        return this.handleGitHubWebhook(headers, payload);
      case ProviderType.GITLAB:
        return this.handleGitLabWebhook(headers, payload);
      case ProviderType.BITBUCKET:
        return this.handleBitbucketWebhook(headers, payload);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async handleGitHubWebhook(
    headers: Record<string, string>,
    payload: any
  ): Promise<WebhookResult> {
    const event = headers['x-github-event'];

    switch (event) {
      case 'pull_request':
        return this.handlePullRequestEvent(payload);
      case 'push':
        return this.handlePushEvent(payload);
      case 'repository':
        return this.handleRepositoryEvent(payload);
      default:
        console.log(`Unhandled GitHub event: ${event}`);
        return { processed: false };
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<WebhookResult> {
    const action = payload.action;
    const pr = payload.pull_request;

    if (action === 'opened') {
      // New PR opened
      console.log(`PR opened: ${pr.html_url}`);

      // Check if this is a Forge Factory PR
      if (pr.head.ref.startsWith('forge-factory/')) {
        // Track PR for monitoring
        await this.db.pullRequests.create({
          data: {
            provider: ProviderType.GITHUB,
            repoId: payload.repository.id.toString(),
            number: pr.number,
            url: pr.html_url,
            status: 'open',
          },
        });
      }

      return { processed: true };
    }

    if (action === 'closed' && pr.merged) {
      // PR merged
      console.log(`PR merged: ${pr.html_url}`);

      // Update tracking
      await this.db.pullRequests.updateMany({
        where: {
          provider: ProviderType.GITHUB,
          repoId: payload.repository.id.toString(),
          number: pr.number,
        },
        data: {
          status: 'merged',
          mergedAt: new Date(pr.merged_at),
        },
      });

      // Trigger post-merge actions (e.g., delete branch, analyze impact)
      await this.handlePRMerged(payload.repository, pr);

      return { processed: true };
    }

    return { processed: false };
  }

  private verifyWebhook(
    provider: ProviderType,
    headers: Record<string, string>,
    payload: any
  ): boolean {
    const providerInstance = GitProviderFactory.create(provider, {
      accessToken: '', // Not needed for verification
    });

    const signature = this.extractSignature(provider, headers);
    const secret = this.getWebhookSecret(provider);

    return providerInstance.verifyWebhookSignature(
      JSON.stringify(payload),
      signature,
      secret
    );
  }

  private extractSignature(provider: ProviderType, headers: Record<string, string>): string {
    switch (provider) {
      case ProviderType.GITHUB:
        return headers['x-hub-signature-256'] || '';
      case ProviderType.GITLAB:
        return headers['x-gitlab-token'] || '';
      case ProviderType.BITBUCKET:
        return headers['x-hub-signature'] || '';
      default:
        return '';
    }
  }

  private getWebhookSecret(provider: ProviderType): string {
    // Retrieve from environment or database
    const secrets: Record<ProviderType, string> = {
      [ProviderType.GITHUB]: process.env.GITHUB_WEBHOOK_SECRET!,
      [ProviderType.GITLAB]: process.env.GITLAB_WEBHOOK_SECRET!,
      [ProviderType.BITBUCKET]: process.env.BITBUCKET_WEBHOOK_SECRET!,
      [ProviderType.AZURE_DEVOPS]: process.env.AZURE_WEBHOOK_SECRET!,
      [ProviderType.SELF_HOSTED_GIT]: '',
    };

    return secrets[provider];
  }
}
```

### Core Component 6: Caching Layer

```typescript
class GitProviderCache {
  private cache: Redis;
  private ttl = {
    repositories: 5 * 60, // 5 minutes
    branches: 2 * 60, // 2 minutes
    fileContents: 10 * 60, // 10 minutes
    commits: 30 * 60, // 30 minutes
  };

  async getRepositories(userId: string, provider: ProviderType): Promise<Repository[] | null> {
    const key = `repos:${provider}:${userId}`;
    const cached = await this.cache.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  async setRepositories(
    userId: string,
    provider: ProviderType,
    repositories: Repository[]
  ): Promise<void> {
    const key = `repos:${provider}:${userId}`;
    await this.cache.setex(key, this.ttl.repositories, JSON.stringify(repositories));
  }

  async getFileContents(
    repo: Repository,
    path: string,
    ref: string
  ): Promise<string | null> {
    const key = `file:${repo.fullName}:${ref}:${path}`;
    return await this.cache.get(key);
  }

  async setFileContents(
    repo: Repository,
    path: string,
    ref: string,
    content: string
  ): Promise<void> {
    const key = `file:${repo.fullName}:${ref}:${path}`;
    await this.cache.setex(key, this.ttl.fileContents, content);
  }

  async invalidateRepository(repo: Repository): Promise<void> {
    // Invalidate all cached data for this repository
    const pattern = `*:${repo.fullName}:*`;
    const keys = await this.cache.keys(pattern);

    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }
}
```

---

## Consequences

### Positive

1. **Flexibility:** Support multiple Git providers with unified interface
2. **Extensibility:** Easy to add new providers (Bitbucket, Azure DevOps)
3. **Reliability:** Caching reduces API calls and improves performance
4. **Security:** Encrypted credential storage, webhook verification
5. **Scalability:** Rate limiting prevents API abuse

### Negative

1. **Complexity:** Managing 4+ provider adapters adds maintenance burden
2. **Feature Parity:** Not all providers support same features
3. **Testing Overhead:** Must test against multiple provider APIs
4. **Cache Invalidation:** Hard to keep cache fresh across providers

### Trade-offs

- **Abstraction vs. Provider-Specific Features:** Abstract interface may not expose all provider features
- **Caching vs. Freshness:** Aggressive caching improves performance but may show stale data
- **OAuth vs. PAT:** OAuth is more secure but requires complex flow; PAT is simple but less secure

---

## Implementation Plan

### Phase 1: Core Abstraction (Week 1-2)
- Define Git provider interface
- Implement provider factory
- Build authentication manager
- Add credential encryption

### Phase 2: GitHub Integration (Week 3-4)
- Implement GitHub provider adapter
- Add OAuth flow
- Test all operations (repos, branches, commits, PRs)
- Add webhook handler

### Phase 3: GitLab Integration (Week 5-6)
- Implement GitLab provider adapter
- Add self-hosted GitLab support
- Test all operations
- Add webhook handler

### Phase 4: Bitbucket & Azure DevOps (Week 7-8)
- Implement Bitbucket adapter
- Implement Azure DevOps adapter
- Test all operations
- Add webhook handlers

### Phase 5: Caching & Optimization (Week 9)
- Implement Redis caching layer
- Add rate limit management
- Optimize API calls

### Phase 6: Testing & Documentation (Week 10)
- End-to-end testing with real repos
- Provider comparison testing
- Write integration docs

---

## Alternatives Considered

### Alternative 1: GitHub Only
**Pros:** Simple, comprehensive API
**Cons:** Miss 20% of market (GitLab, Bitbucket customers)

### Alternative 2: Git CLI Only (No Provider APIs)
**Pros:** Universal, works with all Git servers
**Cons:** No PR creation, webhooks, status checks; slower; requires local cloning

### Alternative 3: Third-Party Abstraction (e.g., Probot)
**Pros:** Pre-built, maintained by community
**Cons:** Limited to GitHub, opinionated architecture, dependency risk

---

## References

- [GitHub REST API](https://docs.github.com/en/rest)
- [GitLab API](https://docs.gitlab.com/ee/api/)
- [Bitbucket Cloud API](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [Webhook Security Best Practices](https://webhooks.fyi/security/overview)

---

**Decision Maker:** CTO + Lead Architect
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
