# ADR-043: Context Window Optimization

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

LLM context windows have expanded dramatically (from 8K to 1M+ tokens), but **enterprise codebases far exceed these limits**. A typical enterprise repository contains 500K-5M lines of code, which translates to 2-20M tokens—far beyond any single context window.

### Business Requirements

- **Codebase Size:** Support analysis of 1M+ LOC repositories
- **Context Quality:** Maximize relevant context in limited windows
- **Cost Efficiency:** Minimize token usage (cost is $3-15/million tokens)
- **Speed:** Context preparation must complete in <5 seconds
- **Accuracy:** Include all relevant code for accurate transformations

### Context Window Sizes (2026)

| Provider | Model | Context Window | Effective for Code |
|----------|-------|----------------|-------------------|
| Anthropic | Claude 3.5 Sonnet | 200K tokens | ~150K LOC |
| Anthropic | Claude 3.5 Haiku | 200K tokens | ~150K LOC |
| OpenAI | GPT-4 Turbo | 128K tokens | ~100K LOC |
| Google | Gemini 1.5 Pro | 1M tokens | ~750K LOC |
| Anthropic | Claude 3 Opus | 200K tokens | ~150K LOC |

### Context Window Challenges

1. **Code-to-Token Ratio:** Code averages 1.3-1.5 tokens per character
2. **Context Relevance:** Not all code is relevant to every task
3. **Dependency Chains:** Following imports can explode context
4. **Duplication:** Similar code patterns waste context space
5. **Recency Bias:** LLMs attend more to recent context
6. **Lost in the Middle:** Information in middle of context is often ignored

---

## Decision

We will implement a **hierarchical context optimization system** with multiple strategies:

1. **Semantic Chunking:** Split code into meaningful units
2. **Relevance Scoring:** Rank chunks by task relevance
3. **Dynamic Context Building:** Assemble optimal context for each task
4. **Compression Techniques:** Reduce token usage without losing meaning
5. **Retrieval-Augmented Generation (RAG):** Use embeddings for relevant retrieval

### Architecture Overview

```typescript
interface ContextOptimizer {
  // Core configuration
  config: ContextOptimizerConfig;

  // Chunking
  chunkRepository(repo: Repository): Promise<CodeChunk[]>;

  // Relevance scoring
  scoreChunks(chunks: CodeChunk[], task: TransformationTask): ScoredChunk[];

  // Context building
  buildContext(scoredChunks: ScoredChunk[], maxTokens: number): OptimizedContext;

  // Compression
  compressContext(context: OptimizedContext): CompressedContext;
}

interface ContextOptimizerConfig {
  maxContextTokens: number;          // 150000
  reservedTokens: number;            // 20000 (for response)
  chunkingStrategy: ChunkingStrategy;
  scoringModel: ScoringModel;
  compressionLevel: CompressionLevel;
  includeTypes: boolean;             // Include type definitions
  includeTests: boolean;             // Include related tests
  includeDocumentation: boolean;     // Include JSDoc/docstrings
}

interface CodeChunk {
  id: string;
  type: ChunkType;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  tokenCount: number;

  // Metadata for scoring
  dependencies: string[];            // Imports/requires
  exports: string[];                 // Exported symbols
  complexity: number;                // Cyclomatic complexity
  lastModified: Date;
  testCoverage: number;
}

type ChunkType =
  | 'function'
  | 'class'
  | 'interface'
  | 'module'
  | 'type'
  | 'constant'
  | 'test'
  | 'config';
```

### Strategy 1: Semantic Chunking

Split code into semantically meaningful units rather than arbitrary token limits.

