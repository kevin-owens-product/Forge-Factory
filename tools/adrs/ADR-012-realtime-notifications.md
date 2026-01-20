# ADR-012: Real-time Communication and Notifications

## Status
Accepted

## Context
Forge Factory needs real-time features for collaboration and monitoring:
- Real-time updates (tasks, workflows, agents)
- In-app notifications
- User presence tracking
- Collaborative editing indicators
- Push notifications (web, mobile)
- Email notifications (fallback)
- Notification preferences and filtering
- Read/unread status tracking
- Notification history

## Decision
We will use **Socket.io** for real-time bidirectional communication and a **hybrid notification system** combining WebSocket, Push API, and email.

### Real-time Communication Architecture

```
┌──────────────────────────────────────────────────────────────┐
│          Real-time Communication Architecture                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Client Layer                                          │ │
│  │  - Socket.io Client                                    │ │
│  │  - Notification Center UI                              │ │
│  │  - Presence Indicators                                 │ │
│  │  - Toast Notifications                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  WebSocket Gateway (Socket.io Server)                  │ │
│  │  - Connection management                               │ │
│  │  - Room-based broadcasting                             │ │
│  │  - Authentication                                      │ │
│  │  - Rate limiting                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Notification Service                                  │ │
│  │  - Event routing                                       │ │
│  │  - Notification creation                               │ │
│  │  - Preference filtering                                │ │
│  │  - Delivery orchestration                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Delivery Channels                                     │ │
│  │  - WebSocket (real-time)                               │ │
│  │  - Web Push (browser)                                  │ │
│  │  - Email (fallback)                                    │ │
│  │  - Webhook (integrations)                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↓                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storage (PostgreSQL + Redis)                          │ │
│  │  - Notification history                                │ │
│  │  - User preferences                                    │ │
│  │  - Presence cache                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Data Model

```prisma
// packages/prisma/schema.prisma

model Notification {
  id              String   @id @default(cuid())
  tenantId        String

  // Recipient
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content
  type            NotificationType
  title           String
  message         String   @db.Text
  icon            String?
  actionUrl       String?
  actionLabel     String?

  // Metadata
  relatedType     String?  // task, workflow, agent, etc.
  relatedId       String?
  metadata        Json?

  // Actor (who triggered the notification)
  actorId         String?
  actor           User?    @relation("NotificationActor", fields: [actorId], references: [id])

  // Status
  isRead          Boolean  @default(false)
  readAt          DateTime?
  deliveredVia    String[] // websocket, email, push

  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([userId, isRead])
  @@index([createdAt])
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMPLETED
  TASK_COMMENTED
  WORKFLOW_COMPLETED
  WORKFLOW_FAILED
  AGENT_COMPLETED
  AGENT_FAILED
  MENTION
  INVITATION
  APPROVAL_REQUEST
  SYSTEM_ALERT
}

model NotificationPreference {
  id              String   @id @default(cuid())
  tenantId        String
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Channels
  enableWebSocket Boolean  @default(true)
  enableWebPush   Boolean  @default(true)
  enableEmail     Boolean  @default(true)

  // Types
  preferences     Json     // Type-specific preferences

  // Quiet hours
  quietHoursStart String?  // HH:MM
  quietHoursEnd   String?  // HH:MM
  quietHoursTimezone String?

  updatedAt       DateTime @updatedAt

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@index([userId])
}

model UserPresence {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  status          PresenceStatus
  customStatus    String?
  lastSeenAt      DateTime @default(now())
  socketId        String?

  @@index([status])
}

