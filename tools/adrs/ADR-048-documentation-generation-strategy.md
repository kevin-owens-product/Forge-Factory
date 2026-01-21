# ADR-048: Documentation Generation Strategy

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** Medium

---

## Context

Comprehensive documentation is critical for code maintainability, but developers spend **20-30%** of their time writing documentation. AI can generate high-quality documentation automatically, but it must be accurate, consistent, and maintain the codebase's voice and style.

### Business Requirements

- **Coverage:** Generate documentation for 100% of public APIs
- **Types:** JSDoc, docstrings, README, ADRs, API docs
- **Quality:** Documentation must be accurate and helpful
- **Consistency:** Maintain consistent style across codebase
- **Updates:** Keep documentation in sync with code changes
- **Formats:** Support multiple output formats (MD, HTML, PDF)

### Documentation Types

| Type | Scope | Update Frequency | Primary Audience |
|------|-------|------------------|------------------|
| Inline (JSDoc/docstring) | Function/class | Every code change | Developers |
| README | Module/package | Weekly | Developers/Users |
| API Reference | Public APIs | Every release | API consumers |
| Architecture (ADR) | System design | Major changes | Architects |
| User Guide | Features | Release | End users |
| Changelog | Changes | Every release | All stakeholders |

### Documentation Challenges

1. **Accuracy:** Documentation must match actual code behavior
2. **Staleness:** Documentation quickly becomes outdated
3. **Completeness:** All edge cases and parameters documented
4. **Style:** Consistent voice and terminology
5. **Examples:** Accurate, working code examples
6. **Localization:** Multi-language support

---

## Decision

We will implement a **multi-tier documentation generation system** with:

1. **Inline Documentation Generator** - JSDoc, docstrings, comments
2. **README Generator** - Module and package documentation
3. **API Documentation Generator** - OpenAPI, reference docs
4. **Architecture Documentation Generator** - ADRs, diagrams
5. **Documentation Sync System** - Keep docs updated with code

### Architecture Overview

```typescript
interface DocumentationEngine {
  // Generation
  generateInlineDoc(code: SourceFile): Promise<DocumentedCode>;
  generateREADME(module: Module): Promise<README>;
  generateAPIDoc(api: APIDefinition): Promise<APIDoc>;
  generateADR(decision: ArchitectureDecision): Promise<ADR>;

  // Synchronization
  syncDocumentation(changes: CodeChange[]): Promise<DocSyncResult>;

  // Validation
  validateDocumentation(code: SourceFile): Promise<DocValidationResult>;
}

interface DocumentationConfig {
  language: SupportedLanguage;
  style: DocumentationStyle;
  format: DocFormat;
  includeExamples: boolean;
  includeTypes: boolean;
  includeExceptions: boolean;
  maxDescriptionLength: number;
  tone: 'formal' | 'casual' | 'technical';
}

interface DocumentedCode {
  original: string;
  documented: string;
  additions: DocAddition[];
  coverage: DocCoverage;
}

interface DocAddition {
  type: 'jsdoc' | 'docstring' | 'comment';
  location: CodeLocation;
  content: string;
  targetElement: string;
}
```

### Component 1: Inline Documentation Generator

Generate JSDoc, docstrings, and inline comments.

```typescript
class InlineDocumentationGenerator {
  constructor(
    private llmClient: AnthropicClient,
    private config: DocumentationConfig
  ) {}

  async generateInlineDoc(file: SourceFile): Promise<DocumentedCode> {
    const ast = await this.parseFile(file);
    const elements = this.extractDocumentableElements(ast);

    const additions: DocAddition[] = [];

    for (const element of elements) {
      // Skip if already documented
      if (element.hasDocumentation && !this.config.regenerateExisting) {
        continue;
      }

      const doc = await this.generateDocumentation(element, file);
      additions.push(doc);
    }

    const documentedCode = this.applyDocumentation(file.content, additions);

    return {
      original: file.content,
      documented: documentedCode,
      additions,
      coverage: this.calculateCoverage(elements, additions),
    };
  }

  private async generateDocumentation(
    element: DocumentableElement,
    file: SourceFile
  ): Promise<DocAddition> {
    const prompt = this.buildDocPrompt(element, file);

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    return this.parseDocResponse(response.content, element);
  }

  private buildDocPrompt(element: DocumentableElement, file: SourceFile): string {
    const styleGuide = this.getStyleGuide(file.language);

    return `
