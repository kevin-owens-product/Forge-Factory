# Integration Specifications

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Overview

This document defines the integration architecture for Forge Factory's connections to external systems including source control, CI/CD, issue tracking, communication, and enterprise systems.

---

## Integration Architecture

### Integration Framework

```typescript
// core/integration-framework.ts
export interface Integration {
  id: string;
  type: IntegrationType;
  organizationId: string;
  config: IntegrationConfig;
  credentials: EncryptedCredentials;
  status: IntegrationStatus;
  health: HealthStatus;
}

export enum IntegrationType {
  SOURCE_CONTROL = 'source_control',
  CI_CD = 'ci_cd',
  ISSUE_TRACKING = 'issue_tracking',
  COMMUNICATION = 'communication',
  ITSM = 'itsm',
  IDE = 'ide',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  PENDING_AUTH = 'pending_auth',
}

export interface IntegrationConfig {
  baseUrl?: string;
  webhookUrl?: string;
  settings: Record<string, any>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  consecutiveFailures: number;
  errorMessage?: string;
}
```

---

## Source Control Integrations

### 1. GitHub (Priority: P0)

**Market Share:** 56%
**Implementation Status:** Feature FF-003 (detailed in separate document)

**Capabilities:**
- OAuth 2.0 authentication via GitHub App
- Repository connection and synchronization
- Webhook events (push, pull_request, release)
- Pull request creation and management
- Branch protection rules
- Code review automation
- GitHub Actions integration

**API Endpoints:**
```
POST   /api/v1/integrations/github/connect
GET    /api/v1/integrations/github/repositories
POST   /api/v1/integrations/github/connect-repository
POST   /api/v1/webhooks/github
POST   /api/v1/github/pull-requests
GET    /api/v1/repositories/:id/pull-requests
```

**Webhook Events:**
- `push` - Triggers automatic analysis
- `pull_request` - Analyzes PR changes
- `release` - Comprehensive analysis on release

### 2. GitLab (Priority: P1)

**Market Share:** 38%
**Target:** Enterprise DevSecOps customers

**Authentication:**
- OAuth 2.0 with refresh tokens
- Personal Access Tokens (PAT) for self-hosted
- Project Access Tokens for fine-grained access

**API Integration:**
```typescript
// services/gitlab-service.ts
export class GitLabService {
  async connect(code: string): Promise<GitLabIntegration> {
    // Exchange code for token
    const tokenResponse = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.APP_URL}/api/v1/integrations/gitlab/callback`,
      }),
    });

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();

    // Get user info
    const api = new Gitlab({ oauthToken: access_token });
    const user = await api.Users.current();

    return {
      accessToken: await this.encrypt(access_token),
      refreshToken: await this.encrypt(refresh_token),
      expiresAt: new Date(Date.now() + expires_in * 1000),
      userId: user.id,
      username: user.username,
    };
  }

  async listProjects(integrationId: string): Promise<GitLabProject[]> {
    const integration = await this.getIntegration(integrationId);
    const token = await this.decrypt(integration.accessToken);
    const api = new Gitlab({ oauthToken: token });

    const projects = await api.Projects.all({ membership: true });
    return projects;
  }

  async setupWebhook(projectId: number, token: string): Promise<void> {
    const api = new Gitlab({ oauthToken: token });

    await api.ProjectHooks.add(projectId, `${process.env.APP_URL}/api/v1/webhooks/gitlab`, {
      push_events: true,
      merge_requests_events: true,
      tag_push_events: true,
      token: this.generateWebhookToken(),
    });
  }
}
```

**Webhook Events:**
- `push` - Code changes
- `merge_request` - MR opened/updated
- `tag_push` - Release tags
- `pipeline` - CI/CD pipeline status

**GitLab-Specific Features:**
- Merge Request approvals
- GitLab CI/CD integration
- Security scanning integration (SAST, DAST)
- Container Registry integration

### 3. Bitbucket (Priority: P2)

**Market Share:** Atlassian ecosystem
**Target:** Organizations using Jira/Confluence

**Authentication:**
- OAuth 2.0 (Bitbucket Cloud)
- Personal Access Tokens (Bitbucket Server)

**Key Features:**
- Bitbucket Pipelines integration
- Jira Smart Commits
- Branch permissions
- Pull request decoration

```typescript
// services/bitbucket-service.ts
export class BitbucketService {
  async connect(code: string): Promise<BitbucketIntegration> {
    const tokenResponse = await fetch('https://bitbucket.org/site/oauth2/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }),
    });

    const { access_token, refresh_token } = await tokenResponse.json();

