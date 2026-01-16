# @forge/errors

Typed error codes and standardized error handling for the Forge Factory platform.

## Overview

This package provides:
- **Typed error codes** organized by category
- **ForgeError class** with structured error information
- **Factory functions** for creating common errors
- **Type guards** for error handling
- **Standard error messages**

## Usage

### Creating Errors

```typescript
import {
  ForgeError,
  ErrorCode,
  createNotFoundError,
  createValidationError
} from '@forge/errors';

// Using factory functions
throw createNotFoundError('User', userId);

// Using the class directly
throw new ForgeError({
  code: ErrorCode.INSUFFICIENT_PERMISSIONS,
  message: 'You need admin role to perform this action',
  statusCode: 403,
  details: { requiredRole: 'admin', userRole: 'member' }
});
```

### Handling Errors

```typescript
import { isForgeError, handleError } from '@forge/errors';

try {
  await someOperation();
} catch (error) {
  if (isForgeError(error)) {
    // Handle known Forge errors
    console.log(error.code, error.statusCode);
  } else {
    // Convert unknown errors to ForgeError
    const forgeError = handleError(error);
    throw forgeError;
  }
}
```

### Error Categories

- **AUTH_1xxx**: Authentication errors
- **AUTHZ_2xxx**: Authorization errors
- **VAL_3xxx**: Validation errors
- **RES_4xxx**: Resource errors
- **RATE_5xxx**: Rate limiting errors
- **EXT_6xxx**: External service errors
- **INT_9xxx**: Internal errors

## License

MIT
