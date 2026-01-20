# ADR-011: Approval Workflows

## Status
Accepted

## Context
Enterprise customers require approval workflows for sensitive operations to:
- Enforce separation of duties (compliance requirement)
- Prevent unauthorized changes (security)
- Maintain audit trail (compliance)
- Require manager/admin approval for high-risk actions
- Support multi-level approvals
- Enable compliance with SOX, PCI-DSS, SOC 2

Examples of sensitive operations:
- User deletion
- Role changes (elevation of privileges)
- Billing plan changes
- SSO configuration changes
- Data exports
- API key creation
- Organization deletion

## Decision
We will implement a **flexible approval workflow system** with configurable policies, multiple approval levels, notifications, and automatic execution upon approval.

## Approval Policy Model

```typescript
interface ApprovalPolicy {
  id: string;
  tenantId: TenantId;

  // Trigger
  name: string;
  description: string;
  triggerAction: ApprovalTrigger;

  // Conditions (when to require approval)
  conditions?: ApprovalCondition[];

  // Approvers
  approverType: 'role' | 'user' | 'manager' | 'custom';
  approverRoleId?: RoleId;
  approverUserIds?: UserId[];

  // Settings
  requiredApprovals: number;     // How many approvers needed
  autoApproveAfter?: number;     // Hours, null = never
  autoRejectAfter?: number;      // Hours, null = never
  allowSelfApproval: boolean;

  // Notifications
  notifyOnRequest: boolean;
  notifyOnApproval: boolean;
  notifyOnRejection: boolean;
  notificationChannels: ('email' | 'in_app' | 'slack')[];

  // Status
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ApprovalTrigger =
  | 'user.delete'
  | 'user.role_change'
  | 'user.invite'
  | 'organization.delete'
  | 'organization.archive'
  | 'billing.plan_change'
  | 'billing.cancel'
  | 'settings.sso_change'
  | 'api_key.create'
  | 'data_export.request'
  | 'integration.connect'
  | 'custom';
```

### Conditional Approvals
```typescript
interface ApprovalCondition {
  field: string;                 // e.g., 'user.role', 'amount', 'user.id'
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in';
  value: unknown;
}

// Example: Only require approval when elevating to admin
{
  triggerAction: 'user.role_change',
  conditions: [
    {
      field: 'role.new',
      operator: 'eq',
      value: 'admin'
    }
  ]
}

// Example: Only require approval for exports > 10,000 records
{
  triggerAction: 'data_export.request',
  conditions: [
    {
      field: 'export.recordCount',
      operator: 'gt',
      value: 10000
    }
  ]
}
```

## Approval Request Model

```typescript
interface ApprovalRequest {
  id: string;
  tenantId: TenantId;
  policyId: string;

  // Request details
  action: ApprovalTrigger;
  resourceType: string;
  resourceId: string;
  requestedChanges: Record<string, unknown>;
  justification?: string;

  // Requester
  requestedBy: UserId;
  requestedAt: Date;

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

  // Approvals
  approvals: Approval[];
  requiredApprovals: number;

  // Resolution
  resolvedAt?: Date;
  resolvedBy?: UserId;
  resolutionNote?: string;

  // Execution
  executedAt?: Date;
  executionError?: string;

  // Expiration
  expiresAt?: Date;
}

interface Approval {
  approverId: UserId;
  decision: 'approved' | 'rejected';
  decidedAt: Date;
  note?: string;
}
```

## Approval Flow

### 1. Action Triggered
```typescript
// User attempts to delete another user
@ApprovalRequired('user.delete')
async deleteUser(targetUserId: UserId, ctx: RequestContext) {
  // 1. Check if policy exists for this action
  const policy = await this.approvalService.requiresApproval(
    ctx.tenantId,
    'user.delete',
    { userId: targetUserId }
  );

  if (policy) {
    // 2. Create approval request instead of executing
    const request = await this.approvalService.createRequest({
      tenantId: ctx.tenantId,
      policyId: policy.id,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: targetUserId,
      requestedChanges: { deleted: true },
      requestedBy: ctx.userId,
    });

    // 3. Notify approvers
    await this.notificationService.notifyApprovers(request);

    // 4. Return 202 Accepted with request ID
    return {
      status: 'pending_approval',
      requestId: request.id,
      message: 'Approval required. Request has been sent to administrators.',
    };
  }

  // No approval needed - execute immediately
  return await this.userService.delete(targetUserId);
}
```

