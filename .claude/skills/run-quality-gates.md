# Skill: Run Quality Gates

**Trigger:** `/run-quality-gates [--path <target>] [--fix] [--strict]`

## Purpose

Execute all quality validation checks defined in the project. This skill ensures code meets the standards defined in `CLAUDE.md` and the CI pipeline.

## Quality Gates

### 1. TypeScript Compilation (Required)

```bash
pnpm tsc --noEmit
```

**Pass Criteria:**
- Zero compilation errors
- All types resolved
- Strict mode enabled

**Common Fixes:**
- Add missing type annotations
- Fix type mismatches
- Add missing imports

### 2. ESLint Validation (Required)

```bash
pnpm lint
# Or for specific path:
pnpm eslint {path} --max-warnings 0
```

**Pass Criteria:**
- Zero errors
- Zero warnings (strict mode)
- Import order correct
- No unused variables

**Auto-fix:**
```bash
pnpm lint --fix
```

### 3. Prettier Formatting (Required)

```bash
pnpm prettier --check "**/*.{ts,tsx,js,jsx,json,md}"
```

**Pass Criteria:**
- All files formatted correctly

**Auto-fix:**
```bash
pnpm prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

### 4. Circular Dependency Check (Required)

```bash
pnpm check:circular
# Or using madge directly:
npx madge --circular --extensions ts,tsx apps/ packages/
```

**Pass Criteria:**
- Zero circular dependencies
- Clean dependency graph

**Fix Strategy:**
1. Identify cycle from output
2. Extract shared code to new package
3. Use dependency injection
4. Restructure imports

### 5. Test Execution (Required)

```bash
# All tests
pnpm test

# Specific path
pnpm vitest run {path}

# With coverage
pnpm test --coverage
```

**Pass Criteria:**
- All tests pass
- Coverage >= 80% (lines, functions, branches, statements)

### 6. Security Scan (Required)

```bash
# Using Semgrep
semgrep --config auto . --quiet

# Or via npm script
pnpm security:scan
```

**Pass Criteria:**
- No high/critical vulnerabilities
- No SQL injection patterns
- No XSS patterns
- No hardcoded secrets

### 7. Bundle Size Check (Optional)

```bash
# Build and analyze
pnpm build
pnpm analyze
```

**Pass Criteria:**
- Initial JS < 200KB (gzipped)
- No unexpected large dependencies

### 8. Accessibility Audit (For UI)

```bash
pnpm test:a11y
```

**Pass Criteria:**
- Zero WCAG 2.1 AA violations
- Proper ARIA labels
- Keyboard navigable

## Execution Modes

### Standard Mode (Default)

Run all required gates, report failures:

```bash
/run-quality-gates
```

### Fix Mode

Automatically fix what can be fixed:

```bash
/run-quality-gates --fix
```

Actions:
1. Run `eslint --fix`
2. Run `prettier --write`
3. Report remaining issues

### Strict Mode

Zero tolerance for warnings:

```bash
/run-quality-gates --strict
```

Additional checks:
- No warnings allowed
- Coverage must be >= 85%
- All TODOs flagged

### Targeted Mode

Check specific path only:

```bash
/run-quality-gates --path packages/auth
```

## Output Format

```
=== Quality Gates Execution ===
Timestamp: {ISO-timestamp}
Mode: {standard|fix|strict}
Target: {all|specific-path}

Gate Results:
  1. TypeScript Compilation  [PASS] 0 errors
  2. ESLint Validation       [PASS] 0 errors, 0 warnings
  3. Prettier Formatting     [PASS] All files formatted
  4. Circular Dependencies   [PASS] No cycles detected
  5. Test Execution          [PASS] 142/142 tests passed
  6. Test Coverage           [PASS] 87.3% coverage
  7. Security Scan           [PASS] No issues found

=== Summary ===
Total Gates: 7
Passed: 7
Failed: 0
Warnings: 0

STATUS: ALL QUALITY GATES PASSED
```

## Failure Report Format

```
=== Quality Gates Execution ===
...

Gate Results:
  1. TypeScript Compilation  [FAIL]
     - packages/auth/src/auth.service.ts:42:5
       Error: Type 'string' is not assignable to type 'number'
     - packages/auth/src/auth.types.ts:15:3
       Error: Property 'userId' is missing in type

  2. ESLint Validation       [FAIL]
     - apps/api/src/main.ts:10:1
       Error: 'console' is not allowed (no-console)

...

=== Summary ===
Total Gates: 7
Passed: 5
Failed: 2
Warnings: 0

STATUS: QUALITY GATES FAILED

Recommended Actions:
  1. Fix TypeScript errors in auth package
  2. Remove console.log statements
  3. Re-run: /run-quality-gates
```

## CI Integration

These gates are also run in `.github/workflows/ci.yml`:

```yaml
jobs:
  quality:
    steps:
      - name: TypeScript
        run: pnpm tsc --noEmit
      - name: Lint
        run: pnpm lint
      - name: Test
        run: pnpm test --coverage
      - name: Security
        run: semgrep --config auto .
```

## Performance Targets

| Gate | Target Time |
|------|-------------|
| TypeScript | < 30s |
| ESLint | < 60s |
| Prettier | < 15s |
| Circular Check | < 10s |
| Tests | < 5m |
| Security Scan | < 2m |

Total pipeline target: < 10 minutes
