/**
 * @package @forge/feature-flags
 * @description Flag definition, evaluation, and in-memory provider
 */

import {
  FeatureFlag,
  FlagType,
  FlagValue,
  UserContext,
  EvaluationResult,
  EvaluationDetails,
  EvaluationReason,
  VariantResult,
  FlagProvider,
  SegmentProvider,
  Segment,
  InMemoryFlagProviderConfig,
} from './feature-flags.types';
import { TargetingEvaluator, evaluateRule, hashUserForRollout, isUserInSegment } from './targeting';
import { selectVariant, getVariantById } from './variants';

/**
 * Create a new feature flag
 */
export function createFlag<T extends FlagValue>(
  key: string,
  type: FlagType,
  defaultValue: T,
  options: Partial<Omit<FeatureFlag<T>, 'key' | 'type' | 'defaultValue'>> = {}
): FeatureFlag<T> {
  return {
    key,
    type,
    name: options.name || key,
    description: options.description,
    defaultValue,
    enabled: options.enabled ?? true,
    rules: options.rules || [],
    variants: options.variants,
    rolloutPercentage: options.rolloutPercentage,
    environmentOverrides: options.environmentOverrides,
    tags: options.tags,
    tenantId: options.tenantId,
    createdAt: options.createdAt || new Date(),
    updatedAt: options.updatedAt || new Date(),
  };
}

/**
 * Create a boolean flag
 */
export function createBooleanFlag(
  key: string,
  defaultValue: boolean,
  options: Partial<Omit<FeatureFlag<boolean>, 'key' | 'type' | 'defaultValue'>> = {}
): FeatureFlag<boolean> {
  return createFlag(key, FlagType.BOOLEAN, defaultValue, options);
}

/**
 * Create a string flag
 */
export function createStringFlag(
  key: string,
  defaultValue: string,
  options: Partial<Omit<FeatureFlag<string>, 'key' | 'type' | 'defaultValue'>> = {}
): FeatureFlag<string> {
  return createFlag(key, FlagType.STRING, defaultValue, options);
}

/**
 * Create a number flag
 */
export function createNumberFlag(
  key: string,
  defaultValue: number,
  options: Partial<Omit<FeatureFlag<number>, 'key' | 'type' | 'defaultValue'>> = {}
): FeatureFlag<number> {
  return createFlag(key, FlagType.NUMBER, defaultValue, options);
}

/**
 * Create a JSON flag
 */
export function createJsonFlag<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T,
  options: Partial<Omit<FeatureFlag<T>, 'key' | 'type' | 'defaultValue'>> = {}
): FeatureFlag<T> {
  return createFlag(key, FlagType.JSON, defaultValue, options);
}

/**
 * Flag evaluator
 */
export class FlagEvaluator {
  private targetingEvaluator: TargetingEvaluator;
  private environment?: string;

  constructor(options: { segments?: Segment[]; environment?: string } = {}) {
    this.targetingEvaluator = new TargetingEvaluator(options.segments);
    this.environment = options.environment;
  }

  /**
   * Set environment
   */
  setEnvironment(environment: string): void {
    this.environment = environment;
  }

  /**
   * Add segment
   */
  addSegment(segment: Segment): void {
    this.targetingEvaluator.addSegment(segment);
  }

  /**
   * Remove segment
   */
  removeSegment(segmentId: string): void {
    this.targetingEvaluator.removeSegment(segmentId);
  }