### 2. Approver Reviews
```typescript
async function approveRequest(
  requestId: string,
  approverId: UserId,
  note?: string
): Promise<ApprovalRequest> {
  const request = await getApprovalRequest(requestId);

  // 1. Verify approver is authorized
  if (!await isAuthorizedApprover(request, approverId)) {
    throw new ForbiddenException('Not authorized to approve this request');
  }

  // 2. Check if already decided
  if (request.approvals.some(a => a.approverId === approverId)) {
    throw new Error('You have already reviewed this request');
  }

  // 3. Add approval
  request.approvals.push({
    approverId,
    decision: 'approved',
    decidedAt: new Date(),
    note,
  });

  // 4. Check if threshold met
  const approvalCount = request.approvals.filter(a => a.decision === 'approved').length;

  if (approvalCount >= request.requiredApprovals) {
    // Threshold met - execute action
    request.status = 'approved';
    request.resolvedAt = new Date();
    request.resolvedBy = approverId;

    // Execute the approved action
    await executeApprovedAction(request);

    // Notify requester
    await notifyRequester(request, 'approved');
  }

  await saveApprovalRequest(request);

  return request;
}
```

### 3. Automatic Execution
```typescript
async function executeApprovedAction(request: ApprovalRequest): Promise<void> {
  try {
    // Execute the action that was waiting for approval
    switch (request.action) {
      case 'user.delete':
        await userService.delete(request.resourceId);
        break;

      case 'user.role_change':
        await userService.updateRole(
          request.resourceId,
          request.requestedChanges.newRole
        );
        break;

      case 'billing.plan_change':
        await billingService.changePlan(
          request.resourceId,
          request.requestedChanges.newPlan
        );
        break;

      // ... other actions
    }

    request.executedAt = new Date();
  } catch (error) {
    request.executionError = error.message;
    throw error;
  }
}
```

## Approval Guard

### Decorator
```typescript
// Custom decorator for endpoints requiring approval
export const ApprovalRequired = (trigger: ApprovalTrigger) =>
  SetMetadata('approval_trigger', trigger);

// Guard implementation
@Injectable()
export class ApprovalRequiredGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const trigger = this.reflector.get<ApprovalTrigger>(
      'approval_trigger',
      context.getHandler()
    );

    if (!trigger) {
      return true;  // No approval required
    }

    // Check if policy exists
    const policy = await this.approvalService.requiresApproval(
      request.user.tenantId,
      trigger,
      request.body
    );

    if (policy) {
      // Create approval request
      const approvalRequest = await this.approvalService.createRequest({
        tenantId: request.user.tenantId,
        policyId: policy.id,
        action: trigger,
        requestedBy: request.user.id,
        requestedChanges: request.body,
      });

      // Throw exception with request info
      throw new ApprovalRequiredException(approvalRequest);
    }

    return true;  // No policy found, proceed
  }
}
```

## Multi-Level Approvals

### Sequential Approvals
```typescript
interface ApprovalPolicy {
  // ...existing fields
  approvalLevels: ApprovalLevel[];
}

interface ApprovalLevel {
  level: number;                 // 1, 2, 3, ...
  approverType: 'role' | 'user';
  approverRoleId?: RoleId;
  approverUserIds?: UserId[];
  requiredApprovals: number;
}

// Example: Manager approval, then Finance approval
{
  triggerAction: 'billing.plan_change',
  approvalLevels: [
    {
      level: 1,
      approverType: 'role',
      approverRoleId: 'manager',
      requiredApprovals: 1,
    },
    {
      level: 2,
      approverType: 'role',
      approverRoleId: 'finance',
      requiredApprovals: 1,
    }
  ]
}
```

## Notifications

### Email Notification
```typescript
async function notifyApprovers(request: ApprovalRequest) {
  const policy = await getPolicy(request.policyId);
  const approvers = await getApprovers(policy);

  for (const approver of approvers) {
    await sendEmail({
      to: approver.email,
      subject: `Approval Required: ${policy.name}`,
      body: `
        ${request.requestedBy} has requested ${policy.name}.

        Action: ${request.action}
        Justification: ${request.justification || 'None provided'}

        Review and approve/reject:
        ${getApprovalUrl(request.id)}
      `,
    });
  }
}
```

