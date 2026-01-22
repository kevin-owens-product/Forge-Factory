/**
 * @package @forge/feature-flags
 * @description TypeScript interfaces and types for feature flags
 */

// ============================================
// Core Flag Types
// ============================================

/**
 * Supported flag value types
 */
export type FlagValue = boolean | string | number | Record<string, unknown>;

/**
 * Flag types
 */
export enum FlagType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  JSON = 'json',
}

/**
 * Feature flag definition
 */
export interface FeatureFlag<T extends FlagValue = FlagValue> {
  /** Unique flag key */
  key: string;
  /** Flag type */
  type: FlagType;
  /** Human-readable name */
  name: string;
  /** Description of the flag's purpose */
  description?: string;
  /** Default value when no rules match */
  defaultValue: T;
  /** Whether the flag is enabled */
  enabled: boolean;
  /** Targeting rules */
  rules?: TargetingRule[];
  /** Multivariate variants */
  variants?: Variant<T>[];
  /** Percentage rollout (0-100) */
  rolloutPercentage?: number;
  /** Environment overrides */
  environmentOverrides?: Record<string, T>;
  /** Tags for organization */
  tags?: string[];
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
  /** Creation timestamp */
  createdAt?: Date;
  /** Last update timestamp */
  updatedAt?: Date;
}

// ============================================
// Targeting Types
// ============================================

/**
 * User context for flag evaluation
 */
export interface UserContext {
  /** User ID */
  id: string;
  /** Email address */
  email?: string;
  /** User role or roles */
  role?: string | string[];
  /** User groups/teams */
  groups?: string[];
  /** Custom attributes */
  attributes?: Record<string, unknown>;
  /** Tenant ID */
  tenantId?: string;
  /** IP address */
  ip?: string;
  /** Country code */
  country?: string;
  /** Device type */
  device?: 'mobile' | 'tablet' | 'desktop';
  /** Browser */
  browser?: string;
  /** Operating system */
  os?: string;
  /** App version */
  appVersion?: string;
  /** User creation date */
  createdAt?: Date;
  /** Is beta user */
  isBeta?: boolean;
  /** Is internal user */
  isInternal?: boolean;
}

/**
 * Targeting rule
 */
export interface TargetingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name?: string;
  /** Conditions that must be met */
  conditions: TargetingCondition[];
  /** Value to return if rule matches */
  value?: FlagValue;
  /** Variant ID to return if rule matches */
  variantId?: string;
  /** Rollout percentage for this rule */
  rolloutPercentage?: number;
  /** Priority (lower = higher priority) */
  priority?: number;
  /** Whether the rule is enabled */
  enabled?: boolean;
}

/**
 * Targeting condition operators
 */
export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES_REGEX = 'matches_regex',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  BETWEEN = 'between',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  SEMVER_EQUAL = 'semver_equal',
  SEMVER_GREATER_THAN = 'semver_greater_than',
  SEMVER_LESS_THAN = 'semver_less_than',
}

/**
 * Targeting condition
 */
export interface TargetingCondition {
  /** Attribute to evaluate */
  attribute: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value(s) to compare against */
  value: unknown;
}

// ============================================
// Segment Types
// ============================================

/**
 * User segment definition
 */
export interface Segment {
  /** Segment ID */
  id: string;
  /** Segment name */
  name: string;
  /** Description */
  description?: string;
  /** Rules that define segment membership */
  rules: TargetingCondition[];
  /** Static list of user IDs */
  includedUserIds?: string[];
  /** Static list of excluded user IDs */
  excludedUserIds?: string[];
  /** Tenant ID */
  tenantId?: string;
  /** Tags */
  tags?: string[];
  /** Creation timestamp */
  createdAt?: Date;
  /** Last update timestamp */
  updatedAt?: Date;
}

// ============================================
// Variant Types
// ============================================

/**
 * Multivariate variant
 */
export interface Variant<T extends FlagValue = FlagValue> {
  /** Variant ID */
  id: string;
  /** Variant name */
  name: string;
  /** Variant value */
  value: T;
  /** Weight for distribution (0-100) */
  weight: number;
  /** Description */
  description?: string;
}

/**
 * Variant evaluation result
 */
export interface VariantResult<T extends FlagValue = FlagValue> {
  /** Variant ID */
  variantId: string;
  /** Variant name */
  name: string;
  /** Variant value */
  value: T;
  /** Reason for selection */
  reason: EvaluationReason;
}

// ============================================
// Evaluation Types
// ============================================

/**
 * Reasons for flag evaluation result
 */
export enum EvaluationReason {
  /** Flag is disabled */
  FLAG_DISABLED = 'FLAG_DISABLED',
  /** No matching rules, using default */
  DEFAULT = 'DEFAULT',
  /** Matched a targeting rule */
  RULE_MATCH = 'RULE_MATCH',
  /** Matched a segment */
  SEGMENT_MATCH = 'SEGMENT_MATCH',
  /** User is in rollout percentage */
  ROLLOUT = 'ROLLOUT',
  /** Environment override applied */
  ENVIRONMENT_OVERRIDE = 'ENVIRONMENT_OVERRIDE',
  /** Individual user targeting */
  USER_TARGETING = 'USER_TARGETING',
  /** Error occurred during evaluation */
  ERROR = 'ERROR',
  /** Variant selected */
  VARIANT = 'VARIANT',
  /** From cache */
  CACHED = 'CACHED',
}

/**
 * Flag evaluation result
 */
