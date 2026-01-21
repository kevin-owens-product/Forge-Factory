# Prompt: Refactor Pattern

**ID:** `forge-v4.1:utility:refactor-pattern`
**Version:** 4.1.0
**Category:** Utilities

## Purpose

Safely refactor code while maintaining functionality, improving quality, and preserving test coverage.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| targetPath | string | Yes | File or directory to refactor |
| pattern | string | Yes | Refactoring pattern to apply |
| scope | string | No | Limit scope (file, module, package) |
| preserveApi | boolean | No | Keep public API unchanged (default: true) |

## Available Patterns

### 1. Extract Function
Extract repeated code into reusable function.

### 2. Extract Class
Group related functions into a class.

### 3. Extract Package
Move shared code to a new package.

### 4. Inline
Remove unnecessary abstraction.

### 5. Rename
Rename with all references updated.

### 6. Move
Relocate code to better location.

### 7. Simplify Conditionals
Reduce nested if/else complexity.

### 8. Replace Magic Numbers
Convert literals to named constants.

### 9. Introduce Parameter Object
Group related parameters.

### 10. Replace Inheritance with Composition
Convert extends to has-a relationship.

## Refactoring Safety Rules

1. **Test First**: Ensure tests exist before refactoring
2. **Small Steps**: Make incremental changes
3. **Preserve Behavior**: No functional changes
4. **Maintain Coverage**: Coverage cannot decrease
5. **Review Dependencies**: Check for breaking changes

## Generation Template

```
You are refactoring code in the Forge Factory platform.

TARGET: {targetPath}
PATTERN: {pattern}
SCOPE: {scope}
PRESERVE API: {preserveApi}

## Current State Analysis

1. Read target code
2. Identify code smell/issue
3. Map all usages/dependencies
4. Verify test coverage

## Refactoring Plan

### Pattern: Extract Function

**Before:**
```typescript
function processOrder(order: Order) {
  // 50 lines of code including:
  // - validation (lines 5-15)
  // - calculation (lines 16-30)
  // - persistence (lines 31-45)
  // - notification (lines 46-50)
}
```

**After:**
```typescript
/**
 * @prompt-id forge-v4.1:utility:refactor:{feature}:001
 * @refactored-at {timestamp}
 * @pattern extract-function
 */

function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateOrderTotal(order);
  await persistOrder(order, total);
  await notifyOrderCreated(order);
}

function validateOrder(order: Order): void {
  // Extracted validation logic
}

function calculateOrderTotal(order: Order): number {
  // Extracted calculation logic
}

async function persistOrder(order: Order, total: number): Promise<void> {
  // Extracted persistence logic
}

async function notifyOrderCreated(order: Order): Promise<void> {
  // Extracted notification logic
}
```

### Pattern: Extract Package

**Trigger**: Code used by 3+ packages

**Before:**
```
packages/
  auth/src/utils/validation.ts      # Has validateEmail
  billing/src/utils/validation.ts   # Has validateEmail (duplicate)
  notifications/src/helpers.ts      # Has validateEmail (duplicate)
```

**After:**
```
packages/
  validation/                       # New package
    src/
      index.ts
      email.ts                      # validateEmail
      phone.ts
      common.ts
  auth/src/...                      # Uses @forge/validation
  billing/src/...                   # Uses @forge/validation
  notifications/src/...             # Uses @forge/validation
```

### Pattern: Simplify Conditionals

**Before:**
```typescript
function getDiscount(user: User, order: Order): number {
  if (user.type === 'premium') {
    if (order.total > 1000) {
      if (order.items.length > 5) {
        return 0.25;
      } else {
        return 0.20;
      }
    } else {
      if (order.items.length > 5) {
        return 0.15;
      } else {
        return 0.10;
      }
    }
  } else {
    if (order.total > 1000) {
      return 0.10;
    } else {
      return 0.05;
    }
  }
}
```

**After:**
```typescript
/**
 * @prompt-id forge-v4.1:utility:refactor:discount:001
 * @refactored-at {timestamp}
 * @pattern simplify-conditionals
 */

