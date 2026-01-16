# Claude AI Assistant Conventions

This document defines conventions for AI-assisted development in the Forge Factory codebase.

## Code Generation Principles

1. **Traceability**: Every AI-generated code block must include a `prompt-id` comment linking to the versioned prompt in `tools/prompts/`
2. **Review Required**: All AI-generated code must be reviewed by a human before merging
3. **Test Coverage**: AI-generated code must achieve minimum 80% test coverage
4. **Type Safety**: All generated code must pass TypeScript strict mode checks

## Prompt ID Format

```typescript
/**
 * @prompt-id forge-v4.1:feature:organization-mgmt:001
 * @generated-at 2024-01-16T00:00:00Z
 * @model claude-3-opus
 */
```

## Generation Guidelines

### Do Generate
- Complete vertical slices (schema + API + UI + tests)
- Boilerplate code (interfaces, types, DTOs)
- Test fixtures and factories
- Documentation and JSDoc comments
- Migration scripts
- Standard CRUD operations

### Do Not Generate Without Human Review
- Authentication logic
- Payment processing
- Data migrations affecting production
- Security-critical code
- Permission checks
- Encryption/decryption logic

## Quality Gates

All AI-generated code must pass:

1. **Linting**: ESLint with strict rules
2. **Type Checking**: TypeScript strict mode
3. **Security Scanning**: Semgrep rules
4. **Test Coverage**: Minimum 80%
5. **Circular Dependency Check**: No cycles allowed
6. **Bundle Size**: Within performance budget

## Prompt Library

Prompts are versioned and stored in `tools/prompts/`:

```
tools/prompts/
  v4.1/
    features/
      create-feature.md
      add-api-endpoint.md
      add-ui-component.md
    generators/
      vertical-slice.md
      migration.md
    utilities/
      refactor-pattern.md
```

## AI Metrics Tracking

Track AI-generation ratio in `.ai-metrics.json`:

```json
{
  "totalLines": 50000,
  "aiGeneratedLines": 37500,
  "ratio": 0.75,
  "byCategory": {
    "features": 0.85,
    "tests": 0.90,
    "infrastructure": 0.60,
    "security": 0.20
  }
}
```

## Human Decision Records

For code written by humans, document the decision:

```typescript
/**
 * @human-decision
 * @reason Edge case handling requires domain knowledge
 * @author john.doe
 * @date 2024-01-16
 */
function handleComplexEdgeCase() {
  // Custom logic here
}
```

## Iterative Refinement

When AI-generated code needs refinement:

1. Document the issue in a comment
2. Create a refinement prompt
3. Version the refinement
4. Track iterations

```typescript
/**
 * @prompt-id forge-v4.1:feature:organization-mgmt:001
 * @refined-by forge-v4.1:feature:organization-mgmt:001-r1
 * @refinement-reason Improved error handling
 */
```

## Safety Checks

Before accepting AI-generated code:

- [ ] No hardcoded secrets or credentials
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Proper input validation
- [ ] Correct tenant isolation
- [ ] Audit logging present
- [ ] Error handling appropriate
- [ ] Accessibility considered (for UI)
- [ ] i18n keys used (no hardcoded strings)
- [ ] Feature flags applied where needed

## Prohibited Patterns

AI should never generate:

- Direct database queries (must use Prisma)
- Hardcoded configuration values
- Commented-out code
- Console.log statements in production code
- Any TODO comments
- Bypasses of security checks
- Direct cross-app imports

## Collaboration Flow

1. Human writes feature specification
2. AI generates initial implementation
3. Human reviews and requests refinements
4. AI refines based on feedback
5. Human approves and adds human-decision annotations where needed
6. CI validates all quality gates
7. Human merges to main

## Learning from Code

After each feature:

1. Extract successful patterns into generators
2. Update prompt library with improvements
3. Document edge cases in ADRs
4. Update this guide with new conventions

## Version History

- v1.0 (2024-01-16): Initial version for Forge v4.1
