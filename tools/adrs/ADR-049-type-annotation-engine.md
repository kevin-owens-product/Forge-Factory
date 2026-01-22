# ADR-049: Type Annotation Engine

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Type annotations improve code quality, IDE support, and AI-readiness. However, many codebases lack proper type annotations, especially those migrating from JavaScript to TypeScript or adding type hints to Python. An automated type annotation engine can accelerate this process.

### Business Requirements

- **Languages:** TypeScript, Python, PHP 8+, Flow
- **Accuracy:** >95% accuracy for inferred types
- **Coverage:** Annotate 100% of public APIs
- **Preservation:** Don't break existing code
- **Speed:** Process 10K LOC/minute
- **Integration:** Support gradual adoption

### Type Annotation Challenges

| Challenge | Description | Impact |
|-----------|-------------|--------|
| Inference Complexity | Complex generic types, unions | High |
| Runtime Types | Types only known at runtime | Medium |
| Third-party Libraries | Missing type definitions | High |
| Legacy Code | Patterns that resist typing | Medium |
| Any/Unknown | When to use each | Low |
| Breaking Changes | Annotations may break builds | High |

### Type Systems Comparison

| Language | Type System | Adoption | Migration Path |
|----------|-------------|----------|----------------|
| TypeScript | Structural, gradual | 85% | JS → TS |
| Python | Nominal, gradual | 60% | No types → typed |
| PHP 8 | Nominal, gradual | 40% | PHP 7 → PHP 8 |
| Flow | Structural, gradual | 10% | JS → Flow → TS |

---

## Decision

We will implement a **multi-strategy type annotation engine** with:

1. **Static Analysis Inference** - Analyze code structure to infer types
2. **Runtime Sampling** - Collect types from execution
3. **LLM-Assisted Inference** - Use AI for complex/ambiguous cases
4. **Type Definition Generation** - Create missing .d.ts files
5. **Gradual Migration Support** - Incremental type adoption

### Architecture Overview

```typescript
interface TypeAnnotationEngine {
  // Configuration
  config: TypeAnnotationConfig;

  // Analysis
  analyzeFile(file: SourceFile): Promise<TypeAnalysis>;

  // Inference
  inferTypes(file: SourceFile): Promise<InferredTypes>;

  // Annotation
  annotateFile(file: SourceFile, types: InferredTypes): Promise<AnnotatedFile>;

  // Validation
  validateTypes(file: AnnotatedFile): Promise<TypeValidationResult>;
}

interface TypeAnnotationConfig {
  language: 'typescript' | 'python' | 'php';
  strictness: 'loose' | 'moderate' | 'strict';
  inferGenerics: boolean;
  handleUnknown: 'any' | 'unknown' | 'infer';
  preserveComments: boolean;
  maxComplexity: number;
}

interface InferredTypes {
  functions: FunctionType[];
  classes: ClassType[];
  variables: VariableType[];
  parameters: ParameterType[];
  returnTypes: ReturnType[];
  generics: GenericType[];
  confidence: Map<string, number>;
}

interface TypeAnnotation {
  location: CodeLocation;
  original: string;
  annotated: string;
  inferenceMethod: 'static' | 'runtime' | 'llm' | 'manual';
  confidence: number;
}
```

### Strategy 1: Static Analysis Inference

Infer types from code structure and data flow.