Generate ${file.language === 'python' ? 'docstring' : 'JSDoc'} documentation for this ${element.type}:

\`\`\`${file.language}
${element.code}
\`\`\`

Context (surrounding code):
\`\`\`${file.language}
${element.context}
\`\`\`

## Documentation Style Guide
${styleGuide}

## Requirements:
1. Write a concise description (1-2 sentences) explaining WHAT the ${element.type} does
2. Document all parameters with types and descriptions
3. Document the return value with type and description
4. Document any exceptions that can be thrown
5. Include a usage example if the function is complex
6. Use ${this.config.tone} tone

## Format:
${this.getFormatTemplate(file.language, element.type)}

Return ONLY the documentation comment, no code.
`;
  }

  private getFormatTemplate(language: string, elementType: string): string {
    if (language === 'typescript' || language === 'javascript') {
      return `
/**
 * Brief description of what this ${elementType} does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} Description of when this error is thrown
 *
 * @example
 * \`\`\`typescript
 * // Example usage
 * const result = functionName(arg);
 * \`\`\`
 */
`;
    } else if (language === 'python') {
      return `
"""Brief description of what this ${elementType} does.

Args:
    param_name: Description of parameter

Returns:
    Description of return value

Raises:
    ErrorType: Description of when this error is raised

Example:
    >>> # Example usage
    >>> result = function_name(arg)
"""
`;
    }

    return '';
  }

  private parseDocResponse(response: string, element: DocumentableElement): DocAddition {
    // Clean up response
    let content = response.trim();

    // Remove code blocks if present
    content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');

    return {
      type: element.language === 'python' ? 'docstring' : 'jsdoc',
      location: element.location,
      content,
      targetElement: element.name,
    };
  }
}
```

### Component 2: README Generator

Generate comprehensive README files for modules and packages.

```typescript
class READMEGenerator {
  constructor(
    private llmClient: AnthropicClient,
    private analysisEngine: CodeAnalysisEngine
  ) {}

  async generateREADME(module: Module): Promise<README> {
    // Analyze the module
    const analysis = await this.analysisEngine.analyze(module.path);

    // Generate sections
    const sections = await Promise.all([
      this.generateOverview(module, analysis),
      this.generateInstallation(module),
      this.generateUsage(module, analysis),
      this.generateAPI(module, analysis),
      this.generateExamples(module, analysis),
      this.generateConfiguration(module),
      this.generateContributing(module),
      this.generateLicense(module),
    ]);

    return {
      title: module.name,
      sections,
      badges: this.generateBadges(module),
      tableOfContents: this.generateTOC(sections),
    };
  }

  private async generateOverview(module: Module, analysis: ModuleAnalysis): Promise<READMESection> {
    const prompt = `
Generate a README overview section for this module:

Module: ${module.name}
Description: ${module.description || 'Not provided'}

Key Statistics:
- Files: ${analysis.fileCount}
- Functions: ${analysis.functionCount}
- Classes: ${analysis.classCount}
- Lines of Code: ${analysis.linesOfCode}

Main Exports:
${analysis.exports.map(e => `- ${e.name}: ${e.type}`).join('\n')}

Dependencies:
${analysis.dependencies.slice(0, 10).map(d => `- ${d.name}`).join('\n')}

Write a concise but comprehensive overview that:
1. Explains what the module does in 2-3 sentences
2. Lists key features (3-5 bullet points)
3. Describes the target audience
4. Mentions any prerequisites

Use Markdown formatting.
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    return {
      title: 'Overview',
      content: response.content,
      order: 1,
    };
  }

  private async generateUsage(module: Module, analysis: ModuleAnalysis): Promise<READMESection> {
    const mainExports = analysis.exports.slice(0, 5);

    const prompt = `
Generate a "Quick Start" / "Usage" section for this module:

Module: ${module.name}
Language: ${module.language}

Main Exports:
${mainExports.map(e => `
### ${e.name} (${e.type})
Signature: ${e.signature}
Description: ${e.description || 'Not documented'}
`).join('\n')}

Generate:
1. A minimal "Hello World" example
2. A more complete example showing common usage patterns
3. Brief explanations of what each example does

Format as Markdown with code blocks.
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    return {
      title: 'Usage',
      content: response.content,
      order: 3,
    };
  }