    return {
      accessToken: await this.encrypt(access_token),
      refreshToken: await this.encrypt(refresh_token),
    };
  }

  async createPullRequest(repoSlug: string, params: PRParams): Promise<PullRequest> {
    const { data } = await this.api.post(`/repositories/${repoSlug}/pullrequests`, {
      title: params.title,
      description: params.description,
      source: { branch: { name: params.sourceBranch } },
      destination: { branch: { name: params.destinationBranch } },
    });

    return data;
  }
}
```

### 4. Azure DevOps (Priority: P2)

**Market Share:** Microsoft-centric enterprises
**Target:** Azure cloud customers

**Authentication:**
- OAuth 2.0
- Personal Access Tokens (PAT)

**Features:**
- Azure Repos integration
- Azure Pipelines integration
- Work Items integration
- Boards integration

```typescript
// services/azure-devops-service.ts
export class AzureDevOpsService {
  private baseUrl = 'https://dev.azure.com';

  async connect(code: string): Promise<AzureDevOpsIntegration> {
    // OAuth flow
    const tokenResponse = await fetch('https://app.vssps.visualstudio.com/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: CLIENT_SECRET,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const { access_token } = await tokenResponse.json();

    return {
      accessToken: await this.encrypt(access_token),
    };
  }

  async listRepositories(organization: string, project: string, token: string): Promise<Repo[]> {
    const response = await fetch(
      `${this.baseUrl}/${organization}/${project}/_apis/git/repositories?api-version=7.0`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const { value } = await response.json();
    return value;
  }
}
```

---

## CI/CD Integrations

### 1. GitHub Actions (Priority: P0)

**Integration Type:** Configuration-based
**Approach:** Provide GitHub Actions workflow templates

**Workflow Template:**
```yaml
# .github/workflows/forge-factory.yml
name: Forge Factory Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Forge Factory Analysis
        uses: forge-factory/analyze-action@v1
        with:
          api-key: ${{ secrets.FORGE_FACTORY_API_KEY }}
          repository-id: ${{ secrets.FORGE_FACTORY_REPO_ID }}

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const analysis = require('./forge-factory-results.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Forge Factory Analysis\n\nAI-Readiness Score: ${analysis.score}/100`
            });
```

**GitHub Action (TypeScript):**
```typescript
// actions/analyze/index.ts
import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const apiKey = core.getInput('api-key', { required: true });
    const repositoryId = core.getInput('repository-id', { required: true });

