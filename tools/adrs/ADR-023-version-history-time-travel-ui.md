# ADR-023: Version History & Time Travel UI

## Status
Proposed

## Context

Lovable shows a visual timeline of changes with one-click preview/rollback. Forge Factory relies on Git history (external to app). **Users want visual time travel.**

**Gap:** No way to see "what did my codebase look like before refactoring X?" without Git CLI.

## Decision

Implement **visual version history with time travel UI**:

### 1. Visual Timeline Component
- Horizontal timeline of refactorings
- Click any point to preview that version
- Animated transitions between versions
- Branch visualization

### 2. One-Click Undo/Redo
- "Undo Last Refactoring" button
- Redo stack
- Undo entire branch of refactorings
- Rollback with single click

### 3. Version Comparison View
- Select two versions → see diff
- Metrics comparison (AI score before/after)
- File-by-file changes
- Impact visualization

### 4. Audit Trail
- Who applied what refactoring, when
- Approval history
- Comment thread attached to each version
- Export as PDF for compliance

## Implementation

**Timeline Component:**
```typescript
<VersionTimeline
  versions={refactoringHistory}
  currentVersion={currentVersion}
  onSelect={(version) => previewVersion(version)}
>
  {versions.map((v) => (
    <TimelinePoint
      key={v.id}
      version={v}
      label={v.name}
      icon={<SparklesIcon />}
      timestamp={v.createdAt}
    />
  ))}
</VersionTimeline>
```

**Undo/Redo:**
```typescript
const { undo, redo, canUndo, canRedo } = useVersionControl(repositoryId)

<ButtonGroup>
  <Button onClick={undo} disabled={!canUndo}>
    <UndoIcon /> Undo
  </Button>
  <Button onClick={redo} disabled={!canRedo}>
    <RedoIcon /> Redo
  </Button>
</ButtonGroup>
```

**Version Comparison:**
```typescript
<VersionComparison
  versionA={beforeVersion}
  versionB={afterVersion}
>
  <MetricsComparison before={beforeMetrics} after={afterMetrics} />
  <FileDiffViewer changes={diffsBetweenVersions} />
  <ImpactChart data={impactData} />
</VersionComparison>
```

## Data Model

```typescript
interface Version {
  id: string
  refactoringId: string
  repositoryId: string
  createdAt: Date
  appliedBy: User
  snapshot: {
    files: Record<string, string> // file path → content
    metrics: AIReadinessMetrics
    gitCommit?: string
  }
  parent?: string // Previous version ID
  children: string[] // Next versions (branches)
}
```

## UI Features

### Visual Timeline
```
Jan 15          Jan 18          Jan 20          Today
  │               │               │               │
  ●───────────────●───────────────●───────────────●
Split files    Add types    Generate tests   Current
(AI: 62)       (AI: 70)     (AI: 78)        (AI: 78)

[Click any point to preview that version]
```

### Branch Visualization
```
        ●─── Add types ──●─── Merge
       /                 \
Main ●                     ●─── Current
       \                   /
        ●─── Split files ─●
```

## Tech Stack
- **D3.js:** Timeline visualization
- **Framer Motion:** Animated transitions
- **React-Diff-Viewer:** Code diffs
- **Recharts:** Metrics comparison

## Consequences

### Positive
- **Trust:** Users feel safe experimenting
- **Learning:** Visual history helps understand changes
- **Compliance:** Audit trail for enterprise
- **Differentiation:** Unique feature vs competitors

### Negative
- **Storage:** Each version = snapshot of code
- **Performance:** Large repos = many versions to render
- **Complexity:** Branch merging logic

### Mitigations
- Store diffs, not full snapshots (delta compression)
- Lazy load timeline (paginate old versions)
- Cache metrics (don't recompute)
- Limit: Keep 100 versions per repo (configurable)

## Metrics
- **Undo Usage:** 20%+ of users undo at least once
- **Preview Usage:** 50%+ click timeline to preview
- **Confidence:** 85%+ feel more confident with undo
- **Audit Exports:** 10%+ of enterprise customers export audit logs

## References
- [Linear History](https://linear.app/) - Beautiful timeline UX
- [Figma Version History](https://www.figma.com/blog/how-we-built-version-history/) - Time travel UI
- [GitHub History](https://github.com/) - Git timeline

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
