# ADR-050: Dependency Graph & Impact Analysis

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Code changes can have **cascading effects** throughout a codebase. Before making any transformation, we need to understand the full impact: what files will be affected, what tests need to run, and what risks exist. A dependency graph enables this analysis.

### Business Requirements

- **Scope:** Analyze dependencies for 1M+ LOC codebases
- **Accuracy:** >99% accuracy for direct dependencies
- **Speed:** Build graph in <60 seconds for 100K LOC
- **Types:** Import dependencies, type dependencies, runtime dependencies
- **Visualization:** Generate visual dependency graphs
- **Impact Prediction:** Predict ripple effects of changes

### Dependency Types

| Type | Description | Detection Method |
|------|-------------|------------------|
| Import | ES6/CommonJS imports | Static AST analysis |
| Type | TypeScript type references | Type checker |
| Inheritance | Class extends/implements | AST analysis |
| Call | Function/method calls | Data flow analysis |
| Runtime | Dynamic imports, require() | Runtime analysis |
| Indirect | Transitive dependencies | Graph traversal |

### Analysis Challenges

1. **Dynamic Imports:** `import(variable)` can't be statically analyzed
2. **Circular Dependencies:** A → B → C → A creates cycles
3. **Re-exports:** `export * from` hides actual source
4. **Monorepo Scale:** Cross-package dependencies
5. **External Dependencies:** node_modules, pip packages

---

## Decision

We will implement a **multi-layer dependency graph system** with:

1. **Graph Builder** - Construct dependency graph from code
2. **Impact Analyzer** - Predict change effects
3. **Cycle Detector** - Find and report circular dependencies
4. **Visualization Engine** - Generate interactive diagrams
5. **Change Risk Calculator** - Assess transformation risks

### Architecture Overview

```typescript
interface DependencyGraphSystem {
  // Graph construction
  buildGraph(repository: Repository): Promise<DependencyGraph>;

  // Analysis
  analyzeImpact(changes: Change[]): Promise<ImpactAnalysis>;
  detectCycles(): Promise<Cycle[]>;
  findUnusedCode(): Promise<UnusedCode[]>;

  // Queries
  getDependencies(file: string): Promise<Dependency[]>;
  getDependents(file: string): Promise<Dependent[]>;
  getTransitiveDependencies(file: string, depth: number): Promise<Dependency[]>;

  // Visualization
  generateVisualization(options: VisOptions): Promise<Diagram>;
}

interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  metadata: GraphMetadata;

  // Queries
  getNode(id: string): GraphNode | undefined;
  getEdgesFrom(nodeId: string): GraphEdge[];
  getEdgesTo(nodeId: string): GraphEdge[];
  topologicalSort(): GraphNode[];
}

interface GraphNode {
  id: string;                    // File path or module name
  type: NodeType;                // 'file' | 'module' | 'package' | 'external'
  exports: Export[];             // What this node exports
  imports: Import[];             // What this node imports
  size: number;                  // Lines of code
  complexity: number;            // Cyclomatic complexity
  testCoverage: number;          // Test coverage percentage
}

interface GraphEdge {
  from: string;                  // Source node ID
  to: string;                    // Target node ID
  type: EdgeType;                // 'import' | 'type' | 'call' | 'inherit'
  symbols: string[];             // Specific symbols imported
  isDynamic: boolean;            // Is this a dynamic import?
  weight: number;                // Dependency strength (0-1)
}
```

### Component 1: Graph Builder

Build comprehensive dependency graph from source code.

