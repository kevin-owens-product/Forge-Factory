/**
 * @package @forge/feature-flags
 * @description Targeting and condition evaluation
 */

import {
  ConditionOperator,
  TargetingCondition,
  TargetingRule,
  UserContext,
  Segment,
  FlagValue,
} from './feature-flags.types';

/**
 * Hash function for consistent user bucketing
 */
export function hashUserForRollout(userId: string, flagKey: string): number {
  const str = `${flagKey}:${userId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 100);
}

/**
 * Compare two semver strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string): number[] => {
    const parts = v.replace(/^v/, '').split('.').map(p => parseInt(p, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };

  const p1 = parse(v1);
  const p2 = parse(v2);

  for (let i = 0; i < 3; i++) {
    if (p1[i] < p2[i]) return -1;
    if (p1[i] > p2[i]) return 1;
  }
  return 0;
}

/**
 * Get a nested attribute value from user context
 */
export function getAttributeValue(context: UserContext, attribute: string): unknown {
  if (attribute === 'id') return context.id;
  if (attribute === 'email') return context.email;
  if (attribute === 'role') return context.role;
  if (attribute === 'groups') return context.groups;
  if (attribute === 'tenantId') return context.tenantId;
  if (attribute === 'ip') return context.ip;
  if (attribute === 'country') return context.country;
  if (attribute === 'device') return context.device;
  if (attribute === 'browser') return context.browser;
  if (attribute === 'os') return context.os;
  if (attribute === 'appVersion') return context.appVersion;
  if (attribute === 'createdAt') return context.createdAt;
  if (attribute === 'isBeta') return context.isBeta;
  if (attribute === 'isInternal') return context.isInternal;

  // Check custom attributes
  if (attribute.startsWith('attributes.') && context.attributes) {
    const key = attribute.substring('attributes.'.length);
    const keys = key.split('.');
    let value: unknown = context.attributes;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    return value;
  }

  // Direct attribute access
  if (context.attributes && attribute in context.attributes) {
    return context.attributes[attribute];
  }

  return undefined;
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: TargetingCondition,
  context: UserContext
): boolean {
  const userValue = getAttributeValue(context, condition.attribute);
  const targetValue = condition.value;

  switch (condition.operator) {
    case ConditionOperator.EQUALS:
      return userValue === targetValue;

    case ConditionOperator.NOT_EQUALS:
      return userValue !== targetValue;

    case ConditionOperator.CONTAINS:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue.includes(targetValue);
      }
      if (Array.isArray(userValue)) {
        return userValue.includes(targetValue);
      }
      return false;

    case ConditionOperator.NOT_CONTAINS:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return !userValue.includes(targetValue);
      }
      if (Array.isArray(userValue)) {
        return !userValue.includes(targetValue);
      }
      return true;

    case ConditionOperator.STARTS_WITH:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue.startsWith(targetValue);
      }
      return false;

    case ConditionOperator.ENDS_WITH:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue.endsWith(targetValue);
      }
      return false;

    case ConditionOperator.MATCHES_REGEX:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        try {
          const regex = new RegExp(targetValue);
          return regex.test(userValue);
        } catch {
          return false;
        }
      }
      return false;

    case ConditionOperator.IN:
      if (Array.isArray(targetValue)) {
        if (Array.isArray(userValue)) {
          return userValue.some(v => targetValue.includes(v));
        }
        return targetValue.includes(userValue);
      }
      return false;

    case ConditionOperator.NOT_IN:
      if (Array.isArray(targetValue)) {
        if (Array.isArray(userValue)) {
          return !userValue.some(v => targetValue.includes(v));
        }
        return !targetValue.includes(userValue);
      }
      return true;

    case ConditionOperator.GREATER_THAN:
      if (typeof userValue === 'number' && typeof targetValue === 'number') {
        return userValue > targetValue;
      }
      if (userValue instanceof Date && targetValue instanceof Date) {
        return userValue.getTime() > targetValue.getTime();
      }
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue > targetValue;
      }
      return false;

    case ConditionOperator.GREATER_THAN_OR_EQUAL:
      if (typeof userValue === 'number' && typeof targetValue === 'number') {
        return userValue >= targetValue;
      }
      if (userValue instanceof Date && targetValue instanceof Date) {
        return userValue.getTime() >= targetValue.getTime();
      }
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue >= targetValue;
      }
      return false;

    case ConditionOperator.LESS_THAN:
      if (typeof userValue === 'number' && typeof targetValue === 'number') {
        return userValue < targetValue;
      }
      if (userValue instanceof Date && targetValue instanceof Date) {
        return userValue.getTime() < targetValue.getTime();
      }
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue < targetValue;
      }
      return false;

    case ConditionOperator.LESS_THAN_OR_EQUAL:
      if (typeof userValue === 'number' && typeof targetValue === 'number') {
        return userValue <= targetValue;
      }
      if (userValue instanceof Date && targetValue instanceof Date) {
        return userValue.getTime() <= targetValue.getTime();
      }
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return userValue <= targetValue;
      }
      return false;

    case ConditionOperator.BETWEEN:
      if (Array.isArray(targetValue) && targetValue.length === 2) {
        const [min, max] = targetValue;
        if (typeof userValue === 'number' && typeof min === 'number' && typeof max === 'number') {
          return userValue >= min && userValue <= max;
        }
      }
      return false;

    case ConditionOperator.EXISTS:
      return userValue !== undefined && userValue !== null;

    case ConditionOperator.NOT_EXISTS:
      return userValue === undefined || userValue === null;

    case ConditionOperator.SEMVER_EQUAL:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return compareSemver(userValue, targetValue) === 0;
      }
      return false;

    case ConditionOperator.SEMVER_GREATER_THAN:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return compareSemver(userValue, targetValue) > 0;
      }
      return false;

    case ConditionOperator.SEMVER_LESS_THAN:
      if (typeof userValue === 'string' && typeof targetValue === 'string') {
        return compareSemver(userValue, targetValue) < 0;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Evaluate all conditions in a rule (AND logic)
 */
export function evaluateRuleConditions(
  conditions: TargetingCondition[],
  context: UserContext
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(condition => evaluateCondition(condition, context));
}

/**
 * Evaluate a targeting rule with rollout
 */
export function evaluateRule(
  rule: TargetingRule,
  context: UserContext,
  flagKey: string
): { matches: boolean; value?: FlagValue; variantId?: string } {
  // Check if rule is enabled
  if (rule.enabled === false) {
    return { matches: false };
  }

  // Evaluate conditions
  if (!evaluateRuleConditions(rule.conditions, context)) {
    return { matches: false };
  }

  // Check rollout percentage if specified
  if (rule.rolloutPercentage !== undefined && rule.rolloutPercentage < 100) {
    const bucket = hashUserForRollout(context.id, `${flagKey}:${rule.id}`);
    if (bucket >= rule.rolloutPercentage) {
      return { matches: false };
    }
  }

  return {
    matches: true,
    value: rule.value,
    variantId: rule.variantId,
  };
}

/**
 * Check if user belongs to a segment
 */
export function isUserInSegment(segment: Segment, context: UserContext): boolean {
  // Check excluded users first
  if (segment.excludedUserIds?.includes(context.id)) {
    return false;
  }

  // Check included users
  if (segment.includedUserIds?.includes(context.id)) {
    return true;
  }

  // Evaluate segment rules
  return evaluateRuleConditions(segment.rules, context);
}

/**
 * Targeting evaluator class
 */
export class TargetingEvaluator {
  private segments: Map<string, Segment> = new Map();

  constructor(segments?: Segment[]) {
    if (segments) {
      segments.forEach(segment => this.segments.set(segment.id, segment));
    }
  }

  /**
   * Add a segment
   */
  addSegment(segment: Segment): void {
    this.segments.set(segment.id, segment);
  }

  /**
   * Remove a segment
   */
  removeSegment(segmentId: string): void {
    this.segments.delete(segmentId);
  }

  /**
   * Get a segment
   */
  getSegment(segmentId: string): Segment | undefined {
    return this.segments.get(segmentId);
  }

  /**
   * Evaluate rules and return matching rule
   */
  evaluateRules(
    rules: TargetingRule[],
    context: UserContext,
    flagKey: string
  ): TargetingRule | null {
    // Sort rules by priority (lower = higher priority)
    const sortedRules = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (const rule of sortedRules) {
      const result = evaluateRule(rule, context, flagKey);
      if (result.matches) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if user matches any segment in a list
   */
  checkSegments(segmentIds: string[], context: UserContext): string | null {
    for (const segmentId of segmentIds) {
      const segment = this.segments.get(segmentId);
      if (segment && isUserInSegment(segment, context)) {
        return segmentId;
      }
    }
    return null;
  }

  /**
   * Get all segments a user belongs to
   */
  getUserSegments(context: UserContext): string[] {
    const matchingSegments: string[] = [];
    for (const [segmentId, segment] of this.segments) {
      if (isUserInSegment(segment, context)) {
        matchingSegments.push(segmentId);
      }
    }
    return matchingSegments;
  }
}