```typescript
class StaticTypeInferrer {
  constructor(
    private parser: TypeParser,
    private flowAnalyzer: DataFlowAnalyzer
  ) {}

  async inferTypes(file: SourceFile): Promise<InferredTypes> {
    const ast = await this.parser.parse(file);
    const flowGraph = await this.flowAnalyzer.analyze(ast);

    const inferredTypes: InferredTypes = {
      functions: [],
      classes: [],
      variables: [],
      parameters: [],
      returnTypes: [],
      generics: [],
      confidence: new Map(),
    };

    // Infer variable types
    for (const variable of this.extractVariables(ast)) {
      const type = await this.inferVariableType(variable, flowGraph);
      inferredTypes.variables.push(type);
      inferredTypes.confidence.set(variable.name, type.confidence);
    }

    // Infer function signatures
    for (const func of this.extractFunctions(ast)) {
      const type = await this.inferFunctionType(func, flowGraph);
      inferredTypes.functions.push(type);
      inferredTypes.confidence.set(func.name, type.confidence);
    }

    // Infer class types
    for (const cls of this.extractClasses(ast)) {
      const type = await this.inferClassType(cls, flowGraph);
      inferredTypes.classes.push(type);
      inferredTypes.confidence.set(cls.name, type.confidence);
    }

    return inferredTypes;
  }

  private async inferVariableType(
    variable: VariableNode,
    flowGraph: DataFlowGraph
  ): Promise<VariableType> {
    // Get all assignments to this variable
    const assignments = flowGraph.getAssignments(variable.name);

    if (assignments.length === 0) {
      return { name: variable.name, type: 'unknown', confidence: 0 };
    }

    // Infer type from assignment values
    const assignmentTypes = assignments.map(a => this.inferExpressionType(a.value));

    // If all assignments have same type, high confidence
    if (this.allSameType(assignmentTypes)) {
      return {
        name: variable.name,
        type: assignmentTypes[0],
        confidence: 0.95,
      };
    }

    // Multiple types - create union
    const unionType = this.createUnionType(assignmentTypes);
    return {
      name: variable.name,
      type: unionType,
      confidence: 0.7,
    };
  }

  private inferExpressionType(expr: ExpressionNode): Type {
    switch (expr.type) {
      case 'Literal':
        return this.inferLiteralType(expr);

      case 'ArrayExpression':
        const elementTypes = expr.elements.map(e => this.inferExpressionType(e));
        const commonType = this.findCommonType(elementTypes);
        return { kind: 'array', elementType: commonType };

      case 'ObjectExpression':
        const properties = expr.properties.map(p => ({
          name: p.key.name,
          type: this.inferExpressionType(p.value),
        }));
        return { kind: 'object', properties };

      case 'CallExpression':
        return this.inferCallReturnType(expr);

      case 'BinaryExpression':
        return this.inferBinaryExpressionType(expr);

      case 'Identifier':
        return this.lookupIdentifierType(expr.name);

      default:
        return { kind: 'unknown' };
    }
  }

  private async inferFunctionType(
    func: FunctionNode,
    flowGraph: DataFlowGraph
  ): Promise<FunctionType> {
    // Infer parameter types
    const parameters = await Promise.all(
      func.params.map(async param => {
        const usages = flowGraph.getUsages(param.name);
        const type = this.inferParameterTypeFromUsage(param, usages);
        return { name: param.name, type, confidence: type.confidence };
      })
    );

    // Infer return type
    const returnStatements = this.findReturnStatements(func);
    const returnTypes = returnStatements.map(r =>
      r.argument ? this.inferExpressionType(r.argument) : { kind: 'void' }
    );

    const returnType = returnTypes.length === 0
      ? { kind: 'void' }
      : this.createUnionType(returnTypes);

    // Check for async
    const isAsync = func.async || this.returnsPromise(returnType);

    return {
      name: func.name,
      parameters,
      returnType: isAsync ? this.wrapInPromise(returnType) : returnType,
      isAsync,
      confidence: this.calculateFunctionConfidence(parameters, returnType),
    };
  }

  private inferParameterTypeFromUsage(
    param: ParameterNode,
    usages: Usage[]
  ): TypeWithConfidence {
    const constraints: Type[] = [];

    for (const usage of usages) {
      // Property access suggests object type
      if (usage.type === 'property_access') {
        constraints.push({
          kind: 'object',
          properties: [{ name: usage.property, type: { kind: 'unknown' } }],
        });
      }

      // Method call suggests interface
      if (usage.type === 'method_call') {
        constraints.push({
          kind: 'interface',
          methods: [{ name: usage.method, signature: { kind: 'unknown' } }],
        });
      }

      // Array operations suggest array type
      if (usage.type === 'array_operation') {
        constraints.push({
          kind: 'array',
          elementType: { kind: 'unknown' },
        });
      }

      // Arithmetic operations suggest number
      if (usage.type === 'arithmetic') {
        constraints.push({ kind: 'number' });
      }

      // String operations suggest string
      if (usage.type === 'string_operation') {
        constraints.push({ kind: 'string' });
      }
    }

    return this.mergeConstraints(constraints);
  }
}
```