  private async generateExamples(module: Module, analysis: ModuleAnalysis): Promise<READMESection> {
    const prompt = `
Generate comprehensive examples for this module:

Module: ${module.name}
Language: ${module.language}

Available Functions/Classes:
${analysis.exports.map(e => `- ${e.name}: ${e.signature}`).join('\n')}

Generate 3-5 real-world examples that demonstrate:
1. Basic usage
2. Error handling
3. Common use cases
4. Integration patterns
5. Advanced features (if applicable)

Each example should include:
- A descriptive title
- Brief explanation of what it demonstrates
- Complete, runnable code
- Expected output (if applicable)

Format as Markdown.
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.3,
    });

    return {
      title: 'Examples',
      content: response.content,
      order: 5,
    };
  }

  private generateBadges(module: Module): Badge[] {
    return [
      { name: 'version', url: `https://img.shields.io/npm/v/${module.name}` },
      { name: 'license', url: `https://img.shields.io/badge/license-${module.license}-blue` },
      { name: 'build', url: `https://img.shields.io/github/actions/workflow/status/${module.repo}/ci.yml` },
      { name: 'coverage', url: `https://img.shields.io/codecov/c/github/${module.repo}` },
    ];
  }
}
```

### Component 3: API Documentation Generator

Generate comprehensive API reference documentation.

```typescript
class APIDocumentationGenerator {
  constructor(
    private llmClient: AnthropicClient,
    private schemaParser: SchemaParser
  ) {}

  async generateAPIDoc(api: APIDefinition): Promise<APIDoc> {
    const endpoints = await this.documentEndpoints(api);
    const schemas = await this.documentSchemas(api);
    const authentication = await this.documentAuthentication(api);
    const errors = await this.documentErrors(api);

    return {
      title: api.title,
      version: api.version,
      description: api.description,
      baseUrl: api.baseUrl,
      authentication,
      endpoints,
      schemas,
      errors,
      openApiSpec: this.generateOpenAPISpec(api, endpoints, schemas),
    };
  }

  private async documentEndpoints(api: APIDefinition): Promise<EndpointDoc[]> {
    const docs: EndpointDoc[] = [];

    for (const endpoint of api.endpoints) {
      const doc = await this.documentEndpoint(endpoint, api);
      docs.push(doc);
    }

    return docs;
  }

