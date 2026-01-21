# ADR-032: Legacy System Modernization Playbook

## Status
Proposed

## Context

Over **70% of Fortune 5000 companies** run software systems that are **more than 20 years old**, built before cloud-native, mobile-first, and security-by-design architectures existed. These legacy systems represent **$100B+ annually** in maintenance costs, block innovation, and create significant technical and security risks.

### The Legacy Crisis

**Market Reality (2026)**:
- **85% of enterprises** have critical applications >10 years old
- **$50B annual market** for legacy modernization services
- **Airbnb case study**: LLM-driven migration completed 3,500 React files in 6 weeks vs 1.5 years manually
- **Goldman Sachs**: Auto-coding improved developer proficiency by 20%
- **AWS Transform**: Promises 5x faster modernization, 70% lower Windows licensing costs

### Common Legacy Challenges

| Challenge | Impact | Business Risk |
|-----------|--------|---------------|
| COBOL/Mainframe systems | 95% of ATM transactions | Talent shortage, $2B+ annual maintenance |
| Monolithic architectures | 40% slower feature delivery | Competition gap |
| Outdated frameworks (.NET 2.0, Java 6) | Security vulnerabilities | Compliance failures |
| Undocumented systems | 70% knowledge in retirees' heads | Business continuity risk |
| Technical debt accumulation | 35% dev time on maintenance | Innovation stagnation |

### AI-Powered Modernization Opportunity