### Strategy 2: Runtime Type Sampling

Collect types from actual execution.

```typescript
class RuntimeTypeSampler {
  constructor(
    private instrumenter: CodeInstrumenter,
    private collector: TypeCollector
  ) {}

  async sampleTypes(file: SourceFile, testSuite: TestSuite): Promise<RuntimeTypes> {
    // Instrument the code
    const instrumentedCode = await this.instrumenter.instrument(file);

    // Run tests to collect type samples
    const samples = await this.runWithCollection(instrumentedCode, testSuite);

    // Aggregate samples into types
    return this.aggregateSamples(samples);
  }

  private async instrument(file: SourceFile): Promise<InstrumentedCode> {
    const ast = parse(file.content);

    // Add type collection at function boundaries
    traverse(ast, {
      FunctionDeclaration: (path) => {
        this.instrumentFunction(path);
      },
      FunctionExpression: (path) => {
        this.instrumentFunction(path);
      },
      ArrowFunctionExpression: (path) => {
        this.instrumentFunction(path);
      },
    });

    return generate(ast);
  }

  private instrumentFunction(path: NodePath): void {
    const funcName = this.getFunctionName(path);

    // Add parameter type collection
    for (const param of path.node.params) {
      const paramName = this.getParamName(param);
      path.get('body').unshiftContainer('body',
        this.createTypeCollectionCall(funcName, paramName, param)
      );
    }

    // Add return type collection
    path.traverse({
      ReturnStatement: (returnPath) => {
        if (returnPath.node.argument) {
          returnPath.replaceWith(
            this.createReturnTypeCollection(funcName, returnPath.node.argument)
          );
        }
      },
    });
  }

  private createTypeCollectionCall(funcName: string, paramName: string, param: Node): Node {
    // __collectType__('funcName', 'paramName', paramValue)
    return t.expressionStatement(
      t.callExpression(
        t.identifier('__collectType__'),
        [
          t.stringLiteral(funcName),
          t.stringLiteral(paramName),
          t.identifier(paramName),
        ]
      )
    );
  }

  private aggregateSamples(samples: TypeSample[]): RuntimeTypes {
    const typeMap = new Map<string, TypeSample[]>();

    // Group samples by location
    for (const sample of samples) {
      const key = `${sample.funcName}:${sample.paramName}`;
      if (!typeMap.has(key)) {
        typeMap.set(key, []);
      }
      typeMap.get(key)!.push(sample);
    }

    // Aggregate each group into a type
    const types: RuntimeType[] = [];
    for (const [key, samples] of typeMap) {
      const [funcName, paramName] = key.split(':');
      const type = this.aggregateSamplesToType(samples);
      types.push({ funcName, paramName, type, sampleCount: samples.length });
    }

    return { types };
  }

  private aggregateSamplesToType(samples: TypeSample[]): Type {
    const observedTypes = new Set<string>();

    for (const sample of samples) {
      const type = this.getTypeFromValue(sample.value);
      observedTypes.add(this.typeToString(type));
    }

    if (observedTypes.size === 1) {
      return this.parseType(Array.from(observedTypes)[0]);
    }

    // Multiple types observed - create union
    return {
      kind: 'union',
      types: Array.from(observedTypes).map(t => this.parseType(t)),
    };
  }

  private getTypeFromValue(value: any): Type {
    if (value === null) return { kind: 'null' };
    if (value === undefined) return { kind: 'undefined' };

    const jsType = typeof value;

    switch (jsType) {
      case 'string': return { kind: 'string' };
      case 'number': return { kind: 'number' };
      case 'boolean': return { kind: 'boolean' };
      case 'function': return { kind: 'function' };
      case 'object':
        if (Array.isArray(value)) {
          const elementTypes = value.map(v => this.getTypeFromValue(v));
          return { kind: 'array', elementType: this.mergeTypes(elementTypes) };
        }
        return this.inferObjectType(value);
      default:
        return { kind: 'unknown' };
    }
  }
}
```