### Slack Notification
```typescript
// Rich Slack message with action buttons
const slackMessage = {
  text: 'New approval request',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Approval Request*\n<@${requester}> requested to delete user ${targetUser}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Action:*\n${action}` },
        { type: 'mrkdwn', text: `*Requested:*\n${timestamp}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: 'approve_request',
          value: requestId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject' },
          style: 'danger',
          action_id: 'reject_request',
          value: requestId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details' },
          url: getApprovalUrl(requestId),
        },
      ],
    },
  ],
};

await slackService.postMessage(approverSlackChannel, slackMessage);
```

## Approval UI

### Pending Approvals Inbox
```typescript
function ApprovalInbox({ userId }: { userId: UserId }) {
  const { data: requests } = useQuery(['approvals', userId], () =>
    api.getPendingApprovals(userId)
  );

  return (
    <div>
      <h2>Pending Approvals ({requests?.length || 0})</h2>

      {requests?.map(request => (
        <ApprovalCard key={request.id} request={request} />
      ))}
    </div>
  );
}

function ApprovalCard({ request }: { request: ApprovalRequest }) {
  const approve = useApprove(request.id);
  const reject = useReject(request.id);

  return (
    <Card>
      <Badge>{request.action}</Badge>
      <h3>{request.policy.name}</h3>
      <p>Requested by {request.requestedBy.name}</p>
      <p>{formatDistanceToNow(request.requestedAt)} ago</p>

      <p><strong>Justification:</strong> {request.justification}</p>

      <div>
        <strong>Changes:</strong>
        <pre>{JSON.stringify(request.requestedChanges, null, 2)}</pre>
      </div>

      <div>
        <Button onClick={() => approve.mutate()}>Approve</Button>
        <Button onClick={() => reject.mutate()} variant="danger">Reject</Button>
        <Button onClick={() => showDetails(request.id)}>View Details</Button>
      </div>
    </Card>
  );
}
```

### Request Justification Modal
```typescript
function RequestApprovalModal({ action, onSubmit }: Props) {
  const [justification, setJustification] = useState('');

  return (
    <Modal>
      <h2>Approval Required</h2>
      <p>This action requires approval from an administrator.</p>

      <TextArea
        label="Justification (optional)"
        placeholder="Explain why this action is needed..."
        value={justification}
        onChange={setJustification}
      />

      <Button onClick={() => onSubmit(justification)}>
        Request Approval
      </Button>
    </Modal>
  );
}
```

## Auto-Expiration

### Background Job
```typescript
@Cron('0 * * * *')  // Every hour
async function expireOldRequests() {
  const expired = await prisma.approvalRequest.findMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() }
    }
  });

  for (const request of expired) {
    request.status = 'expired';
    request.resolvedAt = new Date();

    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: request
    });

    // Notify requester
    await notifyRequester(request, 'expired');
  }
}
```

## Audit Trail

```typescript
// Log approval request creation
await auditLog.create({
  tenantId,
  userId: request.requestedBy,
  action: 'approval.requested',
  resourceType: request.resourceType,
  resourceId: request.resourceId,
  metadata: {
    approvalRequestId: request.id,
    action: request.action,
  }
});

// Log approval decision
await auditLog.create({
  tenantId,
  userId: approverId,
  action: 'approval.approved',
  resourceType: 'approval_request',
  resourceId: request.id,
  metadata: {
    originalAction: request.action,
    originalResource: request.resourceId,
  }
});

// Log automatic execution
await auditLog.create({
  tenantId,
  userId: 'system',
  action: request.action,
  resourceType: request.resourceType,
  resourceId: request.resourceId,
  metadata: {
    executedViaApproval: true,
    approvalRequestId: request.id,
  }
});
```

## Default Policies (Enterprise Plan)

```typescript
const DefaultPolicies: ApprovalPolicy[] = [
  {
    name: 'User Deletion',
    triggerAction: 'user.delete',
    approverType: 'role',
    approverRoleId: 'admin',
    requiredApprovals: 1,
    allowSelfApproval: false,
    enabled: true,
  },
  {
    name: 'Role Elevation to Admin',
    triggerAction: 'user.role_change',
    conditions: [
      { field: 'role.new', operator: 'eq', value: 'admin' }
    ],
    approverType: 'role',
    approverRoleId: 'owner',
    requiredApprovals: 1,
    allowSelfApproval: false,
    enabled: true,
  },
  {
    name: 'Billing Changes',
    triggerAction: 'billing.plan_change',
    approverType: 'role',
    approverRoleId: 'owner',
    requiredApprovals: 1,
    allowSelfApproval: true,  // Owner can self-approve
    enabled: true,
  },
  {
    name: 'SSO Configuration',
    triggerAction: 'settings.sso_change',
    approverType: 'role',
    approverRoleId: 'owner',
    requiredApprovals: 1,
    allowSelfApproval: false,
    enabled: true,
  },
  {
    name: 'Large Data Export',
    triggerAction: 'data_export.request',
    conditions: [
      { field: 'export.recordCount', operator: 'gt', value: 10000 }
    ],
    approverType: 'role',
    approverRoleId: 'admin',
    requiredApprovals: 1,
    allowSelfApproval: false,
    enabled: true,
  },
];
```

## Consequences

### Positive
- **Compliance**: SOX, SOC 2 separation of duties
- **Security**: Prevents unauthorized high-risk actions
- **Audit**: Complete trail of approvals
- **Flexibility**: Configurable per tenant
- **User experience**: Clear approval process

### Negative
- **Friction**: Slows down operations
- **Complexity**: More moving parts
- **Notification burden**: More emails/Slack messages

### Mitigations
- **Smart defaults**: Only require approval for truly sensitive actions
- **Conditions**: Only trigger approval when needed
- **Notifications**: Digest option to reduce spam
- **Auto-expiration**: Prevent abandoned requests

## Alternatives Considered

### 1. No Approval Workflows
**Rejected**: Enterprise compliance requirement

### 2. Email-Based Approvals Only
**Rejected**: Poor user experience, no automation

### 3. External Approval Service (e.g., Jira)
**Rejected**: Adds dependency, complexity

## References
- [SOX Compliance](https://www.sarbanes-oxley-101.com/)
- [SOC 2 Trust Principles](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html)

## Review Date
2024-04-16 (3 months)