```typescript
class SemanticChunker {
  async chunkRepository(repo: Repository): Promise<CodeChunk[]> {
    const allChunks: CodeChunk[] = [];

    for (const file of repo.files) {
      const chunks = await this.chunkFile(file);
      allChunks.push(...chunks);
    }

    // Index chunks for fast retrieval
    await this.indexChunks(allChunks);

    return allChunks;
  }

  private async chunkFile(file: SourceFile): Promise<CodeChunk[]> {
    const ast = await this.parseFile(file);
    const chunks: CodeChunk[] = [];

    // Extract top-level declarations as chunks
    for (const node of ast.body) {
      switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          chunks.push(this.createFunctionChunk(node, file));
          break;

        case 'ClassDeclaration':
          // Chunk entire class or split into methods
          if (this.getTokenCount(node) > 2000) {
            // Large class - chunk by methods
            chunks.push(...this.chunkClass(node, file));
          } else {
            chunks.push(this.createClassChunk(node, file));
          }
          break;

        case 'InterfaceDeclaration':
        case 'TypeAliasDeclaration':
          chunks.push(this.createTypeChunk(node, file));
          break;

        case 'VariableDeclaration':
          if (this.isSignificantExport(node)) {
            chunks.push(this.createConstantChunk(node, file));
          }
          break;
      }
    }

    // Handle files with no top-level declarations (scripts)
    if (chunks.length === 0) {
      chunks.push(this.createModuleChunk(file));
    }

    return chunks;
  }

  private createFunctionChunk(node: FunctionNode, file: SourceFile): CodeChunk {
    const content = this.extractNodeSource(node, file);

    return {
      id: `${file.path}:${node.name}`,
      type: 'function',
      content,
      filePath: file.path,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      tokenCount: this.countTokens(content),
      dependencies: this.extractDependencies(node),
      exports: this.extractExports(node),
      complexity: this.calculateComplexity(node),
      lastModified: file.lastModified,
      testCoverage: 0, // Will be filled by coverage analysis
    };
  }

  private chunkClass(classNode: ClassNode, file: SourceFile): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // Create a summary chunk for the class (constructor + fields)
    chunks.push(this.createClassSummaryChunk(classNode, file));

    // Create individual chunks for each method
    for (const method of classNode.body.body) {
      if (method.type === 'MethodDefinition') {
        chunks.push(this.createMethodChunk(method, classNode, file));
      }
    }

    return chunks;
  }
}
```

### Strategy 2: Relevance Scoring

Rank chunks by relevance to the current transformation task.