enum PresenceStatus {
  ONLINE
  AWAY
  BUSY
  OFFLINE
}
```

### 2. Socket.io Gateway

```typescript
// apps/api/src/gateways/events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@forge/prisma';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const { userId, tenantId } = payload;

      // Join tenant room
      client.join(`tenant:${tenantId}`);
      client.join(`user:${userId}`);

      // Update presence
      await this.prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'ONLINE',
          socketId: client.id,
        },
        update: {
          status: 'ONLINE',
          socketId: client.id,
          lastSeenAt: new Date(),
        },
      });

      // Broadcast presence to tenant
      this.emitToTenant(tenantId, 'user:online', { userId });

      console.log(`Client connected: ${client.id}`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // Find user by socket ID
    const presence = await this.prisma.userPresence.findFirst({
      where: { socketId: client.id },
      include: { user: { include: { memberships: true } } },
    });

    if (presence) {
      // Update presence
      await this.prisma.userPresence.update({
        where: { id: presence.id },
        data: {
          status: 'OFFLINE',
          lastSeenAt: new Date(),
          socketId: null,
        },
      });

      // Broadcast offline to all user's tenants
      for (const membership of presence.user.memberships) {
        this.emitToTenant(membership.organization.tenantId, 'user:offline', {
          userId: presence.userId,
        });
      }
    }

    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: PresenceStatus; customStatus?: string },
  ) {
    const presence = await this.prisma.userPresence.findFirst({
      where: { socketId: client.id },
      include: { user: { include: { memberships: true } } },
    });

    if (presence) {
      await this.prisma.userPresence.update({
        where: { id: presence.id },
        data: {
          status: data.status,
          customStatus: data.customStatus,
        },
      });

      // Broadcast to all user's tenants
      for (const membership of presence.user.memberships) {
        this.emitToTenant(
          membership.organization.tenantId,
          'presence:updated',
          {
            userId: presence.userId,
            status: data.status,
            customStatus: data.customStatus,
          }
        );
      }
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { resourceType: string; resourceId: string },
  ) {
    client.broadcast
      .to(`${data.resourceType}:${data.resourceId}`)
      .emit('typing:user-started', {
        userId: client.data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
      });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { resourceType: string; resourceId: string },
  ) {
    client.broadcast
      .to(`${data.resourceType}:${data.resourceId}`)
      .emit('typing:user-stopped', {
        userId: client.data.userId,
      });
  }

  // Helper methods for emitting events
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToResource(resourceType: string, resourceId: string, event: string, data: any) {
    this.server.to(`${resourceType}:${resourceId}`).emit(event, data);
  }
}
```

### 3. Notification Service

```typescript
// apps/api/src/modules/notifications/notification.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@forge/prisma';
import { EventsGateway } from '@/gateways/events.gateway';
import { EmailService } from '@/services/email.service';
import { WebPushService } from '@/services/web-push.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly emailService: EmailService,
    private readonly webPushService: WebPushService,
  ) {}

  async create(params: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actorId?: string;
    relatedType?: string;
    relatedId?: string;
    metadata?: any;
  }) {
    const {
      tenantId,
      userId,
      type,
      title,
      message,
      actorId,
      relatedType,
      relatedId,
      metadata,
    } = params;

    // Get user preferences
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    // Check if notification should be sent based on preferences
    if (!this.shouldSendNotification(type, preferences)) {
      return null;
    }

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title,
        message,
        actorId,
        relatedType,
        relatedId,
        metadata,
        deliveredVia: [],
      },
    });

    // Deliver via enabled channels
    const deliveredVia: string[] = [];

    // WebSocket (real-time)
    if (preferences?.enableWebSocket !== false) {
      this.eventsGateway.emitToUser(userId, 'notification:new', notification);
      deliveredVia.push('websocket');
    }

    // Web Push
    if (preferences?.enableWebPush !== false) {
      await this.webPushService.send(userId, {
        title,
        body: message,
        icon: '/icon.png',
        data: { notificationId: notification.id, url: notification.actionUrl },
      });
      deliveredVia.push('push');
    }

    // Email (if not online or email preferred)
    if (preferences?.enableEmail !== false) {
      const isOnline = await this.isUserOnline(userId);
      if (!isOnline) {
        await this.emailService.sendNotificationEmail(userId, {
          subject: title,
          message,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
        });
        deliveredVia.push('email');
      }
    }

    // Update notification with delivery channels
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { deliveredVia },
    });

    return notification;
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emit event for real-time UI update
    this.eventsGateway.emitToUser(userId, 'notification:read', {
      notificationId,
    });

    return notification;
  }

  async markAllAsRead(userId: string, tenantId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emit event
    this.eventsGateway.emitToUser(userId, 'notification:all-read', {});
  }

  async getUnreadCount(userId: string, tenantId: string) {
    return this.prisma.notification.count({
      where: { userId, tenantId, isRead: false },
    });
  }

  private shouldSendNotification(
    type: NotificationType,
    preferences: any,
  ): boolean {
    if (!preferences) return true;

    // Check type-specific preferences
    const typePreferences = preferences.preferences?.[type];
    if (typePreferences !== undefined) {
      return typePreferences;
    }

    // Check quiet hours
    if (preferences.quietHoursStart && preferences.quietHoursEnd) {
      const now = new Date();
      const isQuietHours = this.isInQuietHours(
        now,
        preferences.quietHoursStart,
        preferences.quietHoursEnd,
        preferences.quietHoursTimezone,
      );

      if (isQuietHours) {
        return false;
      }
    }

    return true;
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    const presence = await this.prisma.userPresence.findUnique({
      where: { userId },
    });

    return presence?.status === 'ONLINE';
  }

  private isInQuietHours(
    date: Date,
    startTime: string,
    endTime: string,
    timezone: string,
  ): boolean {
    // Implementation for quiet hours check
    // TODO: Implement proper timezone-aware time comparison
    return false;
  }
}
```

### 4. Frontend Socket Client

```typescript
// lib/socket.ts
'use client';

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './auth';