```typescript
class DependencyGraphBuilder {
  constructor(
    private parser: MultiLanguageParser,
    private typeChecker: TypeChecker,
    private config: GraphBuilderConfig
  ) {}

  async buildGraph(repository: Repository): Promise<DependencyGraph> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Phase 1: Create nodes for all files
    for (const file of repository.files) {
      const node = await this.createNode(file);
      nodes.set(file.path, node);
    }

    // Phase 2: Extract dependencies
    for (const file of repository.files) {
      const deps = await this.extractDependencies(file, nodes);
      edges.push(...deps);
    }

    // Phase 3: Add type dependencies (for TypeScript)
    if (repository.language === 'typescript') {
      const typeDeps = await this.extractTypeDependencies(repository);
      edges.push(...typeDeps);
    }

    // Phase 4: Add external dependencies
    const externalDeps = await this.analyzeExternalDependencies(repository);
    for (const ext of externalDeps) {
      nodes.set(ext.id, ext);
    }

    return new DependencyGraph(nodes, edges, {
      totalNodes: nodes.size,
      totalEdges: edges.length,
      builtAt: new Date(),
      repository: repository.name,
    });
  }

  private async extractDependencies(
    file: SourceFile,
    nodes: Map<string, GraphNode>
  ): Promise<GraphEdge[]> {
    const ast = await this.parser.parse(file);
    const edges: GraphEdge[] = [];

    // Find all import statements
    const imports = this.findImports(ast);

    for (const imp of imports) {
      const resolvedPath = this.resolveImportPath(imp.source, file.path);

      edges.push({
        from: file.path,
        to: resolvedPath,
        type: this.determineEdgeType(imp),
        symbols: imp.specifiers.map(s => s.imported || s.local),
        isDynamic: imp.isDynamic,
        weight: this.calculateWeight(imp),
      });
    }

    // Find require() calls
    const requires = this.findRequires(ast);

    for (const req of requires) {
      if (req.argument.type === 'Literal') {
        const resolvedPath = this.resolveImportPath(req.argument.value, file.path);

        edges.push({
          from: file.path,
          to: resolvedPath,
          type: 'import',
          symbols: [],
          isDynamic: false,
          weight: 0.8,
        });
      } else {
        // Dynamic require - mark as dynamic
        edges.push({
          from: file.path,
          to: 'DYNAMIC',
          type: 'import',
          symbols: [],
          isDynamic: true,
          weight: 0.5,
        });
      }
    }

    return edges;
  }

  private async extractTypeDependencies(repository: Repository): Promise<GraphEdge[]> {
    const program = ts.createProgram(
      repository.files.map(f => f.path),
      { strict: true }
    );

    const checker = program.getTypeChecker();
    const edges: GraphEdge[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      const dependencies = this.findTypeDependencies(sourceFile, checker);

      for (const dep of dependencies) {
        edges.push({
          from: sourceFile.fileName,
          to: dep.file,
          type: 'type',
          symbols: [dep.symbol],
          isDynamic: false,
          weight: 0.6,
        });
      }
    }

    return edges;
  }

  private findTypeDependencies(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker
  ): TypeDependency[] {
    const dependencies: TypeDependency[] = [];

    const visit = (node: ts.Node) => {
      // Type references
      if (ts.isTypeReferenceNode(node)) {
        const symbol = checker.getSymbolAtLocation(node.typeName);
        if (symbol) {
          const decl = symbol.declarations?.[0];
          if (decl && decl.getSourceFile() !== sourceFile) {
            dependencies.push({
              file: decl.getSourceFile().fileName,
              symbol: symbol.name,
            });
          }
        }
      }

      // Class heritage
      if (ts.isHeritageClause(node)) {
        for (const type of node.types) {
          const symbol = checker.getSymbolAtLocation(type.expression);
          if (symbol) {
            const decl = symbol.declarations?.[0];
            if (decl && decl.getSourceFile() !== sourceFile) {
              dependencies.push({
                file: decl.getSourceFile().fileName,
                symbol: symbol.name,
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return dependencies;
  }

  private calculateWeight(imp: ImportStatement): number {
    // Weight based on import type and usage
    let weight = 0.7; // Base weight

    // Default imports are often more significant
    if (imp.specifiers.some(s => s.type === 'default')) {
      weight += 0.1;
    }

    // Namespace imports suggest heavy usage
    if (imp.specifiers.some(s => s.type === 'namespace')) {
      weight += 0.15;
    }

    // Many named imports suggest strong coupling
    if (imp.specifiers.length > 5) {
      weight += 0.05;
    }

    return Math.min(weight, 1);
  }
}
```

### Component 2: Impact Analyzer

Predict the impact of code changes.

