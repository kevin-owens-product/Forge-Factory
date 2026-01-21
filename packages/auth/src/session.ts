/**
 * @package @forge/auth
 * @description Session management utilities
 */

import {
  Session,
  SessionConfig,
  DeviceInfo,
  DEFAULT_AUTH_CONFIG,
} from './auth.types';

/**
 * Session storage interface for dependency injection
 */
export interface SessionStorage {
  get(sessionId: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  getByUserId(userId: string, tenantId: string): Promise<Session[]>;
  deleteByUserId(userId: string, tenantId: string): Promise<void>;
}

/**
 * In-memory session storage (for development/testing)
 */
export class InMemorySessionStorage implements SessionStorage {
  private sessions: Map<string, Session> = new Map();

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async getByUserId(userId: string, tenantId: string): Promise<Session[]> {
    const userSessions: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.tenantId === tenantId) {
        userSessions.push(session);
      }
    }
    return userSessions;
  }

  async deleteByUserId(userId: string, tenantId: string): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId && session.tenantId === tenantId) {
        this.sessions.delete(id);
      }
    }
  }

  /** Clear all sessions (for testing) */
  clear(): void {
    this.sessions.clear();
  }

  /** Get session count (for testing) */
  size(): number {
    return this.sessions.size;
  }
}

/**
 * Session service class
 */
export class SessionService {
  private config: SessionConfig;
  private storage: SessionStorage;

  constructor(
    storage: SessionStorage,
    config: Partial<SessionConfig> = {}
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_AUTH_CONFIG.session, ...config };
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    tenantId: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: DeviceInfo;
      metadata?: Record<string, unknown>;
      extendedDuration?: boolean;
    } = {}
  ): Promise<Session> {
    // Check max concurrent sessions
    if (this.config.maxConcurrentSessions > 0) {
      const existingSessions = await this.storage.getByUserId(userId, tenantId);
      const activeSessions = existingSessions.filter((s) => this.isSessionActive(s));

      if (activeSessions.length >= this.config.maxConcurrentSessions) {
        // Invalidate oldest session
        const oldestSession = activeSessions.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )[0];
        await this.invalidateSession(oldestSession.id);
      }
    }

    const now = new Date();
    const duration = options.extendedDuration
      ? this.config.durationSeconds * 7 // Extended (remember me)
      : this.config.durationSeconds;

    const session: Session = {
      id: this.generateSessionId(),
      userId,
      tenantId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + duration * 1000),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      deviceInfo: options.deviceInfo,
      isActive: true,
      metadata: options.metadata,
    };

    await this.storage.set(session);
    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.storage.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if expired
    if (!this.isSessionActive(session)) {
      await this.invalidateSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Validate a session
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean;
    session?: Session;
    error?: string;
  }> {
    const session = await this.storage.get(sessionId);

    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    if (!session.isActive) {
      return { valid: false, error: 'Session is inactive' };
    }

    if (new Date() > session.expiresAt) {
      await this.invalidateSession(sessionId);
      return { valid: false, error: 'Session has expired' };
    }

    return { valid: true, session };
  }

  /**
   * Refresh/touch a session (update activity and optionally extend)
   */
  async refreshSession(
    sessionId: string,
    options: { ipAddress?: string } = {}
  ): Promise<Session | null> {
    const session = await this.storage.get(sessionId);
    if (!session || !this.isSessionActive(session)) {
      return null;
    }

    const now = new Date();
    session.lastActivityAt = now;

    // Update IP if changed
    if (options.ipAddress && options.ipAddress !== session.ipAddress) {
      session.ipAddress = options.ipAddress;
    }

    // Sliding session: extend expiry on activity
    if (this.config.slidingSession) {
      session.expiresAt = new Date(now.getTime() + this.config.durationSeconds * 1000);
    }

    await this.storage.set(session);
    return session;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string): Promise<boolean> {
    const session = await this.storage.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;
    await this.storage.set(session);
    return true;
  }

  /**
   * Delete a session permanently
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.storage.get(sessionId);
    if (!session) {
      return false;
    }

    await this.storage.delete(sessionId);
    return true;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, tenantId: string): Promise<Session[]> {
    const sessions = await this.storage.getByUserId(userId, tenantId);
    return sessions.filter((s) => this.isSessionActive(s));
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateUserSessions(
    userId: string,
    tenantId: string,
    options: { exceptSessionId?: string } = {}
  ): Promise<number> {
    const sessions = await this.storage.getByUserId(userId, tenantId);
    let count = 0;

    for (const session of sessions) {
      if (options.exceptSessionId && session.id === options.exceptSessionId) {
        continue;
      }
      if (session.isActive) {
        session.isActive = false;
        await this.storage.set(session);
        count++;
      }
    }

    return count;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string, tenantId: string): Promise<number> {
    const sessions = await this.storage.getByUserId(userId, tenantId);
    await this.storage.deleteByUserId(userId, tenantId);
    return sessions.length;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(
    userId: string,
    tenantId: string
  ): Promise<{
    totalSessions: number;
    activeSessions: number;
    devices: string[];
    lastActivity: Date | null;
  }> {
    const sessions = await this.storage.getByUserId(userId, tenantId);
    const activeSessions = sessions.filter((s) => this.isSessionActive(s));

    const devices = new Set<string>();
    let lastActivity: Date | null = null;

    for (const session of activeSessions) {
      if (session.deviceInfo?.type) {
        devices.add(session.deviceInfo.type);
      }
      if (!lastActivity || session.lastActivityAt > lastActivity) {
        lastActivity = session.lastActivityAt;
      }
    }

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      devices: Array.from(devices),
      lastActivity,
    };
  }

  /**
   * Check if session is active (not expired and active flag set)
   */
  isSessionActive(session: Session): boolean {
    return session.isActive && new Date() < session.expiresAt;
  }

  /**
   * Get time until session expires (in seconds)
   */
  getSessionTtl(session: Session): number {
    const remaining = session.expiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Parse user agent to extract device info
   */
  parseUserAgent(userAgent: string): DeviceInfo {
    const ua = userAgent.toLowerCase();
    let type: DeviceInfo['type'] = 'unknown';
    let os: string | undefined;
    let browser: string | undefined;

    // Detect device type
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      if (/ipad|tablet/i.test(ua)) {
        type = 'tablet';
      } else {
        type = 'mobile';
      }
    } else {
      type = 'desktop';
    }

    // Detect OS (order matters - iOS before macOS due to "like Mac OS X" in iOS UA)
    if (/windows/i.test(ua)) {
      os = 'Windows';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      os = 'iOS';
    } else if (/android/i.test(ua)) {
      os = 'Android';
    } else if (/macintosh|mac os x/i.test(ua)) {
      os = 'macOS';
    } else if (/linux/i.test(ua)) {
      os = 'Linux';
    }

    // Detect browser
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(ua)) {
      browser = 'Firefox';
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      browser = 'Safari';
    } else if (/edg/i.test(ua)) {
      browser = 'Edge';
    } else if (/msie|trident/i.test(ua)) {
      browser = 'Internet Explorer';
    }

    return { type, os, browser };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = this.generateRandomString(16);
    return `ses_${timestamp}_${randomPart}`;
  }

  /**
   * Generate random string for session IDs
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get configuration
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Set storage (for testing)
   */
  setStorage(storage: SessionStorage): void {
    this.storage = storage;
  }
}

