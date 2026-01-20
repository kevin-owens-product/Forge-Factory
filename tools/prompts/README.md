# AI Prompt Library

This directory contains versioned prompts for AI-assisted code generation in the Forge Factory project.

## Structure

```
prompts/
└── v4.1/
    ├── features/          # Feature generation prompts
    ├── generators/        # Code generator prompts
    └── utilities/         # Utility and refactoring prompts
```

## Usage

When generating code with AI assistants, reference the appropriate prompt version:

```typescript
/**
 * @prompt-id forge-v4.1:feature:organization-mgmt:001
 * @generated-at 2024-01-16T00:00:00Z
 * @model claude-3-opus
 */
```

## Versioning

Prompts are versioned to ensure traceability and reproducibility:

- **v4.1**: Current version (Forge Method v4.1)
- Future versions will be added as needed

## Adding New Prompts

1. Create a new Markdown file in the appropriate category directory
2. Use descriptive naming (e.g., `create-vertical-slice.md`)
3. Include prompt metadata and examples
4. Update this README with the new prompt

## See Also

- [CLAUDE.md](../../CLAUDE.md) - AI development conventions
- [The Forge Method](../../docs/00-overview/the-forge-method.md) - Development methodology
- [Architecture Decisions](../../docs/02-architecture/decisions/) - ADRs

---

**Note**: This directory is currently a placeholder. Prompts will be added as the project evolves.
