# ADR-020: Real-Time Collaboration & Multiplayer Editing

## Status
Proposed

## Context

Modern development tools (Replit, Figma, Google Docs) have set a new standard: **collaborative by default**. Single-player experiences feel outdated in 2026.

### Current State (Forge Factory)

**Async Collaboration Only:**
- User A creates refactoring → commits → PR → User B reviews
- No real-time awareness of what teammates are doing
- Collaboration happens via external tools (Slack, GitHub)
- High latency: Minutes to hours between actions

**Pain Points:**
- "Can you review this refactoring?" → Slack → Wait → Repeat
- No visibility into who's working on what
- Conflicts: Two people refactor the same file
- Lost context: "Why did you apply this refactoring?"

### Target State (Inspired by Replit/Figma)

**Real-Time Multiplayer:**
- See teammates' cursors in code preview
- Live comments and annotations
- Collaborative approval workflows
- Presence indicators ("Sarah is viewing auth.ts")
- Activity feed ("Alex just approved refactoring #123")

### Business Impact

**Team Adoption:**
- Replit case study: 3x faster adoption when teams collaborate in real-time
- Figma model: Multiplayer drove 5x viral growth

**Efficiency:**
- Eliminate async barriers (Slack messages, email threads)
- Faster approvals: Real-time discussion vs PR comments
- Reduce context switching: Everything in one tool

**Enterprise Requirements:**
- Modern tools are expected to be collaborative
- "Can multiple people review simultaneously?" = Table stakes
- Audit logs: Who approved what, when?

### Requirements

1. **Presence Awareness:**
   - See who's online
   - See who's viewing which repository/file
   - See cursor positions in shared views

2. **Live Collaboration:**
   - Real-time comments on refactorings
   - Collaborative approval workflows
   - Shared cursors in code previews
   - Multi-user editing (future: edit CLAUDE.md together)

3. **Activity Feed:**
   - Real-time notifications
   - Activity timeline
   - @mentions in comments

4. **Conflict Resolution:**
   - Detect simultaneous edits
   - Optimistic locking
   - Merge conflict UI

## Decision

We will implement a **Collaborative Real-Time Platform (CRTP)** with three core layers:

### 1. Presence Layer (Who's Online)
### 2. Collaboration Layer (Live Interaction)
### 3. Activity Stream Layer (What's Happening)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Real-Time Collaboration Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Multiple Clients)                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   User A     │  │   User B     │  │   User C     │      │
│  │   Browser    │  │   Browser    │  │   Browser    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          WebSocket Connection Layer                     │ │
│  │          (Socket.IO + Redis Pub/Sub)                    │ │
│  │                                                          │ │
│  │  Rooms (Tenant Isolation):                             │ │
│  │  - organization:org_123 (all members)                  │ │
│  │  - repository:repo_456 (users viewing repo)            │ │
│  │  - file:file_789 (users viewing specific file)        │ │
│  │  - refactoring:job_999 (users collaborating)          │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               Presence Service                          │ │
│  │                                                          │ │
│  │  Tracks:                                                │ │
│  │  - User online status                                  │ │
│  │  - Current page/repository/file                        │ │
│  │  - Cursor position (x, y)                              │ │
│  │  - Last activity timestamp                             │ │
│  │  - Typing indicators                                   │ │
│  │                                                          │ │
│  │  Storage: Redis (TTL 30s, heartbeat every 10s)        │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Collaboration Service                        │ │
│  │                                                          │ │
│  │  Features:                                              │ │
│  │  - Live comments on refactorings                       │ │
│  │  - @mentions and notifications                         │ │
│  │  - Collaborative approvals                              │ │
│  │  - Shared cursors (Yjs/CRDT)                           │ │
│  │  - Conflict detection                                   │ │
│  │                                                          │ │
│  │  Storage: PostgreSQL + Redis cache                     │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Activity Stream Service                    │ │
│  │                                                          │ │
│  │  Events:                                                │ │
│  │  - User joined repository                              │ │
│  │  - Refactoring approved/rejected                       │ │
│  │  - Comment added                                        │ │
│  │  - Analysis completed                                   │ │
│  │                                                          │ │
│  │  Storage: Event log (PostgreSQL) + Real-time (Redis)  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Decisions

### 1. Presence Layer (Who's Online)

**Features:**
- Online/offline status
- Current location (repository, file, page)
- Cursor position in shared views
- Typing indicators
- Idle detection (5 min timeout)