```typescript
class RelevanceScorer {
  constructor(
    private embeddingClient: EmbeddingClient,
    private chunkIndex: ChunkIndex
  ) {}

  async scoreChunks(
    chunks: CodeChunk[],
    task: TransformationTask
  ): Promise<ScoredChunk[]> {
    // Get task embedding
    const taskEmbedding = await this.embeddingClient.embed(task.description);

    // Score each chunk
    const scoredChunks = await Promise.all(
      chunks.map(async chunk => {
        const score = await this.calculateRelevanceScore(chunk, task, taskEmbedding);
        return { chunk, score };
      })
    );

    // Sort by score descending
    return scoredChunks.sort((a, b) => b.score - a.score);
  }

  private async calculateRelevanceScore(
    chunk: CodeChunk,
    task: TransformationTask,
    taskEmbedding: number[]
  ): Promise<number> {
    let score = 0;

    // 1. Semantic similarity (40% weight)
    const chunkEmbedding = await this.getChunkEmbedding(chunk);
    const semanticScore = this.cosineSimilarity(taskEmbedding, chunkEmbedding);
    score += semanticScore * 0.4;

    // 2. Direct reference (30% weight)
    if (this.isDirectlyReferenced(chunk, task)) {
      score += 0.3;
    }

    // 3. Dependency relevance (15% weight)
    const dependencyScore = this.calculateDependencyScore(chunk, task);
    score += dependencyScore * 0.15;

    // 4. Type relevance (10% weight)
    const typeScore = this.calculateTypeRelevance(chunk, task);
    score += typeScore * 0.1;

    // 5. Recency bonus (5% weight)
    const recencyScore = this.calculateRecencyScore(chunk);
    score += recencyScore * 0.05;

    return score;
  }

  private isDirectlyReferenced(chunk: CodeChunk, task: TransformationTask): boolean {
    // Check if task explicitly mentions this chunk
    const mentionedFiles = task.targetFiles || [];
    const mentionedSymbols = task.targetSymbols || [];

    return (
      mentionedFiles.includes(chunk.filePath) ||
      mentionedSymbols.some(sym => chunk.exports.includes(sym))
    );
  }

  private calculateDependencyScore(chunk: CodeChunk, task: TransformationTask): number {
    // Higher score if chunk is imported by target files
    const targetFiles = task.targetFiles || [];
    let score = 0;

    for (const file of targetFiles) {
      const fileImports = this.chunkIndex.getImportsForFile(file);
      if (fileImports.some(imp => chunk.exports.includes(imp))) {
        score += 0.5;
      }
    }

    return Math.min(score, 1);
  }

  private calculateTypeRelevance(chunk: CodeChunk, task: TransformationTask): number {
    // Types used by target code should be included
    if (chunk.type === 'interface' || chunk.type === 'type') {
      const usedTypes = task.usedTypes || [];
      const chunkTypes = chunk.exports;

      const overlap = usedTypes.filter(t => chunkTypes.includes(t)).length;
      return Math.min(overlap / usedTypes.length, 1);
    }

    return 0;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

### Strategy 3: Dynamic Context Building

Assemble optimal context given token limits and task requirements.

```typescript
class ContextBuilder {
  buildContext(
    scoredChunks: ScoredChunk[],
    task: TransformationTask,
    config: ContextBuilderConfig
  ): OptimizedContext {
    const maxTokens = config.maxContextTokens - config.reservedTokens;

    // Start with mandatory context
    const context: ContextSection[] = [];
    let usedTokens = 0;

    // 1. Always include task description
    const taskSection = this.createTaskSection(task);
    context.push(taskSection);
    usedTokens += taskSection.tokenCount;

    // 2. Include directly referenced files (must-have)
    const mandatoryChunks = scoredChunks.filter(sc => sc.score > 0.9);
    for (const sc of mandatoryChunks) {
      if (usedTokens + sc.chunk.tokenCount <= maxTokens) {
        context.push(this.createCodeSection(sc.chunk, 'primary'));
        usedTokens += sc.chunk.tokenCount;
      }
    }

    // 3. Include type definitions for referenced types
    const typeChunks = this.getRelevantTypes(scoredChunks, task);
    for (const tc of typeChunks) {
      if (usedTokens + tc.chunk.tokenCount <= maxTokens) {
        context.push(this.createCodeSection(tc.chunk, 'type'));
        usedTokens += tc.chunk.tokenCount;
      }
    }

    // 4. Fill remaining space with high-relevance chunks
    const remainingChunks = scoredChunks
      .filter(sc => !mandatoryChunks.includes(sc) && !typeChunks.includes(sc))
      .filter(sc => sc.score > 0.3);

    for (const sc of remainingChunks) {
      if (usedTokens + sc.chunk.tokenCount <= maxTokens) {
        context.push(this.createCodeSection(sc.chunk, 'context'));
        usedTokens += sc.chunk.tokenCount;
      } else if (usedTokens + 500 <= maxTokens) {
        // Try to add a summary instead
        const summary = this.summarizeChunk(sc.chunk);
        context.push(this.createSummarySection(sc.chunk, summary));
        usedTokens += this.countTokens(summary);
      }
    }

    // 5. Add file structure overview if space permits
    if (usedTokens + 1000 <= maxTokens) {
      const structure = this.generateFileStructure(task.repository);
      context.push(this.createStructureSection(structure));
    }

    return {
      sections: context,
      totalTokens: usedTokens,
      maxTokens,
      utilizationRate: usedTokens / maxTokens,
      includedChunks: context.filter(s => s.type === 'code').length,
      excludedChunks: scoredChunks.length - context.filter(s => s.type === 'code').length,
    };
  }

  private createCodeSection(chunk: CodeChunk, priority: ContextPriority): ContextSection {
    return {
      type: 'code',
      priority,
      content: this.formatChunkForContext(chunk),
      tokenCount: chunk.tokenCount,
      metadata: {
        filePath: chunk.filePath,
        lineRange: `${chunk.startLine}-${chunk.endLine}`,
        chunkType: chunk.type,
      },
    };
  }

  private formatChunkForContext(chunk: CodeChunk): string {
    // Format with file path and line numbers for LLM reference
    return `
// File: ${chunk.filePath}
// Lines: ${chunk.startLine}-${chunk.endLine}
// Type: ${chunk.type}

${chunk.content}
`;
  }

  private summarizeChunk(chunk: CodeChunk): string {
    // Create a brief summary when full content doesn't fit
    const lines = chunk.content.split('\n');
    const signature = lines[0]; // First line (usually declaration)

    return `
// ${chunk.filePath}:${chunk.startLine} (summarized)
${signature}
  // ... ${lines.length - 1} lines, complexity: ${chunk.complexity}
  // Exports: ${chunk.exports.join(', ')}
`;
  }
}
```

### Strategy 4: Context Compression

Reduce token usage without losing critical information.

```typescript
class ContextCompressor {
  compress(context: OptimizedContext, level: CompressionLevel): CompressedContext {
    const compressedSections = context.sections.map(section => {
      switch (section.type) {
        case 'code':
          return this.compressCodeSection(section, level);
        case 'summary':
          return section; // Already compressed
        default:
          return section;
      }
    });

    return {
      sections: compressedSections,
      totalTokens: this.calculateTotalTokens(compressedSections),
      compressionRatio: context.totalTokens / this.calculateTotalTokens(compressedSections),
    };
  }