### Strategy 3: LLM-Assisted Inference

Use AI for complex or ambiguous types.

```typescript
class LLMTypeInferrer {
  constructor(
    private llmClient: AnthropicClient,
    private typeChecker: TypeChecker
  ) {}

  async inferComplexTypes(
    file: SourceFile,
    ambiguousTypes: AmbiguousType[]
  ): Promise<InferredType[]> {
    const results: InferredType[] = [];

    for (const ambiguous of ambiguousTypes) {
      const type = await this.inferType(ambiguous, file);
      results.push(type);
    }

    return results;
  }

  private async inferType(
    ambiguous: AmbiguousType,
    file: SourceFile
  ): Promise<InferredType> {
    const context = this.extractContext(file, ambiguous.location);

    const prompt = `
Infer the TypeScript type for the following code element:

Element: ${ambiguous.name}
Kind: ${ambiguous.kind}
Code:
\`\`\`typescript
${ambiguous.code}
\`\`\`

Surrounding context:
\`\`\`typescript
${context}
\`\`\`

Current inference attempts:
${ambiguous.attempts.map(a => `- ${a.type} (confidence: ${a.confidence})`).join('\n')}

Consider:
1. How is this element used in the code?
2. What values are assigned to it?
3. What methods/properties are accessed on it?
4. Are there any type guards or assertions?
5. What would make sense semantically?

Return JSON:
{
  "type": "<typescript type annotation>",
  "reasoning": "<brief explanation>",
  "confidence": <0-1>,
  "alternatives": ["<alternative type 1>", "<alternative type 2>"]
}
`;

    const response = await this.llmClient.complete({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.2,
    });

    const result = JSON.parse(response.content);

    // Validate the inferred type
    const validated = await this.validateInferredType(result.type, ambiguous, file);

    return {
      name: ambiguous.name,
      type: validated.valid ? result.type : result.alternatives[0] || 'unknown',
      confidence: validated.valid ? result.confidence : result.confidence * 0.5,
      reasoning: result.reasoning,
      source: 'llm',
    };
  }

  private async validateInferredType(
    type: string,
    ambiguous: AmbiguousType,
    file: SourceFile
  ): Promise<ValidationResult> {
    // Create a test file with the inferred type
    const testCode = this.applyTypeAnnotation(file.content, ambiguous, type);

    // Run TypeScript compiler
    const diagnostics = await this.typeChecker.check(testCode);

    // Filter errors related to this annotation
    const relatedErrors = diagnostics.filter(d =>
      d.start && d.start >= ambiguous.location.start && d.start <= ambiguous.location.end
    );

    return {
      valid: relatedErrors.length === 0,
      errors: relatedErrors,
    };
  }
}
```

### Strategy 4: Type Definition Generator

Generate missing .d.ts files for JavaScript libraries.

```typescript
class TypeDefinitionGenerator {
  constructor(
    private staticInferrer: StaticTypeInferrer,
    private llmInferrer: LLMTypeInferrer
  ) {}

  async generateDefinitions(jsLibrary: JSLibrary): Promise<TypeDefinition> {
    // Analyze library exports
    const exports = await this.analyzeExports(jsLibrary);

    // Infer types for each export
    const definitions: Definition[] = [];

    for (const exp of exports) {
      const definition = await this.generateDefinition(exp, jsLibrary);
      definitions.push(definition);
    }

    // Generate .d.ts file
    return this.assembleDefinitionFile(jsLibrary.name, definitions);
  }

  private async generateDefinition(
    exp: LibraryExport,
    library: JSLibrary
  ): Promise<Definition> {
    switch (exp.type) {
      case 'function':
        return this.generateFunctionDefinition(exp, library);

      case 'class':
        return this.generateClassDefinition(exp, library);

      case 'object':
        return this.generateObjectDefinition(exp, library);

      case 'constant':
        return this.generateConstantDefinition(exp, library);

      default:
        return { name: exp.name, type: 'any' };
    }
  }