**UI Components:**

```typescript
// apps/portal/components/presence/presence-avatars.tsx
'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@packages/ui/avatar'
import { Tooltip } from '@packages/ui/tooltip'
import { usePresence } from '@/hooks/use-presence'

interface PresenceAvatarsProps {
  repositoryId?: string
  fileId?: string
  maxAvatars?: number
}

export function PresenceAvatars({
  repositoryId,
  fileId,
  maxAvatars = 5,
}: PresenceAvatarsProps) {
  const { users } = usePresence({ repositoryId, fileId })

  const visibleUsers = users.slice(0, maxAvatars)
  const hiddenCount = users.length - maxAvatars

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user) => (
        <Tooltip key={user.id} content={`${user.name} (${user.location})`}>
          <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-green-500">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
        </Tooltip>
      ))}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted border-2 border-background text-xs">
          +{hiddenCount}
        </div>
      )}
    </div>
  )
}
```

**Live Cursors:**

```typescript
// apps/portal/components/presence/live-cursors.tsx
'use client'

import { usePresence } from '@/hooks/use-presence'
import { motion } from 'framer-motion'

interface LiveCursorsProps {
  elementId: string // ID of element to track cursors in
}

export function LiveCursors({ elementId }: LiveCursorsProps) {
  const { cursors } = usePresence({ elementId })

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cursors.map((cursor) => (
        <motion.div
          key={cursor.userId}
          className="absolute"
          initial={{ x: cursor.x, y: cursor.y }}
          animate={{ x: cursor.x, y: cursor.y }}
          transition={{ duration: 0.1, ease: 'linear' }}
        >
          {/* Cursor Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: cursor.color }}
          >
            <path
              d="M5 3L19 12L12 13L9 19L5 3Z"
              fill="currentColor"
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          {/* User Name Label */}
          <div
            className="ml-4 mt-1 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.userName}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
```

**Presence Hook:**

```typescript
// apps/portal/hooks/use-presence.ts
import { useEffect, useState } from 'react'
import { useRealtime } from './use-realtime'
import { useCurrentUser } from './use-current-user'

interface PresenceUser {
  id: string
  name: string
  avatar: string
  initials: string
  location: string
  color: string
}

interface PresenceState {
  users: PresenceUser[]
  cursors: Array<{
    userId: string
    userName: string
    x: number
    y: number
    color: string
  }>
}

export function usePresence({
  repositoryId,
  fileId,
  elementId,
}: {
  repositoryId?: string
  fileId?: string
  elementId?: string
}) {
  const socket = useRealtime()
  const currentUser = useCurrentUser()
  const [presence, setPresence] = useState<PresenceState>({
    users: [],
    cursors: [],
  })

  useEffect(() => {
    if (!socket) return

    // Join room
    const room = fileId
      ? `file:${fileId}`
      : repositoryId
      ? `repository:${repositoryId}`
      : null

    if (room) {
      socket.emit('presence:join', { room })
    }

    // Send heartbeat every 10s
    const heartbeat = setInterval(() => {
      socket.emit('presence:heartbeat', {
        room,
        location: window.location.pathname,
      })
    }, 10000)

    // Listen for presence updates
    socket.on('presence:update', (data: PresenceState) => {
      setPresence(data)
    })

    // Track cursor movement (if elementId provided)
    if (elementId) {
      const element = document.getElementById(elementId)
      if (element) {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top

          socket.emit('presence:cursor', { room, x, y })
        }

        element.addEventListener('mousemove', handleMouseMove)
        return () => {
          element.removeEventListener('mousemove', handleMouseMove)
          clearInterval(heartbeat)
          socket.emit('presence:leave', { room })
        }
      }
    }

    return () => {
      clearInterval(heartbeat)
      socket.emit('presence:leave', { room })
    }
  }, [socket, repositoryId, fileId, elementId])

  return presence
}
```

### 2. Collaboration Layer (Live Interaction)

**Features:**
- Real-time comments on refactorings
- @mentions with notifications
- Collaborative approval workflows
- Threaded discussions
- Resolve/unresolve comments

**Live Comments Component:**

