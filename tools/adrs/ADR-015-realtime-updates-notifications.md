# ADR-015: Real-Time Updates & Notification System

## Status
Accepted

## Context

Forge Factory requires real-time updates for:
- **Analysis Progress**: Live progress bars (0-100%) for running analyses
- **Refactoring Jobs**: Status updates (queued → running → completed)
- **Notifications**: In-app alerts (PRs created, mentions, system alerts)
- **Collaboration**: Real-time presence (who's viewing a repository)
- **System Events**: Webhooks, integrations, background jobs

### Requirements
- **Latency**: < 500ms from server event to UI update
- **Scale**: 100K concurrent users, 10M events/day
- **Reliability**: 99.9% delivery rate
- **Browser Support**: Modern browsers + fallback for old ones

## Decision

We will use a **hybrid real-time architecture**:

### 1. **WebSockets (Socket.IO)** for bidirectional real-time communication
### 2. **Server-Sent Events (SSE)** for one-way event streams (fallback)
### 3. **Push Notifications (Web Push API)** for background notifications
### 4. **Polling** as final fallback for legacy browsers

## Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│                Real-Time System Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Client (Browser)                                            │
│  ┌──────────────────────────────────────────────┐           │
│  │ Socket.IO Client (Primary)                   │           │
│  │  - Analysis progress updates                 │           │
│  │  - Refactoring job status                    │           │
│  │  - Notifications                              │           │
│  │  - Presence (who's online)                   │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  WebSocket Connection (wss://)                               │
│           │                                                   │
│           ▼                                                   │
│  Backend (Socket.IO Server)                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Rooms (Tenant Isolation)                     │           │
│  │  - tenant:org_123                             │           │
│  │  - repository:repo_456                        │           │
│  │  - user:user_789                              │           │
│  └──────────────────────────────────────────────┘           │
│           │                                                   │
│           ▼                                                   │
│  Redis Pub/Sub (Multi-Server Coordination)                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Channels:                                     │           │
│  │  - analysis:completed                         │           │
│  │  - refactoring:pr_created                     │           │
│  │  - notification:user_mentioned                │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

**Backend (Socket.IO Server)**:
```typescript
// apps/api/src/realtime/socket-server.ts
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { verifyJWT } from '@packages/auth'

export function setupRealtimeServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL },
    transports: ['websocket', 'polling'], // WebSocket first, polling fallback
  })

  // Redis adapter for horizontal scaling
  const pubClient = createRedisClient()
  const subClient = pubClient.duplicate()
  io.adapter(createAdapter(pubClient, subClient))

  // Authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    const user = await verifyJWT(token)
    if (!user) return next(new Error('Unauthorized'))

    socket.data.user = user
    next()
  })

  // Connection
  io.on('connection', (socket) => {
    const { user } = socket.data

    // Join tenant room (for tenant-scoped events)
    socket.join(`tenant:${user.tenantId}`)

    // Join user room (for user-specific notifications)
    socket.join(`user:${user.id}`)

    // Subscribe to repository
    socket.on('subscribe:repository', (repoId: string) => {
      // Verify user has access to repository
      if (canAccessRepository(user, repoId)) {
        socket.join(`repository:${repoId}`)
      }
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${user.id} disconnected`)
    })
  })

  return io
}

// Emit events from anywhere in the app
export function emitAnalysisProgress(analysisId: string, progress: number) {
  io.to(`analysis:${analysisId}`).emit('analysis:progress', {
    analysisId,
    progress,
  })
}

export function emitNotification(userId: string, notification: Notification) {
  io.to(`user:${userId}`).emit('notification', notification)
}
```

**Frontend (React Hook)**:
```typescript
// packages/hooks/src/use-realtime.ts
'use client'

import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@packages/store'

let socket: Socket | null = null

export function useRealtime() {
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return

    // Connect once globally
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_API_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
      })

      socket.on('connect', () => console.log('WebSocket connected'))
      socket.on('disconnect', () => console.log('WebSocket disconnected'))
    }

    return () => {
      // Don't disconnect on unmount (keep connection alive)
    }
  }, [token])

  return socket
}

// Subscribe to analysis progress
export function useAnalysisProgress(analysisId: string) {
  const socket = useRealtime()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!socket) return

    socket.emit('subscribe:analysis', analysisId)

    socket.on('analysis:progress', (data) => {
      if (data.analysisId === analysisId) {
        setProgress(data.progress)
      }
    })

    return () => {
      socket.off('analysis:progress')
      socket.emit('unsubscribe:analysis', analysisId)
    }
  }, [socket, analysisId])

  return progress
}

// Usage
function AnalysisProgressBar({ analysisId }: { analysisId: string }) {
  const progress = useAnalysisProgress(analysisId)

  return (
    <div>
      <ProgressBar value={progress} />
      <p>{progress}% complete</p>
    </div>
  )
}
```

### Notification System

**In-App Notifications**:
```typescript
// apps/portal/components/notification-center.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRealtime } from '@packages/hooks'
import { Bell } from 'lucide-react'

export function NotificationCenter() {
  const socket = useRealtime()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!socket) return

    socket.on('notification', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)

      // Show toast
      toast(notification.title, {
        description: notification.message,
        action: notification.actionUrl ? (
          <Button onClick={() => router.push(notification.actionUrl)}>
            View
          </Button>
        ) : undefined,
      })
    })

    return () => {
      socket.off('notification')
    }
  }, [socket])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Notifications</h3>
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        </div>
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

## Consequences

### Positive
- **Real-Time**: Sub-500ms latency for live updates
- **Scalable**: Redis Pub/Sub enables horizontal scaling
- **Reliable**: Automatic reconnection, fallback to polling
- **User Experience**: Instant feedback (progress bars, notifications)

### Negative
- **Complexity**: WebSocket server maintenance
- **Cost**: Redis hosting for Pub/Sub
- **Battery**: WebSocket connections drain mobile battery

### Mitigations
- Monitor WebSocket connection health (Datadog)
- Use connection pooling (max 100K concurrent connections per server)
- Implement exponential backoff for reconnection

## References
- [Socket.IO Documentation](https://socket.io/docs/)
- ADR-011: State Management (Zustand for local notification state)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
