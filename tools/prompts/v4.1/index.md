# Forge Factory Prompt Library v4.1

## Overview

This prompt library provides versioned, reusable prompts for AI-assisted development in the Forge Factory platform. All prompts follow the conventions defined in `CLAUDE.md`.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.1.0 | 2026-01-21 | Initial release with core prompts |

## Prompt Categories

### Features (`features/`)

Prompts for generating new features and functionality.

| Prompt ID | File | Description |
|-----------|------|-------------|
| `forge-v4.1:feature:create-feature` | `create-feature.md` | Generate complete vertical slice |
| `forge-v4.1:feature:add-api-endpoint` | `add-api-endpoint.md` | Add API endpoint to module |
| `forge-v4.1:feature:add-ui-component` | `add-ui-component.md` | Generate React component |

### Generators (`generators/`)

Prompts for generating boilerplate and scaffolding.

| Prompt ID | File | Description |
|-----------|------|-------------|
| `forge-v4.1:generator:vertical-slice` | `vertical-slice.md` | Full vertical slice generator |
| `forge-v4.1:generator:migration` | `migration.md` | Database migration generator |
| `forge-v4.1:generator:package` | `package.md` | New package scaffold |
| `forge-v4.1:generator:test-suite` | `test-suite.md` | Test file generator |

### Utilities (`utilities/`)

Prompts for code maintenance and improvement.

| Prompt ID | File | Description |
|-----------|------|-------------|
| `forge-v4.1:utility:refactor-pattern` | `refactor-pattern.md` | Safe code refactoring |
| `forge-v4.1:utility:fix-type-errors` | `fix-type-errors.md` | Resolve TypeScript errors |
| `forge-v4.1:utility:improve-coverage` | `improve-coverage.md` | Add tests to increase coverage |

## Prompt ID Format

All generated code must include a prompt ID comment:

```typescript
/**
 * @prompt-id forge-v4.1:{category}:{name}:{sequence}
 * @generated-at {ISO-8601 timestamp}
 * @model claude-opus-4-5
 */
```

### Format Breakdown

- `forge-v4.1` - Platform and version
- `{category}` - Prompt category (feature, generator, utility, test)
- `{name}` - Specific prompt or feature name
- `{sequence}` - Sequential number within generation session (001, 002, etc.)

## Usage Guidelines

### 1. Selecting the Right Prompt

| Task | Recommended Prompt |
|------|-------------------|
| New feature from ADR | `create-feature` |
| Add endpoint to existing module | `add-api-endpoint` |
| Create shared package | `package` (generator) |
| Schema change | `migration` |
| Clean up code | `refactor-pattern` |

### 2. Providing Context

Always provide:
- Relevant ADR reference
- Existing code context
- Specific requirements
- Constraints or limitations

### 3. Reviewing Output

After generation:
1. Run quality gates
2. Review for security issues
3. Verify test coverage
4. Check prompt ID traceability

## Integration with Skills

Skills (`.claude/skills/`) use these prompts internally:

| Skill | Prompts Used |
|-------|--------------|
| `/build-feature` | `create-feature`, `vertical-slice`, `test-suite` |
| `/build-package` | `package` |
| `/generate-tests` | `test-suite` |
| `/full-build` | All prompts |

## Quality Requirements

Per `CLAUDE.md`, all generated code must:

- [ ] Pass TypeScript strict mode
- [ ] Pass ESLint
- [ ] Have 80%+ test coverage
- [ ] Include prompt ID annotation
- [ ] Follow tenant isolation patterns
- [ ] Include audit logging
- [ ] Use i18n (no hardcoded strings in UI)

## Extending the Library

### Adding a New Prompt

1. Create file in appropriate category directory
2. Follow template structure:
   - Purpose
   - Input Parameters
   - Generation Template
   - Output Format
   - Example Usage
3. Add to this index
4. Update `.claude/settings.json` if needed

### Versioning

- Major version: Breaking changes to prompt format
- Minor version: New prompts or capabilities
- Patch version: Fixes and improvements

## Metrics Tracking

All prompt usage is tracked in `.ai-metrics.json`:

```json
{
  "promptUsage": {
    "forge-v4.1:feature:create-feature": {
      "count": 15,
      "linesGenerated": 4500,
      "avgCoverage": 87
    }
  }
}
```

## Related Documentation

- `CLAUDE.md` - AI development conventions
- `.claude/skills/` - Autonomous skills
- `.claude/hooks/` - Development hooks
- `tools/adrs/` - Architecture Decision Records