```typescript
class ImpactAnalyzer {
  constructor(private graph: DependencyGraph) {}

  async analyzeImpact(changes: Change[]): Promise<ImpactAnalysis> {
    const directlyAffected = new Set<string>();
    const transitivelyAffected = new Set<string>();
    const testFilesAffected = new Set<string>();

    for (const change of changes) {
      // Add directly changed file
      directlyAffected.add(change.file);

      // Find all dependents (files that import this file)
      const dependents = this.graph.getEdgesTo(change.file);

      for (const dep of dependents) {
        // Check if the change affects imported symbols
        if (this.changeAffectsEdge(change, dep)) {
          directlyAffected.add(dep.from);

          // Recursively find transitive dependents
          const transitive = await this.findTransitiveDependents(dep.from, 3);
          for (const t of transitive) {
            transitivelyAffected.add(t);
          }
        }
      }
    }

    // Find affected test files
    for (const file of [...directlyAffected, ...transitivelyAffected]) {
      const testFiles = this.findRelatedTests(file);
      for (const test of testFiles) {
        testFilesAffected.add(test);
      }
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      directlyAffected,
      transitivelyAffected,
      changes
    );

    return {
      changes,
      directlyAffected: Array.from(directlyAffected),
      transitivelyAffected: Array.from(transitivelyAffected),
      testFilesAffected: Array.from(testFilesAffected),
      totalFilesAffected: directlyAffected.size + transitivelyAffected.size,
      riskScore,
      recommendations: this.generateRecommendations(riskScore, changes),
    };
  }

  private changeAffectsEdge(change: Change, edge: GraphEdge): boolean {
    // If change modifies exported symbols that edge imports
    const changedExports = change.modifiedExports || [];
    const importedSymbols = edge.symbols;

    // Namespace import - always affected
    if (importedSymbols.length === 0) {
      return true;
    }

    // Check for overlap
    return changedExports.some(exp => importedSymbols.includes(exp));
  }

  private async findTransitiveDependents(
    file: string,
    maxDepth: number
  ): Promise<string[]> {
    const dependents = new Set<string>();
    const visited = new Set<string>();

    const traverse = (currentFile: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentFile)) {
        return;
      }

      visited.add(currentFile);

      const edges = this.graph.getEdgesTo(currentFile);
      for (const edge of edges) {
        dependents.add(edge.from);
        traverse(edge.from, depth + 1);
      }
    };

    traverse(file, 0);
    return Array.from(dependents);
  }

  private calculateRiskScore(
    directlyAffected: Set<string>,
    transitivelyAffected: Set<string>,
    changes: Change[]
  ): RiskScore {
    let score = 0;
    const factors: RiskFactor[] = [];

    // Factor 1: Number of files affected
    const totalAffected = directlyAffected.size + transitivelyAffected.size;
    if (totalAffected > 100) {
      score += 30;
      factors.push({ name: 'Large blast radius', contribution: 30 });
    } else if (totalAffected > 50) {
      score += 20;
      factors.push({ name: 'Moderate blast radius', contribution: 20 });
    } else if (totalAffected > 10) {
      score += 10;
      factors.push({ name: 'Small blast radius', contribution: 10 });
    }

    // Factor 2: Critical path changes
    for (const change of changes) {
      const node = this.graph.getNode(change.file);
      if (node && this.isCriticalPath(node)) {
        score += 25;
        factors.push({ name: `Critical file: ${change.file}`, contribution: 25 });
      }
    }

    // Factor 3: Test coverage of affected files
    const avgCoverage = this.calculateAverageCoverage(directlyAffected);
    if (avgCoverage < 50) {
      score += 20;
      factors.push({ name: 'Low test coverage', contribution: 20 });
    } else if (avgCoverage < 80) {
      score += 10;
      factors.push({ name: 'Moderate test coverage', contribution: 10 });
    }

    // Factor 4: Breaking changes
    for (const change of changes) {
      if (change.isBreaking) {
        score += 15;
        factors.push({ name: `Breaking change: ${change.description}`, contribution: 15 });
      }
    }

    return {
      score: Math.min(score, 100),
      level: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      factors,
    };
  }

  private isCriticalPath(node: GraphNode): boolean {
    // High number of dependents = critical path
    const dependents = this.graph.getEdgesTo(node.id);
    return dependents.length > 20;
  }

  private generateRecommendations(riskScore: RiskScore, changes: Change[]): string[] {
    const recommendations: string[] = [];

    if (riskScore.level === 'high') {
      recommendations.push('Consider breaking this change into smaller, incremental changes');
      recommendations.push('Run full test suite before merging');
      recommendations.push('Schedule deployment during low-traffic period');
    }

    if (riskScore.factors.some(f => f.name.includes('coverage'))) {
      recommendations.push('Add tests for affected files before proceeding');
    }

    if (riskScore.factors.some(f => f.name.includes('Breaking'))) {
      recommendations.push('Update all dependent code before merging');
      recommendations.push('Consider using feature flags for gradual rollout');
    }

    return recommendations;
  }
}
```

