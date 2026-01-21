# Skill: Generate Tests

**Trigger:** `/generate-tests <path> [--type <unit|integration|e2e|all>] [--coverage-target <percent>]`

## Purpose

Generate comprehensive test suites for existing code to achieve the required 80%+ coverage target. This skill analyzes code structure and generates appropriate tests.

## Test Types

### 1. Unit Tests (Vitest)

For isolated function/class testing:
- Services
- Utilities
- Validators
- Pure functions

### 2. Integration Tests (Vitest + Supertest)

For API endpoint testing:
- Controllers
- Middleware
- Database operations

### 3. E2E Tests (Playwright)

For user flow testing:
- Critical paths
- Form submissions
- Navigation

### 4. Accessibility Tests (axe-playwright)

For WCAG compliance:
- All UI components
- Form accessibility
- Keyboard navigation

## Execution Steps

### Step 1: Analyze Target Code

```typescript
// Parse the target file/directory
const analysis = analyzeCode(targetPath);

interface CodeAnalysis {
  filePath: string;
  type: 'service' | 'controller' | 'component' | 'utility';
  exports: ExportedItem[];
  dependencies: string[];
  complexity: number;
  existingTests: string[];
  currentCoverage: number;
}
```

### Step 2: Identify Test Requirements

For each exported function/class:
1. Input parameters and types
2. Return type
3. Side effects
4. Error conditions
5. Edge cases

### Step 3: Generate Test File

#### Unit Test Template

```typescript
/**
 * @prompt-id forge-v4.1:test:{feature}:{sequence}
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 * @target {original-file-path}
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { {ExportedClass/Function} } from '{relative-path}';

// Mock dependencies
vi.mock('@forge/database', () => ({
  prisma: {
    // mock implementation
  }
}));

describe('{ExportedClass/Function}', () => {
  // Setup
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('{methodName}', () => {
    it('should {expected behavior} when {condition}', async () => {
      // Arrange
      const input = {};

      // Act
      const result = await methodName(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should throw {ErrorType} when {error condition}', async () => {
      // Arrange
      const invalidInput = {};

      // Act & Assert
      await expect(methodName(invalidInput))
        .rejects.toThrow({ErrorType});
    });

    it('should handle edge case: {description}', async () => {
      // Edge case testing
    });
  });
});
```

#### Integration Test Template

```typescript
/**
 * @prompt-id forge-v4.1:test:integration:{feature}:{sequence}
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '@forge/prisma';

describe('{Feature} API', () => {
  let testTenantId: string;

  beforeAll(async () => {
    // Setup test data
    testTenantId = await createTestTenant();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData(testTenantId);
  });

  describe('GET /api/{resource}', () => {
    it('should return 200 with list of {resources}', async () => {
      const response = await request(app)
        .get('/api/{resource}')
        .set('Authorization', `Bearer ${testToken}`)
        .set('X-Tenant-ID', testTenantId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/{resource}');

      expect(response.status).toBe(401);
    });

    it('should return 403 for wrong tenant', async () => {
      const response = await request(app)
        .get('/api/{resource}')
        .set('Authorization', `Bearer ${testToken}`)
        .set('X-Tenant-ID', 'wrong-tenant-id');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/{resource}', () => {
    it('should create {resource} with valid data', async () => {
      const validData = { /* valid payload */ };

      const response = await request(app)
        .post('/api/{resource}')
        .set('Authorization', `Bearer ${testToken}`)
        .set('X-Tenant-ID', testTenantId)
        .send(validData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should return 400 with invalid data', async () => {
      const invalidData = { /* invalid payload */ };

      const response = await request(app)
        .post('/api/{resource}')
        .set('Authorization', `Bearer ${testToken}`)
        .set('X-Tenant-ID', testTenantId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });
});
```

#### E2E Test Template

```typescript
/**
 * @prompt-id forge-v4.1:test:e2e:{feature}:{sequence}
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

import { test, expect } from '@playwright/test';

test.describe('{Feature} User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/**/dashboard');
  });

  test('should complete {action} successfully', async ({ page }) => {
    // Navigate to feature
    await page.click('[data-testid="nav-{feature}"]');
    await page.waitForSelector('[data-testid="{feature}-page"]');

    // Perform action
    await page.click('[data-testid="create-button"]');
    await page.fill('[data-testid="name-input"]', 'Test Item');
    await page.click('[data-testid="submit-button"]');

    // Verify result
    await expect(page.locator('[data-testid="success-message"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="item-list"]'))
      .toContainText('Test Item');
  });

  test('should show error for invalid input', async ({ page }) => {
    await page.click('[data-testid="nav-{feature}"]');
    await page.click('[data-testid="create-button"]');
    await page.click('[data-testid="submit-button"]'); // Submit empty

    await expect(page.locator('[data-testid="error-message"]'))
      .toBeVisible();
  });
});
```

### Step 4: Generate Test Utilities

Create shared test utilities if needed:

```typescript
// __tests__/utils/test-helpers.ts

export async function createTestTenant() {
  return prisma.tenant.create({
    data: {
      name: `test-tenant-${Date.now()}`,
      slug: `test-${Date.now()}`,
    }
  });
}

export async function createTestUser(tenantId: string) {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      tenantId,
    }
  });
}

export function mockAuthMiddleware(userId: string, tenantId: string) {
  return (req, res, next) => {
    req.user = { id: userId, tenantId };
    next();
  };
}
```

### Step 5: Run Tests and Check Coverage

```bash
pnpm vitest run {test-file} --coverage
```

### Step 6: Iterate Until Coverage Met

If coverage < 80%:
1. Identify uncovered lines
2. Generate additional test cases
3. Repeat

## Output Format

```
=== Test Generation Complete ===
Target: packages/auth/src/auth.service.ts
Test Type: unit

Generated Files:
  - packages/auth/__tests__/auth.service.test.ts (new)
  - packages/auth/__tests__/utils/auth-test-helpers.ts (new)

Test Summary:
  Total Tests: 24
  Coverage Before: 45%
  Coverage After: 87%

Test Cases Generated:
  AuthService
    ├── constructor (2 tests)
    ├── login (6 tests)
    │   ├── successful login
    │   ├── invalid credentials
    │   ├── locked account
    │   ├── MFA required
    │   ├── expired password
    │   └── rate limited
    ├── logout (3 tests)
    ├── refreshToken (4 tests)
    ├── validateSession (5 tests)
    └── revokeAllSessions (4 tests)

Mocks Created:
  - @forge/database (prisma client)
  - @forge/cache (redis client)
  - External auth provider

Run Tests:
  pnpm vitest run packages/auth/__tests__/auth.service.test.ts
```

## Coverage Requirements

Per CLAUDE.md:
- Minimum 80% line coverage
- Minimum 80% function coverage
- Minimum 80% branch coverage
- Minimum 80% statement coverage

## Test Patterns by Code Type

| Code Type | Test Focus |
|-----------|------------|
| Service | Business logic, error handling, edge cases |
| Controller | HTTP responses, validation, auth |
| Repository | CRUD operations, queries, transactions |
| Utility | Pure function behavior, input variations |
| Component | Rendering, user interaction, accessibility |
| Middleware | Request/response modification, guards |