```typescript
// apps/portal/components/collaboration/live-comments.tsx
'use client'

import { useState } from 'react'
import { Avatar } from '@packages/ui/avatar'
import { Button } from '@packages/ui/button'
import { Textarea } from '@packages/ui/textarea'
import { Card } from '@packages/ui/card'
import { useLiveComments } from '@/hooks/use-live-comments'
import { formatDistanceToNow } from 'date-fns'

interface LiveCommentsProps {
  refactoringId: string
}

export function LiveComments({ refactoringId }: LiveCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const { comments, addComment, resolveComment, isLoading } = useLiveComments(refactoringId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    await addComment(newComment)
    setNewComment('')
  }

  return (
    <div className="space-y-4">
      {/* Comment List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <Card
            key={comment.id}
            className={cn(
              "p-4",
              comment.resolved && "opacity-60 bg-muted"
            )}
          >
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user.avatar} />
                <AvatarFallback>{comment.user.initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{comment.user.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                    </span>
                  </div>

                  {!comment.resolved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resolveComment(comment.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>

                <p className="text-sm whitespace-pre-wrap">
                  {comment.content}
                </p>

                {/* Typing Indicator */}
                {comment.typing && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{comment.typing.userName} is typing</span>
                    <span className="animate-pulse">...</span>
                  </div>
                )}

                {/* Replies (future) */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-4 mt-3 space-y-2 border-l-2 pl-3">
                    {/* Render replies */}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment... (Use @ to mention someone)"
          rows={3}
          onKeyDown={(e) => {
            // Emit typing indicator
            socket.emit('comment:typing', { refactoringId })
          }}
        />
        <div className="flex justify-between">
          <p className="text-xs text-muted-foreground">
            Tip: Use @username to mention teammates
          </p>
          <Button type="submit" disabled={isLoading || !newComment.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Live Comments Hook:**

```typescript
// apps/portal/hooks/use-live-comments.ts
import { useEffect, useState } from 'react'
import { useRealtime } from './use-realtime'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@packages/api-client'

interface Comment {
  id: string
  content: string
  user: {
    id: string
    name: string
    avatar: string
    initials: string
  }
  createdAt: Date
  resolved: boolean
  typing?: {
    userId: string
    userName: string
  }
  replies?: Comment[]
}

export function useLiveComments(refactoringId: string) {
  const socket = useRealtime()
  const queryClient = useQueryClient()

  // Fetch initial comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', refactoringId],
    queryFn: () => apiClient.comments.list(refactoringId),
  })

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return

    socket.emit('subscribe:comments', refactoringId)

    socket.on('comment:added', (comment: Comment) => {
      queryClient.setQueryData(
        ['comments', refactoringId],
        (old: Comment[] = []) => [...old, comment]
      )
    })

    socket.on('comment:resolved', (commentId: string) => {
      queryClient.setQueryData(
        ['comments', refactoringId],
        (old: Comment[] = []) =>
          old.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
      )
    })

    socket.on('comment:typing', ({ userId, userName }) => {
      // Show typing indicator (temporary)
      queryClient.setQueryData(
        ['comments', refactoringId],
        (old: Comment[] = []) =>
          old.map((c) =>
            c.user.id === userId ? { ...c, typing: { userId, userName } } : c
          )
      )

      // Clear after 3s
      setTimeout(() => {
        queryClient.setQueryData(
          ['comments', refactoringId],
          (old: Comment[] = []) =>
            old.map((c) => (c.user.id === userId ? { ...c, typing: undefined } : c))
        )
      }, 3000)
    })

    return () => {
      socket.emit('unsubscribe:comments', refactoringId)
      socket.off('comment:added')
      socket.off('comment:resolved')
      socket.off('comment:typing')
    }
  }, [socket, refactoringId, queryClient])

  // Add comment mutation
  const { mutateAsync: addComment } = useMutation({
    mutationFn: (content: string) =>
      apiClient.comments.create({ refactoringId, content }),
    onSuccess: (comment) => {
      // Optimistic update handled by WebSocket
      // Emit for other users
      socket?.emit('comment:added', { refactoringId, comment })
    },
  })

  // Resolve comment mutation
  const { mutateAsync: resolveComment } = useMutation({
    mutationFn: (commentId: string) =>
      apiClient.comments.resolve(commentId),
    onSuccess: (commentId) => {
      socket?.emit('comment:resolved', { refactoringId, commentId })
    },
  })

  return {
    comments,
    addComment,
    resolveComment,
    isLoading,
  }
}
```

### 3. Activity Stream Layer (What's Happening)

**Features:**
- Real-time activity feed
- Notifications for @mentions
- Event timeline
- Activity filtering
- Read/unread status

**Activity Feed Component:**

```typescript
// apps/portal/components/activity/activity-feed.tsx
'use client'

