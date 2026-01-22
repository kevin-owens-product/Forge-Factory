/**
 * @package @forge/feature-flags
 * @description Tests for targeting and condition evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashUserForRollout,
  compareSemver,
  getAttributeValue,
  evaluateCondition,
  evaluateRuleConditions,
  evaluateRule,
  isUserInSegment,
  TargetingEvaluator,
} from '../targeting';
import { ConditionOperator, TargetingCondition, TargetingRule, UserContext, Segment } from '../feature-flags.types';

describe('hashUserForRollout', () => {
  it('should return consistent hash for same user and flag', () => {
    const hash1 = hashUserForRollout('user-123', 'my-flag');
    const hash2 = hashUserForRollout('user-123', 'my-flag');
    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different users', () => {
    const hash1 = hashUserForRollout('user-123', 'my-flag');
    const hash2 = hashUserForRollout('user-456', 'my-flag');
    expect(hash1).not.toBe(hash2);
  });

  it('should return different hash for different flags', () => {
    const hash1 = hashUserForRollout('user-123', 'flag-a');
    const hash2 = hashUserForRollout('user-123', 'flag-b');
    expect(hash1).not.toBe(hash2);
  });

  it('should return a value between 0 and 99', () => {
    for (let i = 0; i < 100; i++) {
      const hash = hashUserForRollout(`user-${i}`, 'test-flag');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(100);
    }
  });
});

describe('compareSemver', () => {
  it('should compare equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.3.4', '2.3.4')).toBe(0);
    expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
  });

  it('should compare major versions', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('should compare minor versions', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
    expect(compareSemver('1.1.0', '1.2.0')).toBe(-1);
  });

  it('should compare patch versions', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1);
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1);
  });

  it('should handle partial versions', () => {
    expect(compareSemver('1', '1.0.0')).toBe(0);
    expect(compareSemver('1.2', '1.2.0')).toBe(0);
    expect(compareSemver('2', '1.5.3')).toBe(1);
  });

  it('should strip v prefix', () => {
    expect(compareSemver('v1.2.3', 'v1.2.3')).toBe(0);
    expect(compareSemver('v2.0.0', '1.0.0')).toBe(1);
  });
});

describe('getAttributeValue', () => {
  const context: UserContext = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
    groups: ['developers', 'testers'],
    tenantId: 'tenant-1',
    ip: '192.168.1.1',
    country: 'US',
    device: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    appVersion: '2.0.0',
    createdAt: new Date('2024-01-01'),
    isBeta: true,
    isInternal: false,
    attributes: {
      plan: 'enterprise',
      nested: {
        value: 'deep',
      },
    },
  };

  it('should get standard attributes', () => {
    expect(getAttributeValue(context, 'id')).toBe('user-123');
    expect(getAttributeValue(context, 'email')).toBe('test@example.com');
    expect(getAttributeValue(context, 'role')).toBe('admin');
    expect(getAttributeValue(context, 'groups')).toEqual(['developers', 'testers']);
    expect(getAttributeValue(context, 'tenantId')).toBe('tenant-1');
    expect(getAttributeValue(context, 'ip')).toBe('192.168.1.1');
    expect(getAttributeValue(context, 'country')).toBe('US');
    expect(getAttributeValue(context, 'device')).toBe('desktop');
    expect(getAttributeValue(context, 'browser')).toBe('Chrome');
    expect(getAttributeValue(context, 'os')).toBe('macOS');
    expect(getAttributeValue(context, 'appVersion')).toBe('2.0.0');
    expect(getAttributeValue(context, 'isBeta')).toBe(true);
    expect(getAttributeValue(context, 'isInternal')).toBe(false);
  });

  it('should get custom attributes directly', () => {
    expect(getAttributeValue(context, 'plan')).toBe('enterprise');
  });

  it('should get nested custom attributes with dot notation', () => {
    expect(getAttributeValue(context, 'attributes.plan')).toBe('enterprise');
    expect(getAttributeValue(context, 'attributes.nested.value')).toBe('deep');
  });

  it('should return undefined for missing attributes', () => {
    expect(getAttributeValue(context, 'nonexistent')).toBeUndefined();
    expect(getAttributeValue(context, 'attributes.missing')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const context: UserContext = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
    groups: ['developers', 'testers'],
    appVersion: '2.0.0',
    attributes: {
      score: 85,
      plan: 'enterprise',
    },
  };

  describe('EQUALS operator', () => {
    it('should match equal values', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.EQUALS,
        value: 'admin',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match different values', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.EQUALS,
        value: 'user',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('NOT_EQUALS operator', () => {
    it('should not match equal values', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.NOT_EQUALS,
        value: 'admin',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should match different values', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.NOT_EQUALS,
        value: 'user',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('CONTAINS operator', () => {
    it('should match string containing substring', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.CONTAINS,
        value: '@example',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should match array containing value', () => {
      const condition: TargetingCondition = {
        attribute: 'groups',
        operator: ConditionOperator.CONTAINS,
        value: 'developers',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match if value is missing', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.CONTAINS,
        value: '@other',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('NOT_CONTAINS operator', () => {
    it('should not match string containing substring', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.NOT_CONTAINS,
        value: '@example',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should match string not containing substring', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.NOT_CONTAINS,
        value: '@other',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('STARTS_WITH operator', () => {
    it('should match string starting with prefix', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.STARTS_WITH,
        value: 'test',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match string not starting with prefix', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.STARTS_WITH,
        value: 'other',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('ENDS_WITH operator', () => {
    it('should match string ending with suffix', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.ENDS_WITH,
        value: '.com',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match string not ending with suffix', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.ENDS_WITH,
        value: '.org',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('MATCHES_REGEX operator', () => {
    it('should match string matching regex', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.MATCHES_REGEX,
        value: '^test@.*\\.com$',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match string not matching regex', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.MATCHES_REGEX,
        value: '^admin@',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should handle invalid regex', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.MATCHES_REGEX,
        value: '[invalid(',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('IN operator', () => {
    it('should match value in array', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.IN,
        value: ['admin', 'super_admin'],
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match value not in array', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.IN,
        value: ['user', 'guest'],
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should match if any array value is in target', () => {
      const condition: TargetingCondition = {
        attribute: 'groups',
        operator: ConditionOperator.IN,
        value: ['developers', 'designers'],
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('NOT_IN operator', () => {
    it('should not match value in array', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.NOT_IN,
        value: ['admin', 'super_admin'],
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should match value not in array', () => {
      const condition: TargetingCondition = {
        attribute: 'role',
        operator: ConditionOperator.NOT_IN,
        value: ['user', 'guest'],
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('GREATER_THAN operator', () => {
    it('should match number greater than target', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.GREATER_THAN,
        value: 80,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match number not greater than target', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.GREATER_THAN,
        value: 90,
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should compare strings', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.GREATER_THAN,
        value: 'aaa',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('GREATER_THAN_OR_EQUAL operator', () => {
    it('should match equal number', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.GREATER_THAN_OR_EQUAL,
        value: 85,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('LESS_THAN operator', () => {
    it('should match number less than target', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.LESS_THAN,
        value: 90,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('LESS_THAN_OR_EQUAL operator', () => {
    it('should match equal number', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.LESS_THAN_OR_EQUAL,
        value: 85,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('BETWEEN operator', () => {
    it('should match number between range', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.BETWEEN,
        value: [80, 90],
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match number outside range', () => {
      const condition: TargetingCondition = {
        attribute: 'score',
        operator: ConditionOperator.BETWEEN,
        value: [90, 100],
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('EXISTS operator', () => {
    it('should match existing attribute', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.EXISTS,
        value: true,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should not match missing attribute', () => {
      const condition: TargetingCondition = {
        attribute: 'missingAttr',
        operator: ConditionOperator.EXISTS,
        value: true,
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });

  describe('NOT_EXISTS operator', () => {
    it('should not match existing attribute', () => {
      const condition: TargetingCondition = {
        attribute: 'email',
        operator: ConditionOperator.NOT_EXISTS,
        value: true,
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should match missing attribute', () => {
      const condition: TargetingCondition = {
        attribute: 'missingAttr',
        operator: ConditionOperator.NOT_EXISTS,
        value: true,
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('SEMVER operators', () => {
    it('should match semver equal', () => {
      const condition: TargetingCondition = {
        attribute: 'appVersion',
        operator: ConditionOperator.SEMVER_EQUAL,
        value: '2.0.0',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should match semver greater than', () => {
      const condition: TargetingCondition = {
        attribute: 'appVersion',
        operator: ConditionOperator.SEMVER_GREATER_THAN,
        value: '1.5.0',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should match semver less than', () => {
      const condition: TargetingCondition = {
        attribute: 'appVersion',
        operator: ConditionOperator.SEMVER_LESS_THAN,
        value: '3.0.0',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('default case', () => {
    it('should return false for unknown operator', () => {
      const condition = {
        attribute: 'email',
        operator: 'UNKNOWN_OPERATOR' as ConditionOperator,
        value: 'test',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });
});

describe('evaluateRuleConditions', () => {
  const context: UserContext = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  };

  it('should return true for empty conditions', () => {
    expect(evaluateRuleConditions([], context)).toBe(true);
  });

  it('should return true when all conditions match', () => {
    const conditions: TargetingCondition[] = [
      { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
      { attribute: 'email', operator: ConditionOperator.CONTAINS, value: '@example' },
    ];
    expect(evaluateRuleConditions(conditions, context)).toBe(true);
  });

  it('should return false when any condition fails', () => {
    const conditions: TargetingCondition[] = [
      { attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' },
      { attribute: 'email', operator: ConditionOperator.CONTAINS, value: '@other' },
    ];
    expect(evaluateRuleConditions(conditions, context)).toBe(false);
  });
});

describe('evaluateRule', () => {
  const context: UserContext = {
    id: 'user-123',
    role: 'admin',
  };

  it('should return matches:false for disabled rule', () => {
    const rule: TargetingRule = {
      id: 'rule-1',
      conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      enabled: false,
    };
    const result = evaluateRule(rule, context, 'test-flag');
    expect(result.matches).toBe(false);
  });

  it('should return matches:true when conditions match', () => {
    const rule: TargetingRule = {
      id: 'rule-1',
      conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      value: true,
    };
    const result = evaluateRule(rule, context, 'test-flag');
    expect(result.matches).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should return variant ID if specified', () => {
    const rule: TargetingRule = {
      id: 'rule-1',
      conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      variantId: 'variant-a',
    };
    const result = evaluateRule(rule, context, 'test-flag');
    expect(result.matches).toBe(true);
    expect(result.variantId).toBe('variant-a');
  });

  it('should respect rollout percentage', () => {
    const rule: TargetingRule = {
      id: 'rule-1',
      conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      rolloutPercentage: 0,
    };
    const result = evaluateRule(rule, context, 'test-flag');
    expect(result.matches).toBe(false);
  });
});

describe('isUserInSegment', () => {
  const context: UserContext = {
    id: 'user-123',
    role: 'admin',
    email: 'test@example.com',
  };

  it('should return false if user is in excluded list', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Test Segment',
      rules: [],
      excludedUserIds: ['user-123'],
    };
    expect(isUserInSegment(segment, context)).toBe(false);
  });

  it('should return true if user is in included list', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Test Segment',
      rules: [],
      includedUserIds: ['user-123'],
    };
    expect(isUserInSegment(segment, context)).toBe(true);
  });

  it('should evaluate rules when not in static lists', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Admin Segment',
      rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
    };
    expect(isUserInSegment(segment, context)).toBe(true);
  });
});

describe('TargetingEvaluator', () => {
  let evaluator: TargetingEvaluator;
  const context: UserContext = {
    id: 'user-123',
    role: 'admin',
  };

  beforeEach(() => {
    evaluator = new TargetingEvaluator();
  });

  it('should add and get segments', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Test Segment',
      rules: [],
    };
    evaluator.addSegment(segment);
    expect(evaluator.getSegment('seg-1')).toEqual(segment);
  });

  it('should remove segments', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Test Segment',
      rules: [],
    };
    evaluator.addSegment(segment);
    evaluator.removeSegment('seg-1');
    expect(evaluator.getSegment('seg-1')).toBeUndefined();
  });

  it('should initialize with segments', () => {
    const segment: Segment = {
      id: 'seg-1',
      name: 'Test Segment',
      rules: [],
    };
    evaluator = new TargetingEvaluator([segment]);
    expect(evaluator.getSegment('seg-1')).toEqual(segment);
  });

  it('should evaluate rules and return matching rule', () => {
    const rules: TargetingRule[] = [
      {
        id: 'rule-1',
        conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'user' }],
        priority: 1,
      },
      {
        id: 'rule-2',
        conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
        priority: 2,
      },
    ];
    const matched = evaluator.evaluateRules(rules, context, 'test-flag');
    expect(matched?.id).toBe('rule-2');
  });

  it('should respect rule priority', () => {
    const rules: TargetingRule[] = [
      {
        id: 'rule-low-priority',
        conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
        priority: 10,
        value: 'low',
      },
      {
        id: 'rule-high-priority',
        conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
        priority: 1,
        value: 'high',
      },
    ];
    const matched = evaluator.evaluateRules(rules, context, 'test-flag');
    expect(matched?.id).toBe('rule-high-priority');
  });

  it('should return null when no rules match', () => {
    const rules: TargetingRule[] = [
      {
        id: 'rule-1',
        conditions: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'user' }],
      },
    ];
    const matched = evaluator.evaluateRules(rules, context, 'test-flag');
    expect(matched).toBeNull();
  });

  it('should check segment membership', () => {
    const segment: Segment = {
      id: 'admin-segment',
      name: 'Admin Segment',
      rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
    };
    evaluator.addSegment(segment);
    const matchedSegment = evaluator.checkSegments(['admin-segment', 'other-segment'], context);
    expect(matchedSegment).toBe('admin-segment');
  });

  it('should return null when no segments match', () => {
    const segment: Segment = {
      id: 'user-segment',
      name: 'User Segment',
      rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'user' }],
    };
    evaluator.addSegment(segment);
    const matchedSegment = evaluator.checkSegments(['user-segment'], context);
    expect(matchedSegment).toBeNull();
  });

  it('should get all segments user belongs to', () => {
    const segment1: Segment = {
      id: 'admin-segment',
      name: 'Admin Segment',
      rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
    };
    const segment2: Segment = {
      id: 'user-123-segment',
      name: 'User 123 Segment',
      rules: [],
      includedUserIds: ['user-123'],
    };
    const segment3: Segment = {
      id: 'guest-segment',
      name: 'Guest Segment',
      rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'guest' }],
    };
    evaluator.addSegment(segment1);
    evaluator.addSegment(segment2);
    evaluator.addSegment(segment3);
    const userSegments = evaluator.getUserSegments(context);
    expect(userSegments).toContain('admin-segment');
    expect(userSegments).toContain('user-123-segment');
    expect(userSegments).not.toContain('guest-segment');
  });
});