let socket: Socket | null = null;

export function initializeSocket() {
  if (socket?.connected) return socket;

  const token = getAuthToken();

  socket = io(process.env.NEXT_PUBLIC_WS_URL + '/events', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
```

### 5. Notification Center UI

```tsx
// apps/portal/components/notifications/notification-center.tsx
'use client';

import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { initializeSocket } from '@/lib/socket';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './notification-item';
import { Badge } from '@/components/ui/badge';

export function NotificationCenter() {
  const { data: notifications = [], refetch } = useNotifications();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const socket = initializeSocket();

    // Listen for new notifications
    socket.on('notification:new', (notification) => {
      refetch();
      setUnreadCount((prev) => prev + 1);

      // Show toast
      toast({
        title: notification.title,
        description: notification.message,
      });
    });

    socket.on('notification:read', () => {
      refetch();
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    socket.on('notification:all-read', () => {
      refetch();
      setUnreadCount(0);
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:read');
      socket.off('notification:all-read');
    };
  }, [refetch]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

## Notification Types

### Task Notifications
- Task assigned to you
- Task completed
- Comment on your task
- Task due soon
- Task overdue

### Workflow Notifications
- Workflow completed
- Workflow failed
- Approval request
- Workflow assigned

### Agent Notifications
- Agent execution completed
- Agent execution failed
- Agent needs input

### Team Notifications
- Mentioned in comment
- Team invitation
- Team member joined
- Role changed

### System Notifications
- System maintenance
- Feature announcements
- Billing alerts
- Security alerts

## Features

### Real-time Updates
- WebSocket for instant delivery
- Automatic reconnection
- Optimistic UI updates

### Notification Preferences
- Per-type preferences
- Channel preferences (socket, push, email)
- Quiet hours
- Frequency settings

### Presence Tracking
- Online/Away/Busy/Offline
- Custom status messages
- Last seen timestamps

### Typing Indicators
- Show when others are typing
- Resource-specific (task, comment, etc.)

## Consequences

### Positive
- **Real-time**: Instant updates for collaboration
- **Flexible**: Multiple delivery channels
- **Customizable**: User preferences
- **Reliable**: Fallback to email

### Negative
- **Complexity**: Multiple channels to manage
- **Resource Usage**: WebSocket connections
- **Notification Fatigue**: Risk of too many notifications

### Mitigations
- **Smart Defaults**: Reasonable default preferences
- **Batching**: Batch similar notifications
- **Rate Limiting**: Prevent notification spam

## Alternatives Considered

### 1. Polling
**Rejected**: High server load, not real-time.

### 2. Server-Sent Events (SSE)
**Rejected**: One-way only, no bidirectional communication.

### 3. WebSockets (native)
**Rejected**: Socket.io provides better abstractions and fallbacks.

### 4. Third-party (Pusher, Ably)
**Rejected**: Cost, data privacy, less control.

## References
- [Socket.io Documentation](https://socket.io/docs/)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification Best Practices](https://web.dev/push-notifications-overview/)

## Review Date
2024-05-16 (3 months)