/**
 * Cookie options for session cookie
 */
export interface SessionCookieOptions {
  name: string;
  value: string;
  maxAge: number;
  path: string;
  domain?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

/**
 * Generate session cookie options
 */
export function getSessionCookieOptions(
  sessionId: string,
  config: SessionConfig,
  domain?: string
): SessionCookieOptions {
  return {
    name: config.cookieName,
    value: sessionId,
    maxAge: config.durationSeconds,
    path: '/',
    domain,
    secure: config.secureCookie,
    httpOnly: config.httpOnlyCookie,
    sameSite: config.sameSite,
  };
}

/**
 * Generate session clear cookie options (for logout)
 */
export function getClearSessionCookieOptions(
  config: SessionConfig,
  domain?: string
): SessionCookieOptions {
  return {
    name: config.cookieName,
    value: '',
    maxAge: 0,
    path: '/',
    domain,
    secure: config.secureCookie,
    httpOnly: config.httpOnlyCookie,
    sameSite: config.sameSite,
  };
}

// Singleton instance
let sessionServiceInstance: SessionService | null = null;
let defaultStorage: InMemorySessionStorage | null = null;

/**
 * Get the singleton session service instance
 */
export function getSessionService(
  storage?: SessionStorage,
  config?: Partial<SessionConfig>
): SessionService {
  if (!sessionServiceInstance) {
    if (!storage) {
      defaultStorage = new InMemorySessionStorage();
      storage = defaultStorage;
    }
    sessionServiceInstance = new SessionService(storage, config);
  }
  return sessionServiceInstance;
}

/**
 * Reset the singleton session service instance (for testing)
 */
export function resetSessionService(): void {
  sessionServiceInstance = null;
  defaultStorage?.clear();
  defaultStorage = null;
}