  /**
   * Evaluate a flag for a user
   */
  evaluate<T extends FlagValue>(
    flag: FeatureFlag<T>,
    userContext?: UserContext,
    defaultValue?: T
  ): EvaluationResult<T> {
    const startTime = performance.now();
    const fallback = defaultValue ?? flag.defaultValue;

    try {
      // Check if flag is enabled
      if (!flag.enabled) {
        return this.createResult(
          flag.key,
          fallback,
          EvaluationReason.FLAG_DISABLED,
          startTime
        );
      }

      // Check environment override
      if (this.environment && flag.environmentOverrides?.[this.environment] !== undefined) {
        return this.createResult(
          flag.key,
          flag.environmentOverrides[this.environment] as T,
          EvaluationReason.ENVIRONMENT_OVERRIDE,
          startTime
        );
      }

      // If no user context, use default
      if (!userContext) {
        return this.createResult(flag.key, fallback, EvaluationReason.DEFAULT, startTime);
      }

      // Evaluate targeting rules
      if (flag.rules && flag.rules.length > 0) {
        for (const rule of flag.rules) {
          const result = evaluateRule(rule, userContext, flag.key);
          if (result.matches) {
            // If rule specifies a variant
            if (result.variantId && flag.variants) {
              const variant = getVariantById(flag.variants, result.variantId);
              if (variant) {
                return this.createResult(
                  flag.key,
                  variant.value as T,
                  EvaluationReason.RULE_MATCH,
                  startTime,
                  rule.id,
                  variant.id
                );
              }
            }

            // If rule specifies a value
            if (result.value !== undefined) {
              return this.createResult(
                flag.key,
                result.value as T,
                EvaluationReason.RULE_MATCH,
                startTime,
                rule.id
              );
            }

            // Rule matched but no value, continue to variants or default
            break;
          }
        }
      }

      // Check multivariate variants
      if (flag.variants && flag.variants.length > 0) {
        const variantResult = selectVariant(flag.variants, userContext, flag.key);
        if (variantResult) {
          return this.createResult(
            flag.key,
            variantResult.value as T,
            EvaluationReason.VARIANT,
            startTime,
            undefined,
            variantResult.variantId
          );
        }
      }

      // Check rollout percentage
      if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
        const bucket = hashUserForRollout(userContext.id, flag.key);
        if (bucket >= flag.rolloutPercentage) {
          return this.createResult(flag.key, fallback, EvaluationReason.DEFAULT, startTime);
        }
        return this.createResult(flag.key, flag.defaultValue, EvaluationReason.ROLLOUT, startTime);
      }

      // Default value
      return this.createResult(flag.key, flag.defaultValue, EvaluationReason.DEFAULT, startTime);
    } catch (error) {
      return this.createResult(flag.key, fallback, EvaluationReason.ERROR, startTime);
    }
  }

  /**
   * Evaluate with detailed information
   */
  evaluateWithDetails<T extends FlagValue>(
    flag: FeatureFlag<T>,
    userContext?: UserContext,
    defaultValue?: T
  ): EvaluationDetails<T> {
    const result = this.evaluate(flag, userContext, defaultValue);

    const details: EvaluationDetails<T> = {
      ...result,
      flag,
      userContext,
      rulesEvaluated: [],
      fromCache: false,
    };

    // Add rule evaluation details
    if (flag.rules && userContext) {
      details.rulesEvaluated = flag.rules.map(rule => {
        const conditionResults = rule.conditions.map(condition => {
          const userValue = this.getAttributeValue(userContext, condition.attribute);
          return {
            attribute: condition.attribute,
            operator: condition.operator,
            value: condition.value,
            userValue,
            matched: false, // Simplified - would need full condition evaluation
          };
        });

        return {
          ruleId: rule.id,
          matched: result.ruleId === rule.id,
          conditions: conditionResults,
        };
      });
    }

    return details;
  }

  /**
   * Get variant for a flag
   */
  getVariant<T extends FlagValue>(
    flag: FeatureFlag<T>,
    userContext: UserContext
  ): VariantResult<T> | null {
    if (!flag.enabled || !flag.variants || flag.variants.length === 0) {
      return null;
    }

    // Check rules for variant specification
    if (flag.rules) {
      for (const rule of flag.rules) {
        const result = evaluateRule(rule, userContext, flag.key);
        if (result.matches && result.variantId) {
          const variant = getVariantById(flag.variants, result.variantId);
          if (variant) {
            return {
              variantId: variant.id,
              name: variant.name,
              value: variant.value,
              reason: EvaluationReason.RULE_MATCH,
            };
          }
        }
      }
    }

    return selectVariant(flag.variants, userContext, flag.key);
  }

  private createResult<T extends FlagValue>(
    flagKey: string,
    value: T,
    reason: EvaluationReason,
    startTime: number,
    ruleId?: string,
    variantId?: string
  ): EvaluationResult<T> {
    return {
      flagKey,
      value,
      reason,
      ruleId,
      variantId,
      timestamp: new Date(),
      evaluationTime: performance.now() - startTime,
    };
  }

  private getAttributeValue(context: UserContext, attribute: string): unknown {
    if (attribute === 'id') return context.id;
    if (attribute === 'email') return context.email;
    if (attribute === 'role') return context.role;
    if (context.attributes && attribute in context.attributes) {
      return context.attributes[attribute];
    }
    return undefined;
  }
}

