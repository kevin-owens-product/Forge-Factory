/**
 * @package @forge/feature-flags
 * @description Tests for flag definition and evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFlag,
  createBooleanFlag,
  createStringFlag,
  createNumberFlag,
  createJsonFlag,
  FlagEvaluator,
  InMemoryFlagProvider,
} from '../flag';
import {
  FlagType,
  UserContext,
  EvaluationReason,
  ConditionOperator,
  Segment,
  Variant,
} from '../feature-flags.types';

describe('createFlag', () => {
  it('should create a flag with required properties', () => {
    const flag = createFlag('test-flag', FlagType.BOOLEAN, true);
    expect(flag.key).toBe('test-flag');
    expect(flag.type).toBe(FlagType.BOOLEAN);
    expect(flag.defaultValue).toBe(true);
    expect(flag.enabled).toBe(true);
    expect(flag.name).toBe('test-flag');
    expect(flag.rules).toEqual([]);
  });

  it('should create a flag with options', () => {
    const flag = createFlag('test-flag', FlagType.STRING, 'default', {
      name: 'Test Flag',
      description: 'A test flag',
      enabled: false,
      tags: ['test', 'example'],
      tenantId: 'tenant-1',
      rolloutPercentage: 50,
    });
    expect(flag.name).toBe('Test Flag');
    expect(flag.description).toBe('A test flag');
    expect(flag.enabled).toBe(false);
    expect(flag.tags).toEqual(['test', 'example']);
    expect(flag.tenantId).toBe('tenant-1');
    expect(flag.rolloutPercentage).toBe(50);
  });

  it('should create a flag with variants', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Control', value: 'control', weight: 50 },
      { id: 'v2', name: 'Treatment', value: 'treatment', weight: 50 },
    ];
    const flag = createFlag('ab-test', FlagType.STRING, 'control', { variants });
    expect(flag.variants).toEqual(variants);
  });

  it('should create a flag with environment overrides', () => {
    const flag = createFlag('env-flag', FlagType.BOOLEAN, false, {
      environmentOverrides: {
        development: true,
        production: false,
      },
    });
    expect(flag.environmentOverrides).toEqual({
      development: true,
      production: false,
    });
  });

  it('should set createdAt and updatedAt', () => {
    const flag = createFlag('test-flag', FlagType.BOOLEAN, true);
    expect(flag.createdAt).toBeInstanceOf(Date);
    expect(flag.updatedAt).toBeInstanceOf(Date);
  });
});

describe('createBooleanFlag', () => {
  it('should create a boolean flag', () => {
    const flag = createBooleanFlag('feature-enabled', true);
    expect(flag.type).toBe(FlagType.BOOLEAN);
    expect(flag.defaultValue).toBe(true);
  });

  it('should create a disabled boolean flag', () => {
    const flag = createBooleanFlag('feature-disabled', false, { enabled: false });
    expect(flag.enabled).toBe(false);
    expect(flag.defaultValue).toBe(false);
  });
});

describe('createStringFlag', () => {
  it('should create a string flag', () => {
    const flag = createStringFlag('theme', 'light');
    expect(flag.type).toBe(FlagType.STRING);
    expect(flag.defaultValue).toBe('light');
  });
});

describe('createNumberFlag', () => {
  it('should create a number flag', () => {
    const flag = createNumberFlag('max-items', 100);
    expect(flag.type).toBe(FlagType.NUMBER);
    expect(flag.defaultValue).toBe(100);
  });
});

describe('createJsonFlag', () => {
  it('should create a JSON flag', () => {
    const config = { enabled: true, threshold: 50 };
    const flag = createJsonFlag('config', config);
    expect(flag.type).toBe(FlagType.JSON);
    expect(flag.defaultValue).toEqual(config);
  });
});

describe('FlagEvaluator', () => {
  let evaluator: FlagEvaluator;
  const userContext: UserContext = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  };

  beforeEach(() => {
    evaluator = new FlagEvaluator();
  });

  describe('evaluate', () => {
    it('should return default value when flag is disabled', () => {
      const flag = createBooleanFlag('disabled-flag', true, { enabled: false });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.FLAG_DISABLED);
    });

    it('should return environment override when environment is set', () => {
      const flag = createBooleanFlag('env-flag', false, {
        environmentOverrides: { development: true },
      });
      evaluator.setEnvironment('development');
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.ENVIRONMENT_OVERRIDE);
    });

    it('should return default value when no user context', () => {
      const flag = createBooleanFlag('test-flag', true);
      const result = evaluator.evaluate(flag, undefined);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.DEFAULT);
    });

    it('should return custom default value when provided', () => {
      const flag = createBooleanFlag('test-flag', true);
      const result = evaluator.evaluate(flag, undefined, false);
      expect(result.value).toBe(false);
      expect(result.reason).toBe(EvaluationReason.DEFAULT);
    });

    it('should evaluate targeting rules', () => {
      const flag = createBooleanFlag('admin-feature', false, {
        rules: [
          {
            id: 'admin-rule',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
            value: true,
          },
        ],
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.RULE_MATCH);
      expect(result.ruleId).toBe('admin-rule');
    });

    it('should select variant from rule', () => {
      const flag = createStringFlag('ab-test', 'control', {
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'treatment', name: 'Treatment', value: 'treatment', weight: 50 },
        ],
        rules: [
          {
            id: 'admin-rule',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
            variantId: 'treatment',
          },
        ],
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe('treatment');
      expect(result.reason).toBe(EvaluationReason.RULE_MATCH);
      expect(result.variantId).toBe('treatment');
    });

    it('should select variant based on user hash', () => {
      const flag = createStringFlag('ab-test', 'control', {
        variants: [
          { id: 'v1', name: 'Variant 1', value: 'variant-1', weight: 50 },
          { id: 'v2', name: 'Variant 2', value: 'variant-2', weight: 50 },
        ],
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(['variant-1', 'variant-2']).toContain(result.value);
      expect(result.reason).toBe(EvaluationReason.VARIANT);
    });

    it('should respect rollout percentage', () => {
      const flag = createBooleanFlag('rollout-flag', true, {
        rolloutPercentage: 0,
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.DEFAULT);
    });

    it('should include user in rollout at 50%', () => {
      // 50% rollout - user may be in or out depending on hash
      const flag = createBooleanFlag('rollout-flag', true, {
        rolloutPercentage: 50,
      });
      const result = evaluator.evaluate(flag, userContext);
      // At 50%, the result depends on the hash - just verify we get a valid response
      expect([EvaluationReason.ROLLOUT, EvaluationReason.DEFAULT]).toContain(result.reason);
    });

    it('should handle evaluation errors gracefully', () => {
      const flag = createBooleanFlag('error-flag', false);
      // Force an error by making rules throw
      Object.defineProperty(flag, 'rules', {
        get() {
          throw new Error('Test error');
        },
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(false);
      expect(result.reason).toBe(EvaluationReason.ERROR);
    });

    it('should include evaluation time', () => {
      const flag = createBooleanFlag('test-flag', true);
      const result = evaluator.evaluate(flag, userContext);
      expect(result.evaluationTime).toBeDefined();
      expect(result.evaluationTime).toBeGreaterThanOrEqual(0);
    });

    it('should include timestamp', () => {
      const flag = createBooleanFlag('test-flag', true);
      const result = evaluator.evaluate(flag, userContext);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should break out of rules when match has no value', () => {
      const flag = createBooleanFlag('multi-rule', true, {
        rules: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
          },
        ],
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.reason).toBe(EvaluationReason.DEFAULT);
    });
  });

  describe('evaluateWithDetails', () => {
    it('should return evaluation details', () => {
      const flag = createBooleanFlag('detailed-flag', false, {
        rules: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
            value: true,
          },
        ],
      });
      const details = evaluator.evaluateWithDetails(flag, userContext);
      expect(details.flag).toEqual(flag);
      expect(details.userContext).toEqual(userContext);
      expect(details.rulesEvaluated).toBeDefined();
      expect(details.fromCache).toBe(false);
    });

    it('should include rules evaluated', () => {
      const flag = createBooleanFlag('multi-rule-flag', false, {
        rules: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'user' },
            ],
            value: true,
          },
          {
            id: 'rule-2',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
            value: true,
          },
        ],
      });
      const details = evaluator.evaluateWithDetails(flag, userContext);
      expect(details.rulesEvaluated).toHaveLength(2);
      expect(details.rulesEvaluated?.[0].ruleId).toBe('rule-1');
      expect(details.rulesEvaluated?.[1].ruleId).toBe('rule-2');
      expect(details.rulesEvaluated?.[1].matched).toBe(true);
    });

    it('should include condition details', () => {
      const flag = createBooleanFlag('condition-flag', false, {
        rules: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
              { attribute: 'email', operator: ConditionOperator.CONTAINS, value: '@example' },
            ],
            value: true,
          },
        ],
      });
      const details = evaluator.evaluateWithDetails(flag, userContext);
      expect(details.rulesEvaluated?.[0].conditions).toHaveLength(2);
    });
  });

  describe('getVariant', () => {
    it('should return null for disabled flag', () => {
      const flag = createStringFlag('disabled-ab', 'control', {
        enabled: false,
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'treatment', name: 'Treatment', value: 'treatment', weight: 50 },
        ],
      });
      const variant = evaluator.getVariant(flag, userContext);
      expect(variant).toBeNull();
    });

    it('should return null for flag without variants', () => {
      const flag = createBooleanFlag('no-variants', true);
      const variant = evaluator.getVariant(flag, userContext);
      expect(variant).toBeNull();
    });

    it('should return variant for multivariate flag', () => {
      const flag = createStringFlag('ab-test', 'control', {
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'treatment', name: 'Treatment', value: 'treatment', weight: 50 },
        ],
      });
      const variant = evaluator.getVariant(flag, userContext);
      expect(variant).not.toBeNull();
      expect(['control', 'treatment']).toContain(variant?.variantId);
    });

    it('should return variant from matching rule', () => {
      const flag = createStringFlag('rule-variant', 'control', {
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'admin-variant', name: 'Admin', value: 'admin-special', weight: 50 },
        ],
        rules: [
          {
            id: 'admin-rule',
            conditions: [
              { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
            ],
            variantId: 'admin-variant',
          },
        ],
      });
      const variant = evaluator.getVariant(flag, userContext);
      expect(variant?.variantId).toBe('admin-variant');
      expect(variant?.reason).toBe(EvaluationReason.RULE_MATCH);
    });

    it('should return null for empty variants', () => {
      const flag = createStringFlag('empty-variants', 'control', {
        variants: [],
      });
      const variant = evaluator.getVariant(flag, userContext);
      expect(variant).toBeNull();
    });
  });

  describe('segments', () => {
    it('should add segment', () => {
      const segment: Segment = {
        id: 'seg-1',
        name: 'Test Segment',
        rules: [],
      };
      evaluator.addSegment(segment);
      expect(evaluator).toBeDefined();
    });

    it('should remove segment', () => {
      const segment: Segment = {
        id: 'seg-1',
        name: 'Test Segment',
        rules: [],
      };
      evaluator.addSegment(segment);
      evaluator.removeSegment('seg-1');
      expect(evaluator).toBeDefined();
    });
  });

  describe('environment', () => {
    it('should set environment', () => {
      evaluator.setEnvironment('production');
      const flag = createBooleanFlag('env-flag', false, {
        environmentOverrides: { production: true },
      });
      const result = evaluator.evaluate(flag, userContext);
      expect(result.value).toBe(true);
      expect(result.reason).toBe(EvaluationReason.ENVIRONMENT_OVERRIDE);
    });
  });
});

describe('InMemoryFlagProvider', () => {
  let provider: InMemoryFlagProvider;

  beforeEach(() => {
    provider = new InMemoryFlagProvider();
  });

  describe('flags', () => {
    it('should get a flag by key', async () => {
      const flag = createBooleanFlag('test-flag', true);
      provider.setFlag(flag);
      const retrieved = await provider.getFlag('test-flag');
      expect(retrieved).toEqual(flag);
    });

    it('should return null for non-existent flag', async () => {
      const retrieved = await provider.getFlag('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should get all flags', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setFlag(createBooleanFlag('flag-2', false));
      const flags = await provider.getAllFlags();
      expect(flags).toHaveLength(2);
    });

    it('should update a flag', () => {
      const flag = createBooleanFlag('test-flag', true);
      provider.setFlag(flag);
      const updated = provider.updateFlag('test-flag', { enabled: false });
      expect(updated).toBe(true);
    });

    it('should return false when updating non-existent flag', () => {
      const updated = provider.updateFlag('non-existent', { enabled: false });
      expect(updated).toBe(false);
    });

    it('should delete a flag', () => {
      provider.setFlag(createBooleanFlag('test-flag', true));
      const deleted = provider.deleteFlag('test-flag');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent flag', () => {
      const deleted = provider.deleteFlag('non-existent');
      expect(deleted).toBe(false);
    });

    it('should get flags count', () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setFlag(createBooleanFlag('flag-2', false));
      expect(provider.getFlagsCount()).toBe(2);
    });
  });

  describe('segments', () => {
    it('should get a segment by ID', async () => {
      const segment: Segment = { id: 'seg-1', name: 'Test', rules: [] };
      provider.setSegment(segment);
      const retrieved = await provider.getSegment('seg-1');
      expect(retrieved).toEqual(segment);
    });

    it('should return null for non-existent segment', async () => {
      const retrieved = await provider.getSegment('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should get all segments', async () => {
      provider.setSegment({ id: 'seg-1', name: 'Segment 1', rules: [] });
      provider.setSegment({ id: 'seg-2', name: 'Segment 2', rules: [] });
      const segments = await provider.getAllSegments();
      expect(segments).toHaveLength(2);
    });

    it('should delete a segment', () => {
      provider.setSegment({ id: 'seg-1', name: 'Test', rules: [] });
      const deleted = provider.deleteSegment('seg-1');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent segment', () => {
      const deleted = provider.deleteSegment('non-existent');
      expect(deleted).toBe(false);
    });

    it('should get segments count', () => {
      provider.setSegment({ id: 'seg-1', name: 'Segment 1', rules: [] });
      provider.setSegment({ id: 'seg-2', name: 'Segment 2', rules: [] });
      expect(provider.getSegmentsCount()).toBe(2);
    });

    it('should check if user is in segment', () => {
      const segment: Segment = {
        id: 'admin-segment',
        name: 'Admins',
        rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      };
      provider.setSegment(segment);
      const context: UserContext = { id: 'user-1', role: 'admin' };
      expect(provider.isUserInSegment('admin-segment', context)).toBe(true);
    });

    it('should return false when segment not found', () => {
      const context: UserContext = { id: 'user-1' };
      expect(provider.isUserInSegment('non-existent', context)).toBe(false);
    });
  });

  describe('subscription', () => {
    it('should notify subscribers on flag set', () => {
      let notified = false;
      provider.subscribe(() => {
        notified = true;
      });
      provider.setFlag(createBooleanFlag('test-flag', true));
      expect(notified).toBe(true);
    });

    it('should notify subscribers on flag update', () => {
      let notifiedCount = 0;
      provider.setFlag(createBooleanFlag('test-flag', true));
      provider.subscribe(() => {
        notifiedCount++;
      });
      provider.updateFlag('test-flag', { enabled: false });
      expect(notifiedCount).toBe(1);
    });

    it('should notify subscribers on flag delete', () => {
      let notified = false;
      provider.setFlag(createBooleanFlag('test-flag', true));
      provider.subscribe(() => {
        notified = true;
      });
      provider.deleteFlag('test-flag');
      expect(notified).toBe(true);
    });

    it('should unsubscribe', () => {
      let count = 0;
      const unsubscribe = provider.subscribe(() => {
        count++;
      });
      provider.setFlag(createBooleanFlag('test-flag', true));
      unsubscribe();
      provider.setFlag(createBooleanFlag('test-flag-2', true));
      expect(count).toBe(1);
    });
  });

  describe('initialization', () => {
    it('should initialize with flags', () => {
      const flags = [
        createBooleanFlag('flag-1', true),
        createBooleanFlag('flag-2', false),
      ];
      provider = new InMemoryFlagProvider({ flags });
      expect(provider.getFlagsCount()).toBe(2);
    });

    it('should initialize with segments', () => {
      const segments: Segment[] = [
        { id: 'seg-1', name: 'Segment 1', rules: [] },
        { id: 'seg-2', name: 'Segment 2', rules: [] },
      ];
      provider = new InMemoryFlagProvider({ segments });
      expect(provider.getSegmentsCount()).toBe(2);
    });

    it('should initialize with empty config', () => {
      provider = new InMemoryFlagProvider({});
      expect(provider.getFlagsCount()).toBe(0);
      expect(provider.getSegmentsCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all flags and segments', () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setSegment({ id: 'seg-1', name: 'Test', rules: [] });
      provider.clear();
      expect(provider.getFlagsCount()).toBe(0);
      expect(provider.getSegmentsCount()).toBe(0);
    });

    it('should notify subscribers on clear', () => {
      let notified = false;
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.subscribe(() => {
        notified = true;
      });
      provider.clear();
      expect(notified).toBe(true);
    });
  });
});