Forge Factory's code transformation platform enables:
- **Automated code translation** (COBOL → Java, VB6 → C#)
- **Intelligent refactoring** with semantic understanding
- **Test generation** for legacy systems without tests
- **Documentation generation** from code analysis
- **Incremental migration** with strangler fig patterns

## Decision

We will implement a comprehensive **Legacy System Modernization Playbook** that provides enterprises with structured methodology, AI-augmented tooling, and incremental migration patterns for safely modernizing legacy applications.

## Playbook Structure

### Phase 1: Legacy Discovery & Assessment (Weeks 1-8)

#### 1.1 Application Portfolio Discovery

```typescript
interface LegacyPortfolioDiscovery {
  discoveryScope: DiscoveryScope;
  applications: LegacyApplicationProfile[];
  dependencies: DependencyGraph;
  dataFlows: DataFlowAnalysis;
  integrationPoints: IntegrationInventory;
}

interface LegacyApplicationProfile {
  id: string;
  name: string;
  technology: LegacyTechnology;
  age: number;
  linesOfCode: number;
  complexity: ComplexityScore;
  businessCriticality: CriticalityLevel;
  knowledgeRetention: KnowledgeScore;

  // AI-assessed metrics
  aiAnalysis: {
    codeQuality: number;
    testCoverage: number;
    documentationLevel: number;
    securityVulnerabilities: VulnerabilityReport;
    modernizationComplexity: number;
    estimatedEffort: EffortEstimate;
  };
}

interface LegacyTechnology {
  primaryLanguage: 'COBOL' | 'VB6' | 'PowerBuilder' | 'Delphi' | 'Classic ASP' |
                   'Java 6-8' | '.NET Framework' | 'RPG' | 'Fortran' | 'C' | 'other';
  frameworks: string[];
  database: LegacyDatabase;
  platform: 'mainframe' | 'midrange' | 'windows-server' | 'unix' | 'other';
  deploymentModel: 'on-premise' | 'hosted' | 'hybrid';
}
```

#### 1.2 Code Intelligence Analysis

```typescript
interface CodeIntelligenceAnalysis {
  staticAnalysis: StaticAnalysisReport;
  dynamicAnalysis: DynamicAnalysisReport;
  semanticUnderstanding: SemanticModel;
  businessRuleExtraction: BusinessRule[];
  deadCodeIdentification: DeadCodeReport;
}

interface SemanticModel {
  businessEntities: BusinessEntity[];
  businessProcesses: BusinessProcess[];
  dataTransformations: DataTransformation[];
  integrationContracts: IntegrationContract[];
  implicitBehaviors: ImplicitBehavior[];
}

interface BusinessRule {
  id: string;
  location: CodeLocation;
  description: string;
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
  aiExtracted: boolean;
  humanValidated: boolean;
}
```

#### 1.3 Modernization Readiness Assessment

```typescript
interface ModernizationReadinessAssessment {
  applicationReadiness: ApplicationReadinessScore[];
  organizationalReadiness: OrganizationalReadiness;
  technicalReadiness: TechnicalReadiness;
  riskAssessment: ModernizationRiskAssessment;
  recommendedApproach: ModernizationRecommendation[];
}

interface ApplicationReadinessScore {
  applicationId: string;
  scores: {
    codeQuality: number;
    testability: number;
    modularity: number;
    documentationQuality: number;
    dependencyCoupling: number;
    aiTransformability: number;
  };
  overallReadiness: number;
  blockers: ReadinessBlocker[];
  enablers: ReadinessEnabler[];
}
```

### Phase 2: Modernization Strategy (Weeks 4-12)

#### 2.1 Disposition Analysis (7 Rs)

```typescript
enum ModernizationDisposition {
  RETAIN = 'retain',           // Keep as-is (strategic value, low risk)
  RETIRE = 'retire',           // Decommission
  REHOST = 'rehost',           // Lift and shift to cloud
  REPLATFORM = 'replatform',   // Lift, tinker, shift (minimal changes)
  REFACTOR = 'refactor',       // Incremental improvement
  REARCHITECT = 'rearchitect', // Significant restructuring
  REBUILD = 'rebuild'          // Rewrite from scratch
}

interface DispositionAnalysis {
  applicationId: string;
  recommendedDisposition: ModernizationDisposition;
  alternativeDispositions: DispositionAlternative[];
  decisionFactors: DispositionFactor[];
  aiRecommendation: AIDispositionRecommendation;
  costBenefitAnalysis: CostBenefitAnalysis;
}

interface DispositionFactor {
  factor: string;
  weight: number;
  currentScore: number;
  rationale: string;
}

const DISPOSITION_FACTORS = [
  { factor: 'Business Value', weight: 0.25 },
  { factor: 'Technical Condition', weight: 0.20 },
  { factor: 'Modernization Complexity', weight: 0.15 },
  { factor: 'AI Transformation Potential', weight: 0.15 },
  { factor: 'Risk Level', weight: 0.15 },
  { factor: 'Available Alternatives', weight: 0.10 }
];
```

#### 2.2 Target Architecture Design

```typescript
interface TargetArchitectureDesign {
  applicationId: string;
  currentArchitecture: ArchitectureSnapshot;
  targetArchitecture: TargetArchitecture;
  transitionArchitecture: TransitionArchitecture[];
  migrationPattern: MigrationPattern;
}

interface TargetArchitecture {
  style: 'microservices' | 'modular-monolith' | 'serverless' | 'event-driven' | 'hybrid';
  platform: CloudPlatform;
  languageRuntime: ModernRuntime;
  dataArchitecture: ModernDataArchitecture;
  integrationPattern: IntegrationPattern;

  components: ArchitectureComponent[];
  apiContracts: APIContract[];
  dataContracts: DataContract[];
}

enum MigrationPattern {
  STRANGLER_FIG = 'strangler-fig',           // Gradual replacement
  BRANCH_BY_ABSTRACTION = 'branch-abstraction', // Internal branching
  PARALLEL_RUN = 'parallel-run',              // Side-by-side validation
  BIG_BANG = 'big-bang',                      // Complete cutover
  FEATURE_TOGGLE = 'feature-toggle',          // Feature-based migration
  CANARY = 'canary'                           // Traffic-based rollout
}
```

#### 2.3 AI Transformation Planning

```typescript
interface AITransformationPlan {
  applicationId: string;
  transformationTasks: AITransformationTask[];
  humanReviewPoints: ReviewCheckpoint[];
  qualityGates: QualityGate[];
  rollbackPlan: RollbackStrategy;
}

interface AITransformationTask {
  id: string;
  taskType: LegacyTransformationType;
  scope: TransformationScope;
  sourceCode: CodeReference;
  targetSpecification: TransformationSpec;

  automationLevel: AutomationLevel;
  estimatedAccuracy: number;
  humanReviewRequired: boolean;
  dependencies: string[];
}

enum LegacyTransformationType {
  LANGUAGE_TRANSLATION = 'language-translation',    // COBOL → Java
  FRAMEWORK_MIGRATION = 'framework-migration',      // Struts → Spring
  DATABASE_MIGRATION = 'database-migration',        // DB2 → PostgreSQL
  API_EXTRACTION = 'api-extraction',                // Extract APIs from monolith
  TEST_GENERATION = 'test-generation',              // Generate tests for legacy
  DOCUMENTATION = 'documentation',                  // Generate docs
  REFACTORING = 'refactoring',                      // Improve code quality
  SECURITY_HARDENING = 'security-hardening'         // Fix vulnerabilities
}

enum AutomationLevel {
  FULLY_AUTOMATED = 'fully-automated',     // AI handles completely
  ASSISTED = 'assisted',                   // AI drafts, human validates
  SUPERVISED = 'supervised',               // Human guides, AI executes
  MANUAL = 'manual'                        // Human handles, AI assists
}
```

### Phase 3: Incremental Migration (Months 3-24)

#### 3.1 Strangler Fig Implementation

```typescript
interface StranglerFigImplementation {
  legacyApplication: ApplicationReference;
  stranglerFacade: FacadeConfiguration;
  migrationSlices: MigrationSlice[];
  trafficRouting: TrafficRoutingConfig;
  rollbackTriggers: RollbackTrigger[];
}

interface MigrationSlice {
  id: string;
  name: string;
  functionality: FunctionalityScope;

  legacyComponents: CodeReference[];
  modernComponents: ModernComponent[];

  migrationSteps: MigrationStep[];
  validationCriteria: ValidationCriterion[];
  rolloutStrategy: RolloutStrategy;

  status: MigrationStatus;
  metrics: MigrationMetrics;
}

interface MigrationStep {
  order: number;
  action: MigrationAction;
  description: string;

  aiTasks: AITransformationTask[];
  manualTasks: ManualTask[];

  prerequisites: string[];
  validations: Validation[];
  rollback: RollbackProcedure;
}

enum MigrationAction {
  EXTRACT_INTERFACE = 'extract-interface',
  IMPLEMENT_MODERN = 'implement-modern',
  SETUP_ROUTING = 'setup-routing',
  PARALLEL_RUN = 'parallel-run',
  MIGRATE_DATA = 'migrate-data',
  VALIDATE = 'validate',
  CUTOVER = 'cutover',
  DECOMMISSION = 'decommission'
}
```

#### 3.2 AI-Powered Code Translation

```typescript
interface CodeTranslationPipeline {
  source: SourceCodeConfig;
  target: TargetCodeConfig;
  translationRules: TranslationRule[];
  semanticPreservation: SemanticPreservationConfig;
  qualityAssurance: TranslationQA;
}

interface TranslationRule {
  id: string;
  sourcePattern: CodePattern;
  targetPattern: CodePattern;
  semanticEquivalence: EquivalenceProof;
  edgeCases: EdgeCase[];
  testCases: TranslationTestCase[];
}

interface TranslationQA {
  staticValidation: StaticValidationConfig;
  semanticValidation: SemanticValidationConfig;
  behavioralValidation: BehavioralValidationConfig;
  performanceValidation: PerformanceValidationConfig;
}

interface BehavioralValidationConfig {
  testStrategy: 'record-replay' | 'property-based' | 'golden-master' | 'contract';
  coverageTarget: number;
  comparisonTolerance: ToleranceConfig;
  productionTrafficSampling: TrafficSamplingConfig;
}
```

#### 3.3 Data Migration Strategy

```typescript
interface DataMigrationStrategy {
  sourceDatabase: DatabaseConfig;
  targetDatabase: DatabaseConfig;
  migrationApproach: DataMigrationApproach;
  schemaEvolution: SchemaEvolutionPlan;
  dataSynchronization: SyncConfig;
  validationStrategy: DataValidationStrategy;
}

enum DataMigrationApproach {
  OFFLINE_MIGRATION = 'offline',           // Downtime-based migration
  ONLINE_MIGRATION = 'online',             // Zero-downtime CDC
  DUAL_WRITE = 'dual-write',               // Write to both, read from legacy
  SHADOW_MIGRATION = 'shadow',             // Migrate in background, validate
  INCREMENTAL = 'incremental'              // Batch-based incremental
}

interface SyncConfig {
  mechanism: 'cdc' | 'event-sourcing' | 'polling' | 'dual-write';
  direction: 'one-way' | 'bidirectional';
  conflictResolution: ConflictResolutionStrategy;
  latencyTarget: number;
  consistencyLevel: 'eventual' | 'strong';
}
```

### Phase 4: Validation & Cutover (Months 18-30)

#### 4.1 Comprehensive Validation Framework

```typescript
interface ValidationFramework {
  functionalValidation: FunctionalValidation;
  performanceValidation: PerformanceValidation;
  securityValidation: SecurityValidation;
  dataValidation: DataIntegrityValidation;
  businessValidation: BusinessValidation;
}

interface FunctionalValidation {
  testSuites: TestSuite[];
  coverageTargets: CoverageTarget[];
  regressionTesting: RegressionConfig;
  edgeCaseTesting: EdgeCaseConfig;
  aiGeneratedTests: AITestGeneration;
}

interface AITestGeneration {
  legacyBehaviorCapture: BehaviorCaptureConfig;
  testCaseGeneration: TestGenerationConfig;
  assertionGeneration: AssertionGenerationConfig;
  coverageAnalysis: CoverageAnalysisConfig;
}
```

#### 4.2 Production Cutover

```typescript
interface CutoverPlan {
  cutoverStrategy: CutoverStrategy;
  timeline: CutoverTimeline;
  checkpoints: CutoverCheckpoint[];
  rollbackPlan: DetailedRollbackPlan;
  communicationPlan: CommunicationPlan;
}

enum CutoverStrategy {
  BIG_BANG = 'big-bang',             // All at once
  PHASED = 'phased',                 // By functionality
  CANARY = 'canary',                 // By traffic percentage
  BLUE_GREEN = 'blue-green',         // Parallel environments
  ROLLING = 'rolling'                // Gradual instance replacement
}

interface CutoverCheckpoint {
  id: string;
  name: string;
  validations: ValidationCriterion[];
  goNoGoDecision: DecisionCriteria;
  rollbackTriggers: RollbackTrigger[];
  owner: string;
}
```

### Phase 5: Decommissioning & Optimization (Months 24-36)

#### 5.1 Legacy Decommissioning

```typescript
interface DecommissioningPlan {
  application: ApplicationReference;
  dependencies: DependencyInventory;
  decommissioningSteps: DecommissioningStep[];
  dataRetention: DataRetentionPlan;
  complianceRequirements: ComplianceRequirement[];
}

interface DecommissioningStep {
  order: number;
  action: DecommissioningAction;
  validation: ValidationCriterion[];
  rollback: RollbackProcedure;
  signoff: SignoffRequirement;
}

enum DecommissioningAction {
  REDIRECT_TRAFFIC = 'redirect-traffic',
  DISABLE_ENDPOINTS = 'disable-endpoints',
  ARCHIVE_DATA = 'archive-data',
  REVOKE_ACCESS = 'revoke-access',
  SHUTDOWN_SERVICES = 'shutdown-services',
  ARCHIVE_CODE = 'archive-code',
  RELEASE_RESOURCES = 'release-resources',
  UPDATE_DOCUMENTATION = 'update-documentation'
}
```

## Language-Specific Migration Guides

### COBOL to Java Migration

```typescript
interface COBOLToJavaMigration {
  cobolPatterns: COBOLPattern[];
  javaEquivalents: JavaEquivalent[];
  dataTypeMapping: DataTypeMapping[];
  fileHandlingMigration: FileHandlingStrategy;
  copyBookTranslation: CopyBookStrategy;
}

const COBOL_TO_JAVA_MAPPINGS = {
  dataTypes: {
    'PIC 9': 'int/long',
    'PIC X': 'String',
    'PIC S9 COMP-3': 'BigDecimal',
    'OCCURS': 'List/Array',
    'REDEFINES': 'Union type/inheritance'
  },
  constructs: {
    'PERFORM': 'method call/loop',
    'EVALUATE': 'switch',
    'COPY': 'import',
    'EXEC SQL': 'JDBC/JPA'
  }
};
```

### VB6/.NET Framework Migration

```typescript
interface VBMigrationStrategy {
  sourceVersion: 'VB6' | 'VB.NET' | '.NET Framework';
  targetVersion: '.NET 8' | '.NET 9';
  uiMigration: UIMigrationStrategy;
  comInterop: COMInteropStrategy;
  dataAccessMigration: DataAccessStrategy;
}

const VB_MIGRATION_CONSIDERATIONS = [
  'COM object dependencies',
  'Windows Forms to Blazor/MAUI',
  'ADO classic to Entity Framework',
  'VB-specific language features',
  'Third-party control replacements'
];
```

## Success Metrics

### Migration Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code Migration Accuracy | >99% | Behavioral equivalence testing |
| Performance Parity | ±10% | Load testing comparison |
| Defect Rate | <0.1% | Production issues post-migration |
| Migration Velocity | 10x manual | Lines/features per week |
| Cost Reduction | 60-80% | Annual maintenance savings |

### Business Outcomes

| Metric | Target | Timeline |
|--------|--------|----------|
| Time-to-Market | 5x improvement | Post-modernization |
| Operational Cost | 60% reduction | 12 months post |
| Security Posture | Zero critical vulns | Immediate |
| Talent Availability | 10x pool | Modern stack |
| Innovation Velocity | 3x feature delivery | 6 months post |

## Risk Management

```typescript
const LEGACY_MODERNIZATION_RISKS = [
  {
    risk: 'Behavioral regression',
    impact: 'critical',
    likelihood: 'high',
    mitigation: 'Comprehensive testing, parallel run, gradual rollout'
  },
  {
    risk: 'Undiscovered business rules',
    impact: 'high',
    likelihood: 'high',
    mitigation: 'AI code analysis, SME interviews, production traffic analysis'
  },
  {
    risk: 'Performance degradation',
    impact: 'high',
    likelihood: 'medium',
    mitigation: 'Performance testing, optimization iterations, caching strategies'
  },
  {
    risk: 'Data migration errors',
    impact: 'critical',
    likelihood: 'medium',
    mitigation: 'Comprehensive validation, reconciliation, rollback capability'
  },
  {
    risk: 'Integration breakage',
    impact: 'high',
    likelihood: 'high',
    mitigation: 'Contract testing, facade patterns, version management'
  }
];
```

## Consequences

### Positive
- AI-powered translation reduces migration time by 60-80%
- Incremental approach minimizes business disruption
- Comprehensive validation ensures behavioral equivalence
- Modern stack enables faster innovation
- Reduced operational costs fund future improvements

### Negative
- Significant upfront investment in assessment and planning
- Complex migrations may still require substantial manual effort
- Organizational knowledge transfer challenges
- Extended parallel operation costs during migration

### Risks
- Over-reliance on AI translation without adequate validation
- Scope creep as hidden complexity is discovered
- Business pressure to accelerate beyond safe velocity
- Loss of tribal knowledge during transition

## Related ADRs

- ADR-024: Change Management & Code Transformations
- ADR-031: Digital Transformation Playbook
- ADR-033: Cloud Migration & Hybrid Cloud Playbook
- ADR-035: Microservices & DDD Transformation Playbook

## References

- Gartner: Legacy Modernization Best Practices 2025
- AWS Mainframe Modernization Guide
- Google Cloud Legacy Assessment Framework
- Microsoft Azure Migration Center
- Forrester: AI-Powered Application Modernization
