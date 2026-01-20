# ADR-021: Visual Code Editing & Interactive Previews

## Status
Proposed

## Context

Lovable lets users click on any component to edit it visually. v0 shows instant previews of generated UI. Forge Factory currently shows read-only diffs and code—no visual interaction.

**Gap:** Non-developers (PMs, managers) cannot participate in code refactoring decisions without visual tools.

## Decision

Implement **visual editing interfaces** for code transformation:

### 1. Interactive File Tree with Visual Split Tool
- Drag-and-drop to split files
- Visual indicators for file size/complexity
- Click to preview file contents
- Suggested splits highlighted

### 2. Visual Dependency Graph
- Interactive node graph of file dependencies
- Click nodes to view files
- Hover to see metrics
- Highlight refactoring impact

### 3. Click-to-Edit Refactoring Parameters
- Visual sliders for thresholds (e.g., "Split files over X lines")
- Toggle switches for options
- Preview changes instantly
- No code required

### 4. Side-by-Side Diff Viewer with Inline Edits
- Monaco Editor integration
- Live editing of refactored code
- Accept/reject individual changes
- Real-time syntax highlighting

## Implementation

**File Splitting Tool:**
```typescript
// Visual file tree with drag-to-split
<FileSplittingCanvas
  files={largeFiles}
  onSplit={(file, modules) => createRefactoring(file, modules)}
  previewMode
/>
```

**Dependency Graph:**
```typescript
// React Flow for interactive graph
<DependencyGraph
  nodes={codeFiles}
  edges={dependencies}
  onClick={(node) => viewFile(node.id)}
  highlightImpact={refactoringId}
/>
```

**Visual Refactoring Config:**
```typescript
<RefactoringConfigPanel>
  <Slider
    label="Split files over"
    value={threshold}
    onChange={setThreshold}
    min={100}
    max={1000}
    unit="lines"
  />
  <Toggle
    label="Add type annotations"
    checked={addTypes}
    onChange={setAddTypes}
  />
  <PreviewButton onClick={showPreview} />
</RefactoringConfigPanel>
```

## Tech Stack
- **Monaco Editor:** Code editing (VS Code engine)
- **React Flow:** Dependency graphs
- **D3.js:** File size visualizations
- **Framer Motion:** Smooth animations

## Consequences

### Positive
- Lower barrier: Non-developers can participate
- Faster iteration: Visual = 5x faster than code
- Better understanding: See impact before applying
- Differentiation: Competitors don't have visual tools

### Negative
- Development time: 10 weeks
- Complexity: Canvas rendering, graph algorithms
- Performance: Large codebases = many nodes

### Mitigations
- Start with file splitting tool (highest value)
- Progressive loading for large graphs
- WebGL acceleration for performance

## Metrics
- **Non-Developer Usage:** 30%+ of refactorings approved by non-engineers
- **Time-to-Decision:** 50% faster with visual tools
- **User Satisfaction:** 80%+ prefer visual over code-only

## References
- [React Flow](https://reactflow.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Lovable Visual Editor](https://lovable.dev/)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