  private async documentEndpoint(endpoint: APIEndpoint, api: APIDefinition): Promise<EndpointDoc> {
    const prompt = `
Document this API endpoint:

Method: ${endpoint.method}
Path: ${endpoint.path}
Handler Code:
\`\`\`${api.language}
${endpoint.handlerCode}
\`\`\`

Request Schema:
${JSON.stringify(endpoint.requestSchema, null, 2)}

Response Schema:
${JSON.stringify(endpoint.responseSchema, null, 2)}

Generate comprehensive documentation including:
1. **Description**: What this endpoint does (2-3 sentences)
2. **Parameters**: All path, query, and body parameters with types and descriptions
3. **Response**: Expected response structure and status codes
4. **Errors**: Possible error responses
5. **Example**: cURL example and response

Return as JSON:
{
  "description": "...",
  "parameters": [...],
  "responses": [...],
  "errors": [...],
  "example": { "request": "...", "response": "..." }
}
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const parsed = JSON.parse(response.content);

    return {
      method: endpoint.method,
      path: endpoint.path,
      ...parsed,
      tags: endpoint.tags,
      deprecated: endpoint.deprecated,
    };
  }

  private generateOpenAPISpec(api: APIDefinition, endpoints: EndpointDoc[], schemas: SchemaDoc[]): OpenAPISpec {
    return {
      openapi: '3.0.3',
      info: {
        title: api.title,
        version: api.version,
        description: api.description,
      },
      servers: [{ url: api.baseUrl }],
      paths: this.buildPaths(endpoints),
      components: {
        schemas: this.buildSchemas(schemas),
        securitySchemes: this.buildSecuritySchemes(api),
      },
    };
  }
}
```

### Component 4: Architecture Documentation Generator

Generate ADRs and architecture diagrams.

```typescript
class ArchitectureDocumentationGenerator {
  constructor(
    private llmClient: AnthropicClient,
    private diagramGenerator: DiagramGenerator
  ) {}

  async generateADR(decision: ArchitectureDecision): Promise<ADR> {
    const prompt = `
Generate an Architecture Decision Record (ADR) for:

Title: ${decision.title}
Context: ${decision.context}
Constraints: ${decision.constraints.join(', ')}
Options Considered: ${decision.options.map(o => o.name).join(', ')}
Decision Made: ${decision.selectedOption}

Generate a comprehensive ADR following this template:

# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What is the issue that we're seeing that is motivating this decision or change?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences

### Positive
[What are the benefits of this decision?]

### Negative
[What are the drawbacks of this decision?]

### Risks
[What risks does this decision introduce?]

## Alternatives Considered
[What other options were considered and why were they rejected?]

## References
[Links to relevant resources]
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.3,
    });

    return {
      id: `ADR-${decision.id}`,
      title: decision.title,
      content: response.content,
      status: 'proposed',
      date: new Date().toISOString(),
      decision: decision.selectedOption,
    };
  }

  async generateArchitectureDiagram(codebase: Codebase): Promise<Diagram> {
    const analysis = await this.analyzeArchitecture(codebase);

    // Generate Mermaid diagram
    const mermaidCode = this.generateMermaidDiagram(analysis);

    // Generate PlantUML diagram
    const plantUmlCode = this.generatePlantUMLDiagram(analysis);

    return {
      mermaid: mermaidCode,
      plantUml: plantUmlCode,
      components: analysis.components,
      connections: analysis.connections,
    };
  }

  private generateMermaidDiagram(analysis: ArchitectureAnalysis): string {
    let diagram = 'graph TB\n';

    // Add components
    for (const component of analysis.components) {
      diagram += `    ${component.id}[${component.name}]\n`;
    }

    // Add connections
    for (const connection of analysis.connections) {
      diagram += `    ${connection.from} --> ${connection.to}\n`;
    }

    // Add subgraphs for layers
    for (const layer of analysis.layers) {
      diagram += `    subgraph ${layer.name}\n`;
      for (const componentId of layer.components) {
        diagram += `        ${componentId}\n`;
      }
      diagram += `    end\n`;
    }

    return diagram;
  }
}
```

### Component 5: Documentation Sync System

Keep documentation in sync with code changes.

```typescript
class DocumentationSyncSystem {
  constructor(
    private docGenerator: InlineDocumentationGenerator,
    private diffAnalyzer: DiffAnalyzer,
    private notificationService: NotificationService
  ) {}

  async syncDocumentation(changes: CodeChange[]): Promise<DocSyncResult> {
    const updates: DocUpdate[] = [];
    const staleDocuments: StaleDocument[] = [];

    for (const change of changes) {
      // Analyze what documentation is affected
      const affected = await this.analyzeAffectedDocumentation(change);

      for (const doc of affected) {
        if (await this.isDocumentationStale(doc, change)) {
          if (this.canAutoUpdate(doc)) {
            // Auto-update documentation
            const update = await this.updateDocumentation(doc, change);
            updates.push(update);
          } else {
            // Mark as needing manual review
            staleDocuments.push({
              document: doc,
              change,
              reason: 'Requires manual review',
            });
          }
        }
      }
    }

    // Notify about stale documentation
    if (staleDocuments.length > 0) {
      await this.notificationService.notifyStaleDocumentation(staleDocuments);
    }

    return {
      updates,
      staleDocuments,
      coverage: await this.calculateDocCoverage(),
    };
  }