  private compressCodeSection(section: ContextSection, level: CompressionLevel): ContextSection {
    let compressed = section.content;

    // Level 1: Remove comments (except JSDoc/docstrings)
    if (level >= CompressionLevel.LIGHT) {
      compressed = this.removeNonEssentialComments(compressed);
    }

    // Level 2: Remove blank lines and normalize whitespace
    if (level >= CompressionLevel.MEDIUM) {
      compressed = this.normalizeWhitespace(compressed);
    }

    // Level 3: Shorten variable names (dangerous, use carefully)
    if (level >= CompressionLevel.AGGRESSIVE) {
      compressed = this.abbreviateIdentifiers(compressed, section.metadata);
    }

    return {
      ...section,
      content: compressed,
      tokenCount: this.countTokens(compressed),
    };
  }

  private removeNonEssentialComments(code: string): string {
    // Keep JSDoc, docstrings, and TODO comments
    // Remove inline comments and block comments

    const lines = code.split('\n');
    const result: string[] = [];
    let inBlockComment = false;
    let inJSDoc = false;

    for (const line of lines) {
      if (line.includes('/**')) {
        inJSDoc = true;
      }
      if (line.includes('*/') && inJSDoc) {
        inJSDoc = false;
        result.push(line);
        continue;
      }

      if (inJSDoc) {
        result.push(line);
        continue;
      }

      if (line.includes('/*') && !line.includes('*/')) {
        inBlockComment = true;
        continue;
      }
      if (line.includes('*/')) {
        inBlockComment = false;
        continue;
      }

      if (!inBlockComment) {
        // Remove inline comments but keep the code
        const withoutComment = line.replace(/\/\/(?!.*TODO|.*FIXME).*$/, '').trimEnd();
        if (withoutComment.trim()) {
          result.push(withoutComment);
        }
      }
    }

    return result.join('\n');
  }

  private normalizeWhitespace(code: string): string {
    return code
      .split('\n')
      .filter(line => line.trim()) // Remove blank lines
      .map(line => line.replace(/\s+/g, ' ')) // Normalize spaces
      .join('\n');
  }
}
```

### Strategy 5: RAG-Based Retrieval

Use embeddings for efficient retrieval of relevant code.

```typescript
class RAGContextRetriever {
  constructor(
    private vectorStore: VectorStore,
    private embeddingClient: EmbeddingClient
  ) {}

  async indexRepository(repo: Repository): Promise<void> {
    const chunks = await this.chunkRepository(repo);

    for (const chunk of chunks) {
      const embedding = await this.embeddingClient.embed(chunk.content);

      await this.vectorStore.upsert({
        id: chunk.id,
        embedding,
        metadata: {
          filePath: chunk.filePath,
          type: chunk.type,
          exports: chunk.exports,
          dependencies: chunk.dependencies,
        },
        content: chunk.content,
      });
    }
  }

  async retrieveRelevantChunks(
    task: TransformationTask,
    limit: number = 50
  ): Promise<CodeChunk[]> {
    // Embed the task description
    const taskEmbedding = await this.embeddingClient.embed(task.description);

    // Query vector store
    const results = await this.vectorStore.query({
      embedding: taskEmbedding,
      topK: limit,
      filter: this.buildFilter(task),
    });

    // Expand with dependencies
    const expandedChunks = await this.expandWithDependencies(results, task);

    return expandedChunks;
  }

  private async expandWithDependencies(
    chunks: VectorResult[],
    task: TransformationTask
  ): Promise<CodeChunk[]> {
    const allChunks = new Map<string, CodeChunk>();

    // Add initial chunks
    for (const result of chunks) {
      allChunks.set(result.id, this.resultToChunk(result));
    }

    // Expand with direct dependencies (1 level)
    for (const result of chunks) {
      const dependencies = result.metadata.dependencies || [];

      for (const dep of dependencies) {
        if (!allChunks.has(dep)) {
          const depChunk = await this.vectorStore.get(dep);
          if (depChunk) {
            allChunks.set(dep, this.resultToChunk(depChunk));
          }
        }
      }
    }

    return Array.from(allChunks.values());
  }