    // Trigger analysis
    const response = await fetch('https://api.forge-factory.dev/api/v1/analysis/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repositoryId,
        commitSha: github.context.sha,
      }),
    });

    const result = await response.json();

    // Poll for completion
    let analysis;
    while (true) {
      const statusResponse = await fetch(
        `https://api.forge-factory.dev/api/v1/analysis/${result.id}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      analysis = await statusResponse.json();

      if (analysis.status === 'completed') break;
      if (analysis.status === 'failed') {
        throw new Error('Analysis failed');
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }

    // Set outputs
    core.setOutput('analysis-id', analysis.id);
    core.setOutput('ai-readiness-score', analysis.aiReadinessScore);

    // Write results file
    await fs.writeFile('./forge-factory-results.json', JSON.stringify(analysis, null, 2));

    // Fail if score below threshold
    const threshold = parseInt(core.getInput('min-score') || '0');
    if (analysis.aiReadinessScore < threshold) {
      core.setFailed(`AI-Readiness Score ${analysis.aiReadinessScore} below threshold ${threshold}`);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
```

### 2. GitLab CI (Priority: P1)

**Integration Type:** Pipeline integration

**.gitlab-ci.yml Template:**
```yaml
forge_factory_analysis:
  stage: test
  image: forge-factory/cli:latest
  script:
    - forge-factory analyze --repo-id $FORGE_FACTORY_REPO_ID
  only:
    - main
    - merge_requests
  artifacts:
    reports:
      forge_factory: forge-factory-report.json
```

### 3. Jenkins (Priority: P1)

**Market Share:** 44% in large enterprises
**Integration Type:** Jenkins plugin

**Plugin Structure:**
```java
// src/main/java/dev/forgefactory/jenkins/ForgeFactoryBuilder.java
public class ForgeFactoryBuilder extends Builder {
    private String apiKey;
    private String repositoryId;

    @Override
    public boolean perform(AbstractBuild build, Launcher launcher, BuildListener listener) {
        try {
            // Call Forge Factory API
            String analysisId = triggerAnalysis(apiKey, repositoryId, build.getEnvironment().get("GIT_COMMIT"));

            // Wait for completion
            AnalysisResult result = pollForCompletion(apiKey, analysisId);

            // Add build action with results
            build.addAction(new ForgeFactoryBuildAction(result));

            // Fail build if below threshold
            if (result.getAiReadinessScore() < minScore) {
                listener.getLogger().println("AI-Readiness score below threshold");
                return false;
            }

            return true;
        } catch (Exception e) {
            listener.error("Forge Factory analysis failed: " + e.getMessage());
            return false;
        }
    }
}
```

### 4. CircleCI (Priority: P2)

**Orb Configuration:**
```yaml
# .circleci/config.yml
version: 2.1

orbs:
  forge-factory: forge-factory/analyze@1.0.0

workflows:
  main:
    jobs:
      - forge-factory/analyze:
          api-key: $FORGE_FACTORY_API_KEY
          repository-id: $FORGE_FACTORY_REPO_ID
```

---

## Issue Tracking Integrations

### 1. Jira (Priority: P0)

**Market Share:** Dominant in enterprise
**Use Cases:**
- Create issues for critical findings
- Link refactoring jobs to epics
- Update issue status on PR merge

**Authentication:**
- OAuth 2.0 (Jira Cloud)
- Personal Access Tokens (Jira Server)

```typescript
// services/jira-service.ts
export class JiraService {
  async createIssue(params: {
    project: string;
    summary: string;
    description: string;
    issueType: string;
    priority?: string;
  }): Promise<JiraIssue> {
    const response = await fetch(`${this.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: params.project },
          summary: params.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: params.description }],
              },
            ],
          },
          issuetype: { name: params.issueType },
          priority: params.priority ? { name: params.priority } : undefined,
        },
      }),
    });

    return await response.json();
  }

  async linkIssue(issueKey: string, linkType: string, targetIssueKey: string): Promise<void> {
    await fetch(`${this.baseUrl}/rest/api/3/issueLink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: { name: linkType },
        inwardIssue: { key: issueKey },
        outwardIssue: { key: targetIssueKey },
      }),
    });
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transition: { id: transitionId },
      }),
    });
  }
}
```

**Automation Example:**
```typescript
// When critical security issue is found
async function handleCriticalFinding(finding: SecurityFinding, repository: Repository) {
  const jiraService = await getJiraService(repository.organizationId);

  const issue = await jiraService.createIssue({
    project: repository.settings.jiraProject,
    summary: `[Security] ${finding.title} in ${repository.name}`,
    description: `
**Severity:** ${finding.severity}
**File:** ${finding.filePath}
**Line:** ${finding.line}

**Description:**
${finding.description}

**Recommendation:**
${finding.recommendation}

**Detected by:** Forge Factory AI Analysis
**Analysis ID:** ${finding.analysisId}
    `,
    issueType: 'Bug',
    priority: 'Critical',
  });

  // Store link
  await db.issueLinkage.create({
    data: {
      issueTracker: 'jira',
      externalId: issue.key,
      sourceType: 'security_finding',
      sourceId: finding.id,
    },
  });
}
```

### 2. Linear (Priority: P2)

**Target:** Modern startups and tech companies

```typescript
// services/linear-service.ts
import { LinearClient } from '@linear/sdk';

export class LinearService {
  private client: LinearClient;

  async createIssue(params: {
    teamId: string;
    title: string;
    description: string;
    priority?: number;
  }): Promise<LinearIssue> {
    const issue = await this.client.createIssue({
      teamId: params.teamId,
      title: params.title,
      description: params.description,
      priority: params.priority,
    });

    return issue;
  }
}
```

---

## Communication Integrations

### 1. Slack (Priority: P0)

**Use Cases:**
- Analysis completion notifications
- PR creation alerts
- Daily/weekly digest reports
- Interactive commands

**Authentication:** OAuth 2.0 with Bot Token

```typescript
// services/slack-service.ts
import { WebClient } from '@slack/web-api';

export class SlackService {
  private client: WebClient;

  async sendMessage(channel: string, message: string): Promise<void> {
    await this.client.chat.postMessage({
      channel,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    });
  }

  async sendAnalysisComplete(channel: string, analysis: AnalysisRun): Promise<void> {
    await this.client.chat.postMessage({
      channel,
      text: `Analysis complete for ${analysis.repository.name}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 Analysis Complete',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Repository:*\n${analysis.repository.name}`,
            },
            {
              type: 'mrkdwn',
              text: `*AI-Readiness Score:*\n${analysis.aiReadinessScore}/100 ${getScoreEmoji(analysis.aiReadinessScore)}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Details',
              },
              url: `https://app.forge-factory.dev/analysis/${analysis.id}`,
              style: 'primary',
            },
          ],
        },
      ],
    });
  }

  async handleCommand(command: SlackCommand): Promise<void> {
    switch (command.command) {
      case '/forge-analyze':
        await this.handleAnalyzeCommand(command);
        break;
      case '/forge-status':
        await this.handleStatusCommand(command);
        break;
    }
  }
}
```

### 2. Microsoft Teams (Priority: P1)

**Target:** Microsoft-centric enterprises

```typescript
// services/teams-service.ts
export class TeamsService {
  async sendCard(webhookUrl: string, analysis: AnalysisRun): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: 'Analysis Complete',
        sections: [
          {
            activityTitle: 'Forge Factory Analysis Complete',
            activitySubtitle: analysis.repository.name,
            facts: [
              { name: 'AI-Readiness Score', value: `${analysis.aiReadinessScore}/100` },
              { name: 'Test Coverage', value: `${analysis.testCoveragePercent}%` },
              { name: 'Documentation', value: `${analysis.documentationPercent}%` },
            ],
          },
        ],
        potentialAction: [
          {
            '@type': 'OpenUri',
            name: 'View Details',
            targets: [
              { os: 'default', uri: `https://app.forge-factory.dev/analysis/${analysis.id}` },
            ],
          },
        ],
      }),
    });
  }
}
```

---

## IDE Integrations

### 1. VS Code Extension (Priority: P0)

**Market Share:** 73.6% of developers

**Extension Structure:**
```typescript
// extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('forge-factory.analyze', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      // Trigger analysis
      const panel = vscode.window.createWebviewPanel(
        'forgeFactoryAnalysis',
        'Forge Factory Analysis',
        vscode.ViewColumn.One,
        {},
      );

      panel.webview.html = getWebviewContent();

      // Call API
      const analysis = await triggerAnalysis(workspaceFolder.uri.fsPath);

      // Update webview
      panel.webview.postMessage({ type: 'analysisComplete', analysis });
    }),
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = '$(beaker) Forge Factory';
  statusBarItem.command = 'forge-factory.analyze';
  statusBarItem.show();
}
```

### 2. JetBrains Plugin (Priority: P1)

**Target:** 62% of JVM developers

**Plugin Structure:**
```kotlin
// ForgeFactoryPlugin.kt
class ForgeFactoryPlugin : DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val contentFactory = ContentFactory.SERVICE.getInstance()
        val panel = ForgeFactoryPanel(project)
        val content = contentFactory.createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

