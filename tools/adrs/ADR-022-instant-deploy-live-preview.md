# ADR-022: Instant Deploy & Live Preview System

## Status
Proposed

## Context

Replit: Click "Run" → instant preview. v0: Instant UI preview. Forge Factory: Create refactoring → wait for PR → review on GitHub → merge. **Too slow.**

**Gap:** Users can't see refactored code running without committing to Git.

## Decision

Implement **instant preview and ephemeral environments**:

### 1. Live Code Preview (Before PR)
- Monaco Editor with instant refactoring preview
- Side-by-side before/after
- Syntax highlighting and error checking
- No Git commit required

### 2. Ephemeral Staging Environments
- Spin up temporary environment with refactored code
- Run tests automatically
- Preview app live
- Destroy after 1 hour

### 3. One-Click Apply
- "Apply to Branch" button
- Creates Git branch + commit + PR automatically
- Or "Apply to Main" for auto-merge (with permissions)

## Implementation

**Live Preview:**
```typescript
import Editor from '@monaco-editor/react'

<SplitPane>
  <Editor
    language="typescript"
    value={originalCode}
    options={{ readOnly: true }}
  />
  <Editor
    language="typescript"
    value={refactoredCode}
    options={{ readOnly: false }}
    onChange={handleEdit}
  />
</SplitPane>
```

**Ephemeral Environment:**
```typescript
// Spin up preview environment
const preview = await apiClient.previews.create({
  refactoringId,
  expiresIn: 3600, // 1 hour
})

// Returns: { url: 'https://preview-abc123.forge.dev', status: 'building' }
```

**One-Click Apply:**
```typescript
<ActionButtons>
  <Button onClick={() => applyToBranch(refactoringId)}>
    Apply to Branch
  </Button>
  <Button onClick={() => createPreview(refactoringId)} variant="outline">
    Preview First
  </Button>
</ActionButtons>
```

## Architecture

```
User clicks "Preview"
       ↓
Backend creates ephemeral container (Docker)
       ↓
Applies refactored code
       ↓
Runs tests (Jest, Vitest, etc.)
       ↓
Starts dev server
       ↓
Returns preview URL
       ↓
Frontend iframe shows preview
```

**Tech Stack:**
- **Docker:** Ephemeral containers
- **Kubernetes:** Orchestration (auto-scale)
- **GitHub Actions:** Run tests
- **Vercel/Netlify:** Preview deploys (integration)

## Consequences

### Positive
- **Time-to-Value:** See results in 10s vs 10 minutes
- **Confidence:** Preview before committing
- **Activation Rate:** +25% when users see instant results
- **Iteration Speed:** 10x faster feedback loop

### Negative
- **Cost:** Ephemeral containers = $0.01-0.10 per preview
- **Complexity:** Docker orchestration, cleanup
- **Security:** Isolated containers required

### Mitigations
- Limit: 10 previews/day for free tier
- Auto-destroy after 1 hour
- Kubernetes autoscaling (only spin up when needed)
- Sandbox security (no network access to production)

## Metrics
- **Preview Usage:** 70%+ of users preview before applying
- **Build Time:** <30s for 90th percentile
- **Success Rate:** 95%+ previews build successfully
- **Cost per Preview:** <$0.05

## References
- [Replit Deployments](https://replit.com/site/deployments)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [GitHub Codespaces](https://github.com/features/codespaces)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
