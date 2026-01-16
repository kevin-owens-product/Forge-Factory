/**
 * @package @forge/prisma
 * @description Prisma database client and utilities
 */

import { PrismaClient } from './generated/client';
import type { Prisma } from './generated/client';

// Re-export Prisma types
export type { Prisma };
export * from './generated/client';

// Singleton Prisma client
let prisma: PrismaClient;

/**
 * Get the Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }
  return prisma;
}

/**
 * Disconnect Prisma client
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

// Export singleton
export const db = getPrismaClient();

/**
 * Tenant-isolated query wrapper
 * Ensures all queries include tenantId filter
 */
export function createTenantClient(tenantId: string) {
  return {
    user: {
      findMany: (args?: Prisma.UserFindManyArgs) =>
        db.user.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
      findUnique: (args: Prisma.UserFindUniqueArgs) =>
        db.user.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
      create: (args: Prisma.UserCreateArgs) =>
        db.user.create({
          ...args,
          data: { ...args.data, tenantId },
        }),
      update: (args: Prisma.UserUpdateArgs) =>
        db.user.updateMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      delete: (args: Prisma.UserDeleteArgs) =>
        db.user.deleteMany({
          where: { ...args.where, tenantId },
        }),
    },
    organization: {
      findMany: (args?: Prisma.OrganizationFindManyArgs) =>
        db.organization.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
      findUnique: (args: Prisma.OrganizationFindUniqueArgs) =>
        db.organization.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
      create: (args: Prisma.OrganizationCreateArgs) =>
        db.organization.create({
          ...args,
          data: { ...args.data, tenantId },
        }),
      update: (args: Prisma.OrganizationUpdateArgs) =>
        db.organization.updateMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      delete: (args: Prisma.OrganizationDeleteArgs) =>
        db.organization.deleteMany({
          where: { ...args.where, tenantId },
        }),
    },
    // Add more models as needed
  };
}

export type TenantClient = ReturnType<typeof createTenantClient>;