  private async generateFunctionDefinition(
    exp: FunctionExport,
    library: JSLibrary
  ): Promise<FunctionDefinition> {
    // Analyze function signature
    const signature = await this.staticInferrer.inferFunctionType(exp.node, library.flowGraph);

    // If low confidence, use LLM
    if (signature.confidence < 0.8) {
      const llmResult = await this.llmInferrer.inferType({
        name: exp.name,
        kind: 'function',
        code: exp.source,
        location: exp.location,
        attempts: [{ type: this.typeToString(signature), confidence: signature.confidence }],
      }, library.mainFile);

      return {
        kind: 'function',
        name: exp.name,
        parameters: this.parseParameterTypes(llmResult.type),
        returnType: this.parseReturnType(llmResult.type),
        overloads: [],
      };
    }

    return {
      kind: 'function',
      name: exp.name,
      parameters: signature.parameters,
      returnType: signature.returnType,
      overloads: [],
    };
  }

  private assembleDefinitionFile(name: string, definitions: Definition[]): string {
    let content = `// Type definitions for ${name}\n`;
    content += `// Generated by Forge Factory Type Annotation Engine\n\n`;

    content += `declare module '${name}' {\n`;

    for (const def of definitions) {
      content += this.definitionToString(def, 1);
      content += '\n\n';
    }

    content += '}\n';

    return content;
  }

  private definitionToString(def: Definition, indent: number): string {
    const spaces = '  '.repeat(indent);

    switch (def.kind) {
      case 'function':
        const params = def.parameters
          .map(p => `${p.name}: ${this.typeToString(p.type)}`)
          .join(', ');
        return `${spaces}export function ${def.name}(${params}): ${this.typeToString(def.returnType)};`;

      case 'class':
        let classStr = `${spaces}export class ${def.name}`;
        if (def.extends) {
          classStr += ` extends ${def.extends}`;
        }
        classStr += ' {\n';

        for (const member of def.members) {
          classStr += this.memberToString(member, indent + 1) + '\n';
        }

        classStr += `${spaces}}`;
        return classStr;

      case 'interface':
        let intStr = `${spaces}export interface ${def.name} {\n`;
        for (const prop of def.properties) {
          intStr += `${spaces}  ${prop.name}${prop.optional ? '?' : ''}: ${this.typeToString(prop.type)};\n`;
        }
        intStr += `${spaces}}`;
        return intStr;

      default:
        return `${spaces}export const ${def.name}: ${this.typeToString(def.type)};`;
    }
  }
}
```

### Type Annotation Orchestrator

```typescript
class TypeAnnotationOrchestrator {
  constructor(
    private staticInferrer: StaticTypeInferrer,
    private runtimeSampler: RuntimeTypeSampler,
    private llmInferrer: LLMTypeInferrer,
    private definitionGenerator: TypeDefinitionGenerator,
    private config: TypeAnnotationConfig
  ) {}

  async annotateFile(file: SourceFile): Promise<AnnotatedFile> {
    // Step 1: Static analysis
    const staticTypes = await this.staticInferrer.inferTypes(file);

    // Step 2: Runtime sampling (if test suite available)
    let runtimeTypes: RuntimeTypes | null = null;
    if (file.testSuite) {
      runtimeTypes = await this.runtimeSampler.sampleTypes(file, file.testSuite);
    }

    // Step 3: Merge static and runtime types
    const mergedTypes = this.mergeTypes(staticTypes, runtimeTypes);

    // Step 4: Identify low-confidence types
    const ambiguousTypes = this.identifyAmbiguous(mergedTypes);

    // Step 5: LLM inference for ambiguous types
    let llmTypes: InferredType[] = [];
    if (ambiguousTypes.length > 0) {
      llmTypes = await this.llmInferrer.inferComplexTypes(file, ambiguousTypes);
    }

    // Step 6: Final merge
    const finalTypes = this.finalMerge(mergedTypes, llmTypes);

    // Step 7: Apply annotations
    const annotatedCode = this.applyAnnotations(file.content, finalTypes);

    // Step 8: Validate
    const validation = await this.validateAnnotations(annotatedCode, file.language);

    return {
      original: file.content,
      annotated: annotatedCode,
      types: finalTypes,
      validation,
      coverage: this.calculateCoverage(finalTypes),
    };
  }