  private buildFilter(task: TransformationTask): VectorFilter {
    const filter: VectorFilter = {};

    // Filter by file patterns if specified
    if (task.filePatterns) {
      filter.filePath = { $regex: task.filePatterns.join('|') };
    }

    // Filter by chunk types
    if (task.includeTypes === false) {
      filter.type = { $nin: ['interface', 'type'] };
    }

    return filter;
  }
}
```

### Context Window Manager

```typescript
class ContextWindowManager {
  constructor(
    private chunker: SemanticChunker,
    private scorer: RelevanceScorer,
    private builder: ContextBuilder,
    private compressor: ContextCompressor,
    private ragRetriever: RAGContextRetriever
  ) {}

  async prepareContext(
    task: TransformationTask,
    config: ContextConfig
  ): Promise<PreparedContext> {
    // Step 1: Retrieve relevant chunks via RAG
    const relevantChunks = await this.ragRetriever.retrieveRelevantChunks(
      task,
      config.maxChunks
    );

    // Step 2: Score chunks for final relevance
    const scoredChunks = await this.scorer.scoreChunks(relevantChunks, task);

    // Step 3: Build optimal context
    const context = this.builder.buildContext(scoredChunks, task, config);

    // Step 4: Compress if needed
    let finalContext = context;
    if (context.utilizationRate > 0.95) {
      finalContext = this.compressor.compress(context, CompressionLevel.LIGHT);
    }

    // Step 5: Format for LLM
    const formattedContext = this.formatForLLM(finalContext, config.model);

    return {
      context: formattedContext,
      tokenCount: finalContext.totalTokens,
      metadata: {
        includedChunks: finalContext.includedChunks,
        excludedChunks: finalContext.excludedChunks,
        compressionRatio: finalContext.compressionRatio || 1,
        relevanceScores: scoredChunks.slice(0, 10).map(sc => sc.score),
      },
    };
  }

  private formatForLLM(context: OptimizedContext, model: LLMModel): string {
    // Order sections optimally (primary content first, then context)
    const orderedSections = [
      ...context.sections.filter(s => s.priority === 'primary'),
      ...context.sections.filter(s => s.priority === 'type'),
      ...context.sections.filter(s => s.priority === 'context'),
      ...context.sections.filter(s => s.type === 'structure'),
    ];

    return orderedSections.map(s => s.content).join('\n\n---\n\n');
  }
}
```

---

## Consequences

### Positive

1. **Scalability:** Can handle multi-million LOC repositories
2. **Cost Efficiency:** Only include relevant context (50-70% reduction)
3. **Quality:** Better transformations with focused context
4. **Speed:** RAG retrieval is fast (<1s for most queries)
5. **Flexibility:** Multiple strategies for different scenarios

### Negative

1. **Complexity:** Multiple components to maintain
2. **Embedding Costs:** Initial indexing requires embedding API calls
3. **Storage:** Vector store adds infrastructure requirements
4. **False Negatives:** May miss relevant code in edge cases

### Trade-offs

- **Completeness vs. Focus:** Tighter context may miss edge cases
- **Speed vs. Quality:** More retrieval = better context but slower
- **Cost vs. Accuracy:** More embeddings = better retrieval but higher cost

---

## Implementation Plan

### Phase 1: Semantic Chunking (Week 1-2)
- Implement AST-based chunking
- Build chunk indexing
- Create token counting utilities

### Phase 2: RAG Infrastructure (Week 3-4)
- Set up vector store (Pinecone/Weaviate)
- Implement embedding pipeline
- Build retrieval system

### Phase 3: Relevance Scoring (Week 5-6)
- Implement multi-factor scoring
- Build dependency analysis
- Add type relevance scoring

### Phase 4: Context Building (Week 7-8)
- Build dynamic context assembly
- Implement compression strategies
- Add monitoring and metrics

---

## References

- [Anthropic Token Counting](https://docs.anthropic.com/claude/docs/counting-tokens)
- [RAG Best Practices](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [Lost in the Middle Paper](https://arxiv.org/abs/2307.03172)
- [Chunk Optimization Strategies](https://www.llamaindex.ai/blog/evaluating-chunk-sizes)

---

**Decision Maker:** AI/ML Lead + Platform Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** AI Platform Team
