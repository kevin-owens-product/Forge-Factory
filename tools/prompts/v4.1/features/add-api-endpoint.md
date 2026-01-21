# Prompt: Add API Endpoint

**ID:** `forge-v4.1:feature:add-api-endpoint`
**Version:** 4.1.0
**Category:** Features

## Purpose

Generate a new API endpoint with controller, service method, DTOs, validation, and tests.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| module | string | Yes | Existing module name |
| method | string | Yes | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| path | string | Yes | URL path (e.g., "/users/:id/activate") |
| operationName | string | Yes | Method name (e.g., "activateUser") |
| requestBody | object | No | Request body schema |
| responseBody | object | No | Response body schema |
| auth | boolean | No | Requires authentication (default: true) |
| permissions | string[] | No | Required permissions |

## Prompt Template

```
You are adding a new API endpoint to an existing module in the Forge Factory platform.

MODULE: {module}
ENDPOINT: {method} {path}
OPERATION: {operationName}

## Specifications

### Request
- Method: {method}
- Path: {path}
- Auth Required: {auth}
- Permissions: {permissions}
- Body Schema: {requestBody}

### Response
- Success Status: {successStatus}
- Body Schema: {responseBody}
- Error Codes: {errorCodes}

## Generation Instructions

### 1. DTO Definitions

Add to `apps/api/src/modules/{module}/{module}.dto.ts`:

```typescript
/**
 * @prompt-id forge-v4.1:feature:add-api-endpoint:{operationName}:001
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

// Request DTO
export class {OperationName}RequestDto {
  @ApiProperty({ description: '...' })
  @IsString()
  @IsNotEmpty()
  fieldName: string;
  // Add all request fields with validation
}

// Response DTO
export class {OperationName}ResponseDto {
  @ApiProperty({ description: '...' })
  fieldName: string;
  // Add all response fields
}
```

### 2. Controller Method

Add to `apps/api/src/modules/{module}/{module}.controller.ts`:

```typescript
/**
 * @prompt-id forge-v4.1:feature:add-api-endpoint:{operationName}:002
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

@{Method}('{path}')
@ApiOperation({ summary: '{description}' })
@ApiResponse({ status: {successStatus}, type: {OperationName}ResponseDto })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden' })
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions({permissions})
async {operationName}(
  @Param('id') id: string,
  @Body() dto: {OperationName}RequestDto,
  @CurrentUser() user: AuthenticatedUser,
  @TenantId() tenantId: string,
): Promise<{OperationName}ResponseDto> {
  return this.{module}Service.{operationName}(id, dto, tenantId, user.id);
}
```

### 3. Service Method

Add to `packages/{module}/src/{module}.service.ts`:

```typescript
/**
 * @prompt-id forge-v4.1:feature:add-api-endpoint:{operationName}:003
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

async {operationName}(
  id: string,
  data: {OperationName}Input,
  tenantId: string,
  userId: string,
): Promise<{OperationName}Result> {
  // Validate entity exists and belongs to tenant
  const entity = await this.repository.findById(id, tenantId);
  if (!entity) {
    throw new NotFoundError('{Module}', id);
  }

  // Business logic validation
  this.validate{OperationName}(entity, data);

  // Perform operation
  const result = await this.repository.{operationName}(id, data, tenantId);

  // Audit log
  await this.auditService.log({
    action: '{OPERATION_NAME}',
    entityType: '{Module}',
    entityId: id,
    tenantId,
    userId,
    changes: data,
  });

  return result;
}

private validate{OperationName}(entity: {Module}, data: {OperationName}Input): void {
  // Add business rule validations
  // Throw ValidationError if invalid
}
```

### 4. Repository Method

Add to `packages/{module}/src/{module}.repository.ts`:

```typescript
/**
 * @prompt-id forge-v4.1:feature:add-api-endpoint:{operationName}:004
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 */

async {operationName}(
  id: string,
  data: {OperationName}Input,
  tenantId: string,
): Promise<{Module}> {
  return this.prisma.{module}.update({
    where: {
      id,
      tenantId, // Enforce tenant isolation
    },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}
```

### 5. Tests

Create/update test files:

**Unit Test for Service:**
```typescript
describe('{operationName}', () => {
  it('should {expected behavior} when {condition}', async () => {
    // Arrange
    const mockEntity = createMock{Module}();
    repository.findById.mockResolvedValue(mockEntity);
    repository.{operationName}.mockResolvedValue({ ...mockEntity, ...updateData });

    // Act
    const result = await service.{operationName}(id, data, tenantId, userId);

    // Assert
    expect(result).toEqual(expected);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: '{OPERATION_NAME}',
    }));
  });

  it('should throw NotFoundError when entity not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.{operationName}(id, data, tenantId, userId))
      .rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when {validation fails}', async () => {
    // Test business rule validation
  });
});
```

**Integration Test for API:**
```typescript
describe('{method} {path}', () => {
  it('should return {successStatus} for valid request', async () => {
    const response = await request(app)
      .{method.toLowerCase()}('{path}'.replace(':id', testId))
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantId)
      .send(validData);

    expect(response.status).toBe({successStatus});
    expect(response.body).toMatchObject(expectedResponse);
  });

  it('should return 401 without auth', async () => {
    const response = await request(app)
      .{method.toLowerCase()}('{path}'.replace(':id', testId))
      .send(validData);

    expect(response.status).toBe(401);
  });

  it('should return 403 for wrong tenant', async () => {
    const response = await request(app)
      .{method.toLowerCase()}('{path}'.replace(':id', testId))
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'wrong-tenant')
      .send(validData);

    expect(response.status).toBe(403);
  });
});
```

## Output Files

1. Modified: `apps/api/src/modules/{module}/{module}.dto.ts`
2. Modified: `apps/api/src/modules/{module}/{module}.controller.ts`
3. Modified: `packages/{module}/src/{module}.service.ts`
4. Modified: `packages/{module}/src/{module}.repository.ts`
5. Modified/Created: `packages/{module}/__tests__/{module}.service.test.ts`
6. Modified/Created: `apps/api/src/modules/{module}/__tests__/{module}.controller.test.ts`

## Quality Checklist

- [ ] DTOs have complete validation decorators
- [ ] OpenAPI documentation complete
- [ ] Auth guard applied
- [ ] Permission check applied
- [ ] Tenant isolation enforced
- [ ] Audit logging added
- [ ] Error handling complete
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] All tests pass
```

## Example Usage

```
Add endpoint POST /projects/:projectId/archive with:
- Requires 'project:archive' permission
- Archives project and all related resources
- Returns archived project details
```