### Component 3: Cycle Detector

Find and report circular dependencies.

```typescript
class CycleDetector {
  constructor(private graph: DependencyGraph) {}

  detectCycles(): Cycle[] {
    const cycles: Cycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const edges = this.graph.getEdgesFrom(nodeId);

      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          if (dfs(edge.to)) {
            return true;
          }
        } else if (recursionStack.has(edge.to)) {
          // Found a cycle
          const cycleStart = path.indexOf(edge.to);
          const cyclePath = [...path.slice(cycleStart), edge.to];

          cycles.push({
            nodes: cyclePath,
            severity: this.calculateCycleSeverity(cyclePath),
            suggestion: this.generateCycleFix(cyclePath),
          });
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    // Run DFS from each unvisited node
    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  private calculateCycleSeverity(cyclePath: string[]): CycleSeverity {
    // Longer cycles are harder to fix
    if (cyclePath.length > 5) {
      return 'high';
    }

    // Cycles involving core modules are more severe
    const hasCoreModule = cyclePath.some(p =>
      p.includes('/core/') || p.includes('/shared/')
    );

    if (hasCoreModule) {
      return 'high';
    }

    if (cyclePath.length > 3) {
      return 'medium';
    }

    return 'low';
  }

  private generateCycleFix(cyclePath: string[]): CycleFix {
    // Find the weakest link in the cycle
    let weakestEdge = { from: '', to: '', weight: 1 };

    for (let i = 0; i < cyclePath.length - 1; i++) {
      const edges = this.graph.getEdgesFrom(cyclePath[i]);
      const edge = edges.find(e => e.to === cyclePath[i + 1]);

      if (edge && edge.weight < weakestEdge.weight) {
        weakestEdge = edge;
      }
    }

    return {
      breakAt: { from: weakestEdge.from, to: weakestEdge.to },
      strategy: this.determineCycleBreakStrategy(weakestEdge),
      effort: this.estimateFixEffort(cyclePath),
    };
  }

  private determineCycleBreakStrategy(edge: GraphEdge): CycleBreakStrategy {
    // If only importing types, suggest splitting types
    if (edge.type === 'type') {
      return {
        name: 'Extract types to shared module',
        description: 'Move shared types to a separate module that both files can import',
      };
    }

    // If importing few symbols, suggest dependency injection
    if (edge.symbols.length <= 2) {
      return {
        name: 'Dependency injection',
        description: 'Pass the dependency as a parameter instead of importing directly',
      };
    }

    // Default: extract shared functionality
    return {
      name: 'Extract shared module',
      description: 'Create a new module with shared functionality that both can import',
    };
  }
}
```

### Component 4: Visualization Engine

Generate interactive dependency visualizations.

