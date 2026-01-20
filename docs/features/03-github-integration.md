# FF-003: GitHub Integration

**Status**: Ready for Implementation
**Priority**: P0 (Critical Path)
**Estimated Effort**: 4 weeks
**Dependencies**: FF-001 (Repository Analyzer)

## Overview

GitHub Integration enables users to connect their GitHub accounts, select repositories, and automatically trigger analyses via webhooks.

## Goals

- **Seamless OAuth**: Connect GitHub account in < 60 seconds
- **Repository Selection**: Browse and select repos with search/filter
- **Webhook Automation**: Auto-trigger analysis on push/PR events
- **PR Integration**: Create PRs with refactoring suggestions
- **99.9% Webhook Delivery**: Reliable event processing

## Architecture

```
User → OAuth Flow → GitHub App → Webhook → Analysis Queue
```

## API Endpoints

### Connect GitHub Account
```
POST /api/v1/integrations/github/connect
Response: { authorization_url: "https://github.com/login/oauth/authorize..." }
```

### OAuth Callback
```
GET /api/v1/integrations/github/callback?code=abc123
Response: { installation_id: "inst_123", repositories: [...] }
```

### List Repositories
```
GET /api/v1/integrations/github/repositories
Response: { data: [{ id, name, full_name, private, language }] }
```

### Install Webhook
```
POST /api/v1/integrations/github/webhooks
Body: { repository_id: "repo_123", events: ["push", "pull_request"] }
Response: { webhook_id: "hook_456", secret: "whsec_..." }
```

## Implementation

### OAuth Flow
- GitHub App with permissions: `repo`, `read:org`, `webhook`
- Callback URL: `https://forgefactory.dev/api/auth/github/callback`
- Store access token encrypted in database

### Webhook Processing
- Verify signature (HMAC-SHA256)
- Queue analysis job for push events
- Comment on PR for pull_request events

### Rate Limiting
- GitHub API: 5000 req/hour
- Use conditional requests (ETag) to save quota
- Implement exponential backoff on 403

## Acceptance Criteria

- [ ] OAuth flow completes in < 60s
- [ ] Webhook events processed in < 5s
- [ ] PR creation in < 10s
- [ ] 99.9% webhook delivery rate
- [ ] Zero secrets leaked in logs

---

**Version**: 1.0
**Last Updated**: 2026-01-20