export interface EvaluationResult<T extends FlagValue = FlagValue> {
  /** Flag key */
  flagKey: string;
  /** Evaluated value */
  value: T;
  /** Reason for the value */
  reason: EvaluationReason;
  /** ID of the rule that matched (if applicable) */
  ruleId?: string;
  /** ID of the variant selected (if applicable) */
  variantId?: string;
  /** Evaluation timestamp */
  timestamp: Date;
  /** Time taken to evaluate (ms) */
  evaluationTime?: number;
}

/**
 * Evaluation details for debugging
 */
export interface EvaluationDetails<T extends FlagValue = FlagValue> extends EvaluationResult<T> {
  /** Flag definition */
  flag: FeatureFlag<T>;
  /** User context used */
  userContext?: UserContext;
  /** Rules evaluated */
  rulesEvaluated?: {
    ruleId: string;
    matched: boolean;
    conditions: {
      attribute: string;
      operator: ConditionOperator;
      value: unknown;
      userValue: unknown;
      matched: boolean;
    }[];
  }[];
  /** Was result from cache */
  fromCache?: boolean;
}

// ============================================
// Cache Types
// ============================================

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** TTL in milliseconds */
  ttl: number;
  /** Maximum number of cached items */
  maxSize?: number;
  /** Cache key prefix */
  keyPrefix?: string;
}

/**
 * Cached flag data
 */
export interface CachedFlag<T extends FlagValue = FlagValue> {
  /** Cached value */
  value: T;
  /** Reason for the cached value */
  reason: EvaluationReason;
  /** When the cache entry was created */
  cachedAt: Date;
  /** When the cache entry expires */
  expiresAt: Date;
  /** Flag key */
  flagKey: string;
  /** User context hash */
  userHash?: string;
}

// ============================================
// Service Types
// ============================================

/**
 * Feature flag service configuration
 */
export interface FeatureFlagConfig {
  /** Cache configuration */
  cache?: CacheConfig;
  /** Default environment */
  environment?: string;
  /** Tenant ID for multi-tenant support */
  tenantId?: string;
  /** Event handlers */
  onEvaluation?: (result: EvaluationResult) => void;
  onError?: (error: Error, flagKey: string) => void;
  /** Flag provider/loader */
  flagProvider?: FlagProvider;
  /** Segment provider */
  segmentProvider?: SegmentProvider;
}

/**
 * Flag provider interface
 */
export interface FlagProvider {
  /** Get a flag by key */
  getFlag<T extends FlagValue>(key: string): Promise<FeatureFlag<T> | null>;
  /** Get all flags */
  getAllFlags(): Promise<FeatureFlag[]>;
  /** Subscribe to flag updates */
  subscribe?(callback: (flags: FeatureFlag[]) => void): () => void;
}

/**
 * Segment provider interface
 */
export interface SegmentProvider {
  /** Get a segment by ID */
  getSegment(id: string): Promise<Segment | null>;
  /** Get all segments */
  getAllSegments(): Promise<Segment[]>;
}

/**
 * In-memory flag provider
 */
export interface InMemoryFlagProviderConfig {
  /** Initial flags */
  flags?: FeatureFlag[];
  /** Initial segments */
  segments?: Segment[];
}

// ============================================
// React Types
// ============================================

/**
 * Feature flag provider props
 */
export interface FeatureFlagProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Feature flag service configuration */
  config?: FeatureFlagConfig;
  /** Initial flags (for SSR) */
  initialFlags?: FeatureFlag[];
  /** User context */
  userContext?: UserContext;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Error component */
  errorComponent?: React.ReactNode;
}

/**
 * Feature flag context value
 */
export interface FeatureFlagContextValue {
  /** Evaluate a boolean flag */
  isEnabled: (flagKey: string, defaultValue?: boolean) => boolean;
  /** Evaluate a flag with any value type */
  getValue: <T extends FlagValue>(flagKey: string, defaultValue: T) => T;
  /** Get flag evaluation details */
  getDetails: <T extends FlagValue>(flagKey: string, defaultValue: T) => EvaluationDetails<T>;
  /** Get variant for multivariate flag */
  getVariant: <T extends FlagValue>(flagKey: string) => VariantResult<T> | null;
  /** Current user context */
  userContext?: UserContext;
  /** Update user context */
  setUserContext: (context: UserContext) => void;
  /** Whether flags are loading */
  isLoading: boolean;
  /** Error if any */
  error?: Error;
  /** Refresh flags */
  refresh: () => Promise<void>;
}

/**
 * useFeatureFlag hook options
 */
export interface UseFeatureFlagOptions {
  /** Track impression */
  trackImpression?: boolean;
  /** Default value */
  defaultValue?: FlagValue;
}

/**
 * FeatureFlag component props
 */
export interface FeatureFlagComponentProps {
  /** Flag key to check */
  flagKey: string;
  /** Content to render when flag is enabled */
  children: React.ReactNode;
  /** Content to render when flag is disabled */
  fallback?: React.ReactNode;
  /** Default value if flag not found */
  defaultValue?: boolean;
}

/**
 * Feature component props (for multivariate)
 */
export interface FeatureComponentProps<T extends FlagValue = FlagValue> {
  /** Flag key */
  flagKey: string;
  /** Render function receiving the flag value */
  render: (value: T, variant?: VariantResult<T>) => React.ReactNode;
  /** Default value */
  defaultValue: T;
  /** Fallback content */
  fallback?: React.ReactNode;
}