class ForgeFactoryPanel(private val project: Project) : JPanel() {
    init {
        layout = BorderLayout()

        val button = JButton("Analyze Repository")
        button.addActionListener {
            runAnalysis()
        }

        add(button, BorderLayout.NORTH)
    }

    private fun runAnalysis() {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Running Forge Factory Analysis") {
            override fun run(indicator: ProgressIndicator) {
                // Call API
                val api = ForgeFactoryAPI(settings.apiKey)
                val analysis = api.analyze(project.basePath)

                // Show results
                ApplicationManager.getApplication().invokeLater {
                    showResults(analysis)
                }
            }
        })
    }
}
```

---

## ITSM Integration

### ServiceNow (Priority: P2)

**Target:** Enterprise incident management

```typescript
// services/servicenow-service.ts
export class ServiceNowService {
  async createIncident(params: {
    shortDescription: string;
    description: string;
    priority: number;
    category: string;
  }): Promise<ServiceNowIncident> {
    const response = await fetch(`${this.baseUrl}/api/now/table/incident`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        short_description: params.shortDescription,
        description: params.description,
        priority: params.priority,
        category: params.category,
      }),
    });

    return await response.json();
  }
}
```

---

## Integration Testing Strategy

### Mock Providers
```typescript
// tests/mocks/github-mock.ts
export class GitHubMock {
  private webhookHandlers: Map<string, Function> = new Map();

  simulateWebhook(event: string, payload: any) {
    const handler = this.webhookHandlers.get(event);
    if (handler) {
      handler(payload);
    }
  }

  mockCreatePullRequest(owner: string, repo: string): Promise<any> {
    return Promise.resolve({
      number: 123,
      html_url: 'https://github.com/owner/repo/pull/123',
      state: 'open',
    });
  }
}
```

### Integration Tests
```typescript
// tests/integrations.test.ts
describe('GitHub Integration', () => {
  it('handles push webhook', async () => {
    const mock = new GitHubMock();

    await mock.simulateWebhook('push', {
      repository: { id: 123 },
      after: 'abc123',
    });

    // Verify analysis was triggered
    expect(analysisQueue).toHaveBeenCalled();
  });
});
```

---

## Monitoring & Health Checks

### Health Check Endpoint
```typescript
// routes/health.ts
fastify.get('/api/v1/integrations/health', async (request, reply) => {
  const integrations = await db.integration.findMany({
    where: { organizationId: request.user.organizationId },
  });

  const health = await Promise.all(
    integrations.map(async (integration) => {
      const status = await checkIntegrationHealth(integration);
      return {
        id: integration.id,
        type: integration.type,
        status: status.healthy ? 'healthy' : 'unhealthy',
        latencyMs: status.latencyMs,
      };
    }),
  );

  return health;
});
```

---

**Status:** Living document - update as new integrations are added