  private mergeTypes(staticTypes: InferredTypes, runtimeTypes: RuntimeTypes | null): MergedTypes {
    const merged: MergedTypes = { ...staticTypes };

    if (!runtimeTypes) return merged;

    // For each runtime type, compare with static and update confidence
    for (const runtimeType of runtimeTypes.types) {
      const staticType = this.findMatchingStaticType(staticTypes, runtimeType);

      if (staticType) {
        // If types match, boost confidence
        if (this.typesMatch(staticType.type, runtimeType.type)) {
          merged.confidence.set(
            runtimeType.funcName + ':' + runtimeType.paramName,
            Math.min(staticType.confidence + 0.2, 1)
          );
        } else {
          // Types differ - use runtime as it's more accurate
          this.updateType(merged, runtimeType);
        }
      } else {
        // New type from runtime
        this.addType(merged, runtimeType);
      }
    }

    return merged;
  }

  private applyAnnotations(code: string, types: FinalTypes): string {
    let annotatedCode = code;

    // Sort annotations by position (reverse order to maintain positions)
    const sortedAnnotations = this.createAnnotations(types)
      .sort((a, b) => b.position - a.position);

    for (const annotation of sortedAnnotations) {
      annotatedCode = this.insertAnnotation(annotatedCode, annotation);
    }

    return annotatedCode;
  }

  private insertAnnotation(code: string, annotation: Annotation): string {
    const { position, type, kind } = annotation;

    switch (kind) {
      case 'parameter':
        // Insert after parameter name: name -> name: Type
        return code.slice(0, position) + `: ${type}` + code.slice(position);

      case 'return':
        // Insert before function body: ) -> ): Type
        return code.slice(0, position) + `: ${type}` + code.slice(position);

      case 'variable':
        // Insert after variable name: let x = -> let x: Type =
        return code.slice(0, position) + `: ${type}` + code.slice(position);

      default:
        return code;
    }
  }
}
```

---

## Consequences

### Positive

1. **Speed:** 100x faster than manual annotation
2. **Accuracy:** Multi-strategy approach achieves >95% accuracy
3. **Coverage:** Can achieve 100% type coverage
4. **Consistency:** Uniform type style
5. **IDE Support:** Better autocompletion and error detection

### Negative

1. **Complexity:** Multiple inference strategies to maintain
2. **Build Impact:** May introduce type errors in existing code
3. **Any Proliferation:** Low confidence types become `any`
4. **Learning Curve:** Team must understand generated types

### Trade-offs

- **Strictness vs. Compatibility:** Stricter types may break builds
- **Accuracy vs. Speed:** LLM inference is slow but accurate
- **Coverage vs. Precision:** 100% coverage may require `any`

---

## Implementation Plan

### Phase 1: Static Inference (Week 1-2)
- Implement AST-based type inference
- Build data flow analyzer
- Create type constraint solver

### Phase 2: Runtime Sampling (Week 3-4)
- Implement code instrumentation
- Build type collector
- Create sample aggregator

### Phase 3: LLM Integration (Week 5-6)
- Implement LLM type inferrer
- Build validation pipeline
- Create fallback handling

### Phase 4: Definition Generation (Week 7-8)
- Build .d.ts generator
- Implement library analyzer
- Create type definition publisher

---

## References

- [TypeScript Handbook - Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html)
- [Python Type Hints PEP 484](https://www.python.org/dev/peps/pep-0484/)
- [MonkeyType - Runtime Type Collection](https://github.com/Instagram/MonkeyType)
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)

---

**Decision Maker:** Engineering Lead + Type System Expert
**Approved By:** Engineering Leadership
**Implementation Owner:** Code Transformation Team