/**
 * In-memory flag provider
 */
export class InMemoryFlagProvider implements FlagProvider, SegmentProvider {
  private flags: Map<string, FeatureFlag> = new Map();
  private segments: Map<string, Segment> = new Map();
  private subscribers: Set<(flags: FeatureFlag[]) => void> = new Set();

  constructor(config?: InMemoryFlagProviderConfig) {
    if (config?.flags) {
      config.flags.forEach(flag => this.flags.set(flag.key, flag));
    }
    if (config?.segments) {
      config.segments.forEach(segment => this.segments.set(segment.id, segment));
    }
  }

  /**
   * Get a flag by key
   */
  async getFlag<T extends FlagValue>(key: string): Promise<FeatureFlag<T> | null> {
    return (this.flags.get(key) as FeatureFlag<T>) ?? null;
  }

  /**
   * Get all flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return [...this.flags.values()];
  }

  /**
   * Set a flag
   */
  setFlag<T extends FlagValue>(flag: FeatureFlag<T>): void {
    this.flags.set(flag.key, flag);
    this.notifySubscribers();
  }

  /**
   * Update a flag
   */
  updateFlag<T extends FlagValue>(
    key: string,
    updates: Partial<Omit<FeatureFlag<T>, 'key'>>
  ): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;

    const updated = { ...flag, ...updates, updatedAt: new Date() };
    this.flags.set(key, updated);
    this.notifySubscribers();
    return true;
  }

  /**
   * Delete a flag
   */
  deleteFlag(key: string): boolean {
    const deleted = this.flags.delete(key);
    if (deleted) {
      this.notifySubscribers();
    }
    return deleted;
  }

  /**
   * Get a segment by ID
   */
  async getSegment(id: string): Promise<Segment | null> {
    return this.segments.get(id) ?? null;
  }

  /**
   * Get all segments
   */
  async getAllSegments(): Promise<Segment[]> {
    return [...this.segments.values()];
  }

  /**
   * Set a segment
   */
  setSegment(segment: Segment): void {
    this.segments.set(segment.id, segment);
  }

  /**
   * Delete a segment
   */
  deleteSegment(id: string): boolean {
    return this.segments.delete(id);
  }

  /**
   * Subscribe to flag updates
   */
  subscribe(callback: (flags: FeatureFlag[]) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  private notifySubscribers(): void {
    const flags = [...this.flags.values()];
    this.subscribers.forEach(callback => callback(flags));
  }

  /**
   * Clear all flags and segments
   */
  clear(): void {
    this.flags.clear();
    this.segments.clear();
    this.notifySubscribers();
  }

  /**
   * Check if user is in segment
   */
  isUserInSegment(segmentId: string, context: UserContext): boolean {
    const segment = this.segments.get(segmentId);
    if (!segment) return false;
    return isUserInSegment(segment, context);
  }

  /**
   * Get flags count
   */
  getFlagsCount(): number {
    return this.flags.size;
  }

  /**
   * Get segments count
   */
  getSegmentsCount(): number {
    return this.segments.size;
  }
}