```typescript
class VisualizationEngine {
  constructor(private graph: DependencyGraph) {}

  generateVisualization(options: VisOptions): Visualization {
    switch (options.format) {
      case 'mermaid':
        return this.generateMermaid(options);
      case 'd3':
        return this.generateD3(options);
      case 'graphviz':
        return this.generateGraphviz(options);
      default:
        return this.generateMermaid(options);
    }
  }

  private generateMermaid(options: VisOptions): MermaidVisualization {
    const filteredGraph = this.filterGraph(options);

    let diagram = 'graph LR\n';

    // Add nodes with styling
    for (const [id, node] of filteredGraph.nodes) {
      const shortId = this.shortenId(id);
      const style = this.getNodeStyle(node);
      diagram += `    ${shortId}[${node.type === 'external' ? '📦 ' : ''}${path.basename(id)}]${style}\n`;
    }

    // Add edges
    for (const edge of filteredGraph.edges) {
      const fromId = this.shortenId(edge.from);
      const toId = this.shortenId(edge.to);
      const style = this.getEdgeStyle(edge);
      diagram += `    ${fromId} -->${style} ${toId}\n`;
    }

    // Add subgraphs for directories
    if (options.groupByDirectory) {
      diagram = this.addDirectorySubgraphs(diagram, filteredGraph);
    }

    return {
      format: 'mermaid',
      code: diagram,
      metadata: {
        nodeCount: filteredGraph.nodes.size,
        edgeCount: filteredGraph.edges.length,
      },
    };
  }

  private generateD3(options: VisOptions): D3Visualization {
    const filteredGraph = this.filterGraph(options);

    const nodes = Array.from(filteredGraph.nodes.entries()).map(([id, node]) => ({
      id,
      name: path.basename(id),
      type: node.type,
      size: node.size,
      complexity: node.complexity,
      dependencyCount: this.graph.getEdgesFrom(id).length,
      dependentCount: this.graph.getEdgesTo(id).length,
    }));

    const links = filteredGraph.edges.map(edge => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
      weight: edge.weight,
    }));

    return {
      format: 'd3',
      data: { nodes, links },
      config: {
        width: options.width || 1200,
        height: options.height || 800,
        nodeRadius: 8,
        linkDistance: 100,
        charge: -300,
      },
    };
  }

  private filterGraph(options: VisOptions): DependencyGraph {
    let nodes = new Map(this.graph.nodes);
    let edges = [...this.graph.edges];

    // Filter by path pattern
    if (options.pathPattern) {
      const regex = new RegExp(options.pathPattern);
      nodes = new Map(
        Array.from(nodes.entries()).filter(([id]) => regex.test(id))
      );

      edges = edges.filter(e =>
        nodes.has(e.from) && nodes.has(e.to)
      );
    }

    // Filter by depth from root
    if (options.rootFile && options.maxDepth) {
      const reachable = this.getReachableNodes(options.rootFile, options.maxDepth);
      nodes = new Map(
        Array.from(nodes.entries()).filter(([id]) => reachable.has(id))
      );

      edges = edges.filter(e =>
        nodes.has(e.from) && nodes.has(e.to)
      );
    }

    // Hide external dependencies
    if (!options.showExternal) {
      nodes = new Map(
        Array.from(nodes.entries()).filter(([, node]) => node.type !== 'external')
      );

      edges = edges.filter(e =>
        nodes.has(e.from) && nodes.has(e.to)
      );
    }

    return new DependencyGraph(nodes, edges, this.graph.metadata);
  }

  private getReachableNodes(rootFile: string, maxDepth: number): Set<string> {
    const reachable = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [{ node: rootFile, depth: 0 }];

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (depth > maxDepth || reachable.has(node)) {
        continue;
      }

      reachable.add(node);

      // Add dependencies
      const deps = this.graph.getEdgesFrom(node);
      for (const dep of deps) {
        queue.push({ node: dep.to, depth: depth + 1 });
      }

      // Add dependents
      const dependents = this.graph.getEdgesTo(node);
      for (const dependent of dependents) {
        queue.push({ node: dependent.from, depth: depth + 1 });
      }
    }

    return reachable;
  }
}
```

---

## Consequences

### Positive

1. **Visibility:** Clear understanding of code relationships
2. **Risk Assessment:** Predict change impact before making changes
3. **Quality:** Detect and fix circular dependencies
4. **Planning:** Better estimation for refactoring efforts
5. **Testing:** Know exactly which tests to run

### Negative

1. **Build Time:** Graph construction adds to build time
2. **Memory:** Large graphs consume significant memory
3. **Maintenance:** Graph must stay in sync with code
4. **Complexity:** Graph algorithms can be computationally expensive

### Trade-offs

- **Accuracy vs. Speed:** Full analysis is slow, incremental is fast but may miss
- **Granularity vs. Noise:** Fine-grained graphs can be overwhelming
- **Static vs. Dynamic:** Static analysis misses dynamic dependencies

---

## Implementation Plan

### Phase 1: Graph Builder (Week 1-2)
- Implement AST-based import extraction
- Build multi-language support
- Create graph data structure

### Phase 2: Impact Analysis (Week 3-4)
- Implement transitive dependency finder
- Build risk calculator
- Create recommendation engine

### Phase 3: Cycle Detection (Week 5-6)
- Implement cycle detection algorithm
- Build fix suggestion engine
- Create severity calculator

### Phase 4: Visualization (Week 7-8)
- Implement Mermaid generator
- Build D3 visualization
- Create interactive explorer

---

## References

- [Madge - Dependency Graph](https://github.com/pahen/madge)
- [Dependency Cruiser](https://github.com/sverweij/dependency-cruiser)
- [Tarjan's Algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm)
- [D3.js Force Layout](https://d3js.org/d3-force)

---

**Decision Maker:** Engineering Lead + Architecture Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Platform Engineering Team