  private async isDocumentationStale(doc: Documentation, change: CodeChange): Promise<boolean> {
    // Compare documentation with current code
    const currentCode = await this.getCode(doc.targetFile);
    const documentedElement = this.extractDocumentedElement(currentCode, doc);

    if (!documentedElement) {
      // Element was deleted
      return true;
    }

    // Check if signature changed
    if (documentedElement.signature !== doc.documentedSignature) {
      return true;
    }

    // Check if parameters changed
    const currentParams = this.extractParameters(documentedElement);
    const documentedParams = this.parseDocumentedParameters(doc);

    if (!this.parametersMatch(currentParams, documentedParams)) {
      return true;
    }

    // Check if return type changed
    if (documentedElement.returnType !== doc.documentedReturnType) {
      return true;
    }

    return false;
  }

  private async updateDocumentation(doc: Documentation, change: CodeChange): Promise<DocUpdate> {
    const element = await this.getDocumentableElement(doc.targetFile, doc.targetElement);

    // Generate new documentation
    const newDoc = await this.docGenerator.generateDocumentation(element, {
      content: await this.getFileContent(doc.targetFile),
      language: doc.language,
      path: doc.targetFile,
    });

    return {
      file: doc.targetFile,
      element: doc.targetElement,
      oldDocumentation: doc.content,
      newDocumentation: newDoc.content,
      reason: `Updated due to: ${change.description}`,
    };
  }

  async validateDocumentation(file: SourceFile): Promise<DocValidationResult> {
    const elements = this.extractDocumentableElements(file);
    const issues: DocValidationIssue[] = [];

    for (const element of elements) {
      // Check if documented
      if (!element.hasDocumentation) {
        issues.push({
          type: 'missing',
          element: element.name,
          severity: element.isPublic ? 'error' : 'warning',
          message: `${element.type} '${element.name}' is not documented`,
        });
        continue;
      }

      // Validate documentation accuracy
      const accuracyIssues = await this.validateDocAccuracy(element);
      issues.push(...accuracyIssues);

      // Validate completeness
      const completenessIssues = this.validateDocCompleteness(element);
      issues.push(...completenessIssues);
    }

    return {
      file: file.path,
      issues,
      coverage: this.calculateElementCoverage(elements),
      score: this.calculateDocScore(issues, elements),
    };
  }
}
```

---

## Consequences

### Positive

1. **Time Savings:** 80% reduction in documentation time
2. **Consistency:** Uniform documentation style
3. **Coverage:** 100% API documentation coverage achievable
4. **Freshness:** Documentation stays in sync with code
5. **Quality:** Professional, comprehensive documentation

### Negative

1. **Accuracy:** LLM may misunderstand complex code
2. **Cost:** LLM calls for documentation generation
3. **Review:** Still requires human review
4. **Style:** May not match existing project style perfectly

### Trade-offs

- **Automation vs. Accuracy:** More automation = potential for errors
- **Completeness vs. Conciseness:** Complete docs can be overwhelming
- **Freshness vs. Stability:** Frequent updates can be disruptive

---

## Implementation Plan

### Phase 1: Inline Documentation (Week 1-2)
- Implement JSDoc generator
- Implement Python docstring generator
- Build documentation validator

### Phase 2: README Generation (Week 3-4)
- Build module analyzer
- Implement README generator
- Add example generation

### Phase 3: API Documentation (Week 5-6)
- Build endpoint documenter
- Generate OpenAPI specs
- Create API reference site

### Phase 4: Sync System (Week 7-8)
- Implement change detection
- Build auto-update system
- Add notification system

---

## References

- [JSDoc Documentation](https://jsdoc.app/)
- [Google Python Style Guide - Docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Architecture Decision Records](https://adr.github.io/)

---

**Decision Maker:** Documentation Lead + Engineering Lead
**Approved By:** Engineering Leadership
**Implementation Owner:** Developer Experience Team