const DISCOUNT_RATES = {
  premium: {
    highValue: { manyItems: 0.25, fewItems: 0.20 },
    lowValue: { manyItems: 0.15, fewItems: 0.10 },
  },
  standard: {
    highValue: 0.10,
    lowValue: 0.05,
  },
} as const;

function getDiscount(user: User, order: Order): number {
  const isPremium = user.type === 'premium';
  const isHighValue = order.total > 1000;
  const hasManyItems = order.items.length > 5;

  if (!isPremium) {
    return isHighValue ? DISCOUNT_RATES.standard.highValue : DISCOUNT_RATES.standard.lowValue;
  }

  const valueCategory = isHighValue ? 'highValue' : 'lowValue';
  const itemCategory = hasManyItems ? 'manyItems' : 'fewItems';

  return DISCOUNT_RATES.premium[valueCategory][itemCategory];
}
```

### Pattern: Introduce Parameter Object

**Before:**
```typescript
function createReport(
  startDate: Date,
  endDate: Date,
  tenantId: string,
  userId: string,
  format: 'pdf' | 'csv' | 'json',
  includeCharts: boolean,
  emailRecipients: string[],
  scheduleTime?: Date,
): Promise<Report> {
  // ...
}
```

**After:**
```typescript
/**
 * @prompt-id forge-v4.1:utility:refactor:report:001
 * @refactored-at {timestamp}
 * @pattern introduce-parameter-object
 */

interface ReportOptions {
  dateRange: {
    start: Date;
    end: Date;
  };
  tenantId: string;
  userId: string;
  output: {
    format: 'pdf' | 'csv' | 'json';
    includeCharts: boolean;
  };
  delivery?: {
    emailRecipients: string[];
    scheduleTime?: Date;
  };
}

function createReport(options: ReportOptions): Promise<Report> {
  const { dateRange, tenantId, userId, output, delivery } = options;
  // ...
}
```

## Refactoring Verification

After each refactoring:

1. **Compile Check**
   ```bash
   pnpm tsc --noEmit
   ```

2. **Test Suite**
   ```bash
   pnpm test --coverage
   ```

3. **Coverage Comparison**
   ```bash
   # Coverage must not decrease
   # Before: 85%
   # After:  85% or higher
   ```

4. **Lint Check**
   ```bash
   pnpm lint
   ```

5. **Import Check**
   ```bash
   # Verify no broken imports
   pnpm check:circular
   ```

## Output Format

```
=== Refactoring Complete ===
Pattern: {pattern}
Target: {targetPath}

Changes Made:
  - Extracted 4 functions from processOrder
  - Created new file: order.utils.ts
  - Updated 3 call sites

Files Modified:
  - packages/orders/src/order.service.ts (simplified)
  - packages/orders/src/order.utils.ts (new)
  - packages/orders/__tests__/order.service.test.ts (updated)

Metrics:
  Lines Before: 150
  Lines After: 180 (30 new, but clearer)
  Cyclomatic Complexity: 12 -> 4
  Test Coverage: 85% -> 87%

Quality Gates: PASSED
```

## Safety Annotations

Add to refactored files:
```typescript
/**
 * @refactored-at {timestamp}
 * @refactored-by claude-opus-4-5
 * @pattern {pattern-name}
 * @original-coverage 85%
 * @final-coverage 87%
 */
```
```

## Example Usages

### Example 1: Extract Shared Validation
```
Extract email and phone validation from auth, billing, and
notifications packages into a shared @forge/validation package
```

### Example 2: Simplify Complex Function
```
Simplify the calculatePricing function in billing/src/pricing.ts
which has 8 levels of nesting and 15 conditionals
```

### Example 3: Rename Across Codebase
```
Rename "getUser" to "getUserById" across all packages
to clarify the function's behavior
```