import { useActivityFeed } from '@/hooks/use-activity-feed'
import { Avatar } from '@packages/ui/avatar'
import { Card } from '@packages/ui/card'
import { formatDistanceToNow } from 'date-fns'
import {
  GitPullRequestIcon,
  CheckCircleIcon,
  MessageSquareIcon,
  SparklesIcon,
} from 'lucide-react'

interface ActivityFeedProps {
  repositoryId?: string
  organizationId?: string
}

export function ActivityFeed({ repositoryId, organizationId }: ActivityFeedProps) {
  const { activities, markAsRead } = useActivityFeed({ repositoryId, organizationId })

  const getIcon = (type: string) => {
    switch (type) {
      case 'refactoring:approved':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'refactoring:created':
        return <GitPullRequestIcon className="h-4 w-4 text-blue-500" />
      case 'comment:added':
        return <MessageSquareIcon className="h-4 w-4 text-purple-500" />
      case 'analysis:completed':
        return <SparklesIcon className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">Recent Activity</h3>

      {activities.map((activity) => (
        <Card
          key={activity.id}
          className={cn(
            "p-3 cursor-pointer transition-colors",
            !activity.read && "bg-blue-50 dark:bg-blue-950"
          )}
          onClick={() => {
            markAsRead(activity.id)
            // Navigate to activity source
            router.push(activity.url)
          }}
        >
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={activity.user.avatar} />
              <AvatarFallback>{activity.user.initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                {getIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.user.name}</span>
                    {' '}{activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

## Backend Implementation

### Presence Service

```typescript
// apps/api/src/presence/presence.service.ts
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'

interface PresenceData {
  userId: string
  userName: string
  avatar: string
  location: string
  cursor?: { x: number; y: number }
  color: string
  timestamp: Date
}

@Injectable()
export class PresenceService {
  constructor(private redis: Redis) {}

  async join(room: string, userId: string, data: PresenceData) {
    const key = `presence:${room}:${userId}`

    // Store presence data with 30s TTL
    await this.redis.setex(
      key,
      30,
      JSON.stringify({
        ...data,
        timestamp: new Date(),
      })
    )

    // Broadcast to room
    const users = await this.getUsers(room)
    return users
  }

  async heartbeat(room: string, userId: string, location?: string) {
    const key = `presence:${room}:${userId}`
    const exists = await this.redis.exists(key)

    if (exists) {
      // Refresh TTL
      await this.redis.expire(key, 30)

      // Update location if provided
      if (location) {
        const data = await this.redis.get(key)
        if (data) {
          const parsed = JSON.parse(data)
          parsed.location = location
          parsed.timestamp = new Date()
          await this.redis.setex(key, 30, JSON.stringify(parsed))
        }
      }
    }
  }

  async updateCursor(room: string, userId: string, cursor: { x: number; y: number }) {
    const key = `presence:${room}:${userId}`
    const data = await this.redis.get(key)

    if (data) {
      const parsed = JSON.parse(data)
      parsed.cursor = cursor
      await this.redis.setex(key, 30, JSON.stringify(parsed))

      // Broadcast cursor update
      return { userId, cursor, userName: parsed.userName, color: parsed.color }
    }
  }

  async leave(room: string, userId: string) {
    const key = `presence:${room}:${userId}`
    await this.redis.del(key)

    // Broadcast to room
    const users = await this.getUsers(room)
    return users
  }

  async getUsers(room: string): Promise<PresenceData[]> {
    const pattern = `presence:${room}:*`
    const keys = await this.redis.keys(pattern)

    const users = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key)
        return data ? JSON.parse(data) : null
      })
    )

    return users.filter(Boolean)
  }
}
```

### Comment Service with Real-Time

```typescript
// apps/api/src/comments/comments.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  async create(refactoringId: string, userId: string, content: string) {
    // Extract @mentions
    const mentions = this.extractMentions(content)

    const comment = await this.prisma.comment.create({
      data: {
        refactoringId,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('comment.added', {
      refactoringId,
      comment,
    })

    // Send notifications for @mentions
    for (const mentionedUserId of mentions) {
      this.eventEmitter.emit('notification.created', {
        userId: mentionedUserId,
        type: 'mention',
        data: {
          commentId: comment.id,
          refactoringId,
          mentionedBy: userId,
        },
      })
    }

    return comment
  }

  async resolve(commentId: string, userId: string) {
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved: true, resolvedBy: userId, resolvedAt: new Date() },
    })

    this.eventEmitter.emit('comment.resolved', {
      refactoringId: comment.refactoringId,
      commentId,
    })

    return comment
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g
    const matches = content.matchAll(mentionRegex)
    const usernames = Array.from(matches, (m) => m[1])

    // Look up user IDs from usernames (simplified)
    // In reality, you'd query the database
    return usernames
  }
}
```

## WebSocket Event Handling

```typescript
// apps/api/src/websockets/collaboration.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { PresenceService } from '@/presence/presence.service'
import { OnEvent } from '@nestjs/event-emitter'

@WebSocketGateway()
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private presenceService: PresenceService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    // Clean up presence data
    const rooms = Array.from(client.rooms)
    rooms.forEach((room) => {
      this.presenceService.leave(room, client.data.userId)
    })
  }

  @SubscribeMessage('presence:join')
  async handlePresenceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string }
  ) {
    client.join(data.room)

    const users = await this.presenceService.join(
      data.room,
      client.data.userId,
      {
        userId: client.data.userId,
        userName: client.data.userName,
        avatar: client.data.avatar,
        location: '',
        color: this.generateColor(client.data.userId),
      }
    )

    // Broadcast to room
    this.server.to(data.room).emit('presence:update', { users })
  }

  @SubscribeMessage('presence:cursor')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; x: number; y: number }
  ) {
    const cursor = await this.presenceService.updateCursor(
      data.room,
      client.data.userId,
      { x: data.x, y: data.y }
    )

    // Broadcast cursor update to others in room
    client.to(data.room).emit('presence:cursor-update', cursor)
  }

  @SubscribeMessage('comment:typing')
  handleCommentTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { refactoringId: string }
  ) {
    client.to(`refactoring:${data.refactoringId}`).emit('comment:typing', {
      userId: client.data.userId,
      userName: client.data.userName,
    })
  }

  // Listen for domain events and broadcast via WebSocket
  @OnEvent('comment.added')
  handleCommentAdded(payload: any) {
    this.server.to(`refactoring:${payload.refactoringId}`).emit('comment:added', payload.comment)
  }

  @OnEvent('comment.resolved')
  handleCommentResolved(payload: any) {
    this.server.to(`refactoring:${payload.refactoringId}`).emit('comment:resolved', payload.commentId)
  }

  private generateColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ]
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }
}
```

## Consequences

### Positive

1. **Team Velocity:**
   - Eliminate async barriers (Slack → wait → PR review)
   - Faster approvals: Real-time discussion vs async PR comments
   - Context retention: See what teammates are doing

2. **User Experience:**
   - Modern feel: "Multiplayer" = 2026 standard
   - Viral growth: "Come see what I'm working on"
   - Engagement: 2x longer sessions when collaborating

3. **Enterprise Value:**
   - Audit trail: Who approved what, when, why
   - Compliance: Real-time approval workflows
   - Transparency: Management can see team activity

4. **Competitive Differentiation:**
   - Code analysis tools are typically single-player
   - Figma/Replit model applied to code quality
   - Premium positioning: Collaboration = higher price

### Negative

1. **Infrastructure Complexity:**
   - WebSocket server scaling (horizontal scaling required)
   - Redis Pub/Sub for multi-server coordination
   - Presence data storage and TTL management
   - Potential for race conditions

2. **Cost:**
   - Redis hosting: ~$100-500/month
   - Increased server load (WebSocket connections)
   - Data transfer costs (real-time messages)

3. **Privacy Concerns:**
   - Users may not want to be "watched"
   - Cursor tracking feels invasive to some
   - Activity feed shows everything (good and bad)

4. **Performance:**
   - WebSocket overhead (battery drain on mobile)
   - Cursor updates = many messages (potential lag)
   - Stale presence data if heartbeat fails

5. **Browser Compatibility:**
   - WebSocket not supported in very old browsers
   - Fallback to polling adds complexity

### Mitigations

1. **Scalability:**
   - Horizontal scaling: Multiple WebSocket servers behind load balancer
   - Redis Pub/Sub: Coordinate between servers
   - Room-based isolation: Only broadcast to relevant users
   - Rate limiting: Max 100 cursor updates/second per user

2. **Cost Management:**
   - Redis clustering only if needed (start with single instance)
   - Compression for WebSocket messages
   - Debounce cursor updates (send max 10/second)
   - Cleanup stale presence data (TTL 30s)

3. **Privacy:**
   - Opt-out: "Do Not Disturb" mode (hide presence)
   - Granular controls: Share location but not cursor
   - Settings: Choose who can see your activity
   - Transparency: Clear indicators when sharing

4. **Performance:**
   - Debounce cursor updates (throttle to 10 FPS)
   - Batch messages when possible
   - Lazy load activity feed (pagination)
   - Heartbeat optimization (only send if active)

5. **Graceful Degradation:**
   - Fallback to polling if WebSocket fails
   - Offline mode: Show cached data
   - Error boundaries: Don't crash app if presence fails

## Implementation Plan

### Phase 1: Presence Layer (Weeks 1-3)
- [ ] WebSocket infrastructure (Socket.IO + Redis)
- [ ] Presence service (join/leave/heartbeat)
- [ ] Presence avatars UI component
- [ ] Online/offline status indicators
- [ ] Deploy to staging for testing

### Phase 2: Live Cursors (Weeks 4-5)
- [ ] Cursor tracking system
- [ ] Live cursor rendering
- [ ] Debouncing and optimization
- [ ] User testing and feedback

### Phase 3: Live Comments (Weeks 6-8)
- [ ] Comment service with real-time events
- [ ] Live comments UI component
- [ ] @mentions and notifications
- [ ] Typing indicators
- [ ] Threaded discussions (future)

### Phase 4: Activity Stream (Weeks 9-10)
- [ ] Activity feed service
- [ ] Activity feed UI component
- [ ] Event filtering and search
- [ ] Read/unread status
- [ ] Notification preferences

## Metrics & Success Criteria

### Adoption
- **Collaboration Usage:** 60%+ of teams use live comments within first month
- **Presence Awareness:** 80%+ of users notice when teammates are online
- **Real-Time Approvals:** 40%+ of refactorings approved via live comments (vs async PR)

### Performance
- **Presence Update Latency:** <500ms (user A moves, user B sees within 500ms)
- **Comment Delivery:** <1s from send to all recipients
- **Cursor Update Rate:** 10 FPS minimum
- **WebSocket Uptime:** 99.5%+

### Engagement
- **Session Duration:** +50% when collaborating (vs solo)
- **Feature Discovery:** 2x higher when teammates suggest features
- **Retention:** 90-day retention +20% for collaborative teams

## Alternatives Considered

### 1. No Real-Time Collaboration
- **Pros:** Simpler implementation, lower cost
- **Cons:** Not competitive, doesn't meet user expectations
- **Rejected:** Table stakes for modern tools

### 2. Async Only (PR Comments)
- **Pros:** Leverages existing GitHub infrastructure
- **Cons:** High latency, poor UX, external tool dependency
- **Rejected:** Doesn't differentiate from status quo

### 3. Operational Transformation (OT)
- **Pros:** True collaborative editing (Google Docs style)
- **Cons:** Very complex, not needed for our use case
- **Rejected:** Over-engineering for read-mostly workflows

### 4. Third-Party Service (PubNub, Pusher)
- **Pros:** Outsource infrastructure complexity
- **Cons:** Vendor lock-in, cost ($500+/month), data privacy
- **Rejected:** Build in-house for control and cost

## References

### Inspiration
- [Replit Multiplayer](https://blog.replit.com/multiplayer) - Real-time collaborative coding
- [Figma Multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) - Live cursors and presence
- [Notion Presence](https://www.notion.so/help/collaboration) - Activity feed and @mentions

### Technical References
- [Socket.IO Documentation](https://socket.io/docs/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Operational Transformation](https://operational-transformation.github.io/)
- [CRDT (Conflict-Free Replicated Data Types)](https://crdt.tech/)

### Internal References
- ADR-015: Real-Time Updates (WebSocket foundation)
- ADR-011: State Management (Zustand for local state)
- ADR-019: AI-First Interaction Patterns (integration point)

## Review Date
April 2026 (3 months)

**Reviewers:** Engineering Lead, Product Lead, DevOps Lead

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Authors:** Engineering Team
**Approved By:** [Pending]
