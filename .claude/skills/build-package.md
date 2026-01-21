# Skill: Build Package

**Trigger:** `/build-package <package-name> [--from-adr <adr-number>]`

## Purpose

Generate a new `@forge/{package-name}` package with proper structure, configuration, and boilerplate. Packages are shared libraries used across apps in the monorepo.

## Package Categories

1. **Core Infrastructure**: database, cache, queue, storage
2. **Security**: auth, sso, roles, compliance, encryption
3. **Business Logic**: billing, notifications, feature-flags
4. **UI**: design-system, i18n, analytics
5. **Integration**: webhooks, siem, import/export
6. **AI**: code-analysis, ai-readiness, llm-router

## Execution Steps

### Step 1: Validate Package Name

```bash
# Check package doesn't exist
if [ -d "packages/$PACKAGE_NAME" ]; then
  echo "ERROR: Package already exists"
  exit 1
fi

# Verify name follows convention
# Must be: lowercase, hyphenated, descriptive
```

### Step 2: Create Package Structure

```
packages/{package-name}/
├── src/
│   ├── index.ts                 # Public API exports
│   ├── {name}.service.ts        # Main service class
│   ├── {name}.types.ts          # TypeScript interfaces
│   ├── {name}.constants.ts      # Constants and enums
│   ├── {name}.errors.ts         # Custom error classes
│   └── utils/
│       └── {name}.utils.ts      # Utility functions
├── __tests__/
│   ├── {name}.service.test.ts   # Service unit tests
│   └── {name}.utils.test.ts     # Utility tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Step 3: Generate package.json

```json
{
  "name": "@forge/{package-name}",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  },
  "peerDependencies": {}
}
```

### Step 4: Generate tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

### Step 5: Generate Main Service

```typescript
/**
 * @prompt-id forge-v4.1:package:{package-name}:001
 * @generated-at {ISO-timestamp}
 * @model claude-opus-4-5
 */

import { {Name}Config, {Name}Options } from './{name}.types';
import { {Name}Error } from './{name}.errors';

export class {Name}Service {
  private readonly config: {Name}Config;

  constructor(config: {Name}Config) {
    this.config = config;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Implementation
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Implementation
  }
}
```

### Step 6: Generate Types

```typescript
/**
 * @prompt-id forge-v4.1:package:{package-name}:002
 * @generated-at {ISO-timestamp}
 * @model claude-opus-4-5
 */

export interface {Name}Config {
  enabled: boolean;
  // Add configuration options
}

export interface {Name}Options {
  // Add runtime options
}

export interface {Name}Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Step 7: Generate Error Classes

```typescript
/**
 * @prompt-id forge-v4.1:package:{package-name}:003
 * @generated-at {ISO-timestamp}
 * @model claude-opus-4-5
 */

import { BaseError } from '@forge/errors';

export class {Name}Error extends BaseError {
  constructor(message: string, cause?: Error) {
    super(message, '{NAME}_ERROR', cause);
  }
}

export class {Name}ConfigError extends {Name}Error {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

export class {Name}ValidationError extends {Name}Error {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
  }
}
```

### Step 8: Generate Tests

```typescript
/**
 * @prompt-id forge-v4.1:package:{package-name}:004
 * @generated-at {ISO-timestamp}
 * @model claude-opus-4-5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { {Name}Service } from '../src/{name}.service';

describe('{Name}Service', () => {
  let service: {Name}Service;

  beforeEach(() => {
    service = new {Name}Service({
      enabled: true,
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', async () => {
      await service.initialize();
      await expect(service.dispose()).resolves.not.toThrow();
    });
  });
});
```

### Step 9: Generate README

```markdown
# @forge/{package-name}

{Description from ADR or generated}

## Installation

This package is internal to the Forge Factory monorepo.

## Usage

\`\`\`typescript
import { {Name}Service } from '@forge/{package-name}';

const service = new {Name}Service({
  enabled: true,
});

await service.initialize();
\`\`\`

## API

### {Name}Service

Main service class for {description}.

#### Methods

- `initialize()`: Initialize the service
- `dispose()`: Cleanup resources

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| enabled | boolean | true | Enable/disable the service |

## Related ADRs

- ADR-{number}: {title}
```

### Step 10: Update tsconfig.base.json

Add path alias:

```json
{
  "paths": {
    "@forge/{package-name}": ["packages/{package-name}/src/index.ts"]
  }
}
```

### Step 11: Run Quality Gates

- TypeScript compilation
- ESLint
- Tests
- Coverage check

## Output Format

```
=== Package Generation Complete ===
Package: @forge/{package-name}
Location: packages/{package-name}/
Files: 8
Lines: ~{count}

Structure:
  src/
    index.ts
    {name}.service.ts
    {name}.types.ts
    {name}.errors.ts
    {name}.constants.ts
  __tests__/
    {name}.service.test.ts
  package.json
  tsconfig.json
  README.md

Next Steps:
  1. pnpm install
  2. Implement service methods
  3. Add to dependent packages
```

## Integration Points

After package creation:
1. Other packages can import via `@forge/{package-name}`
2. Apps can use the package
3. CI will include in builds
