import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

type AuditLogCreateArgs = {
  data: {
    actorEmployeeId?: string | null;
    actorAuthUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  };
};

type AuditLogClient = {
  auditLog: {
    create(args: AuditLogCreateArgs): Promise<unknown>;
  };
};

export type AuditActor = {
  employeeId?: string | null;
  authUserId?: string | null;
};

export type AuditLogInput = {
  actor?: AuditActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAuditLog(
  input: AuditLogInput,
  client: AuditLogClient = prisma,
) {
  try {
    await client.auditLog.create({
      data: {
        actorEmployeeId: input.actor?.employeeId ?? null,
        actorAuthUserId: input.actor?.authUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}
