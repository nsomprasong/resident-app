import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildAuditLogWhere,
  clampAuditLogPage,
  type AuditLogListQuery,
} from "@/lib/system/audit-log-query";

export type { AuditLogListQuery } from "@/lib/system/audit-log-query";
export { buildAuditLogWhere } from "@/lib/system/audit-log-query";

export type AuditLogListItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  actor: {
    employeeId: string | null;
    employeeName: string | null;
    authUserId: string | null;
  };
};

export type AuditLogListResult = {
  items: AuditLogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listAuditLogs(
  query: AuditLogListQuery = {},
): Promise<AuditLogListResult> {
  const page = clampAuditLogPage(query.page ?? 1, 1, 10_000);
  const pageSize = clampAuditLogPage(query.pageSize ?? 30, 1, 100);
  const where = buildAuditLogWhere(query);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actorEmployee: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      actor: {
        employeeId: row.actorEmployeeId,
        employeeName: row.actorEmployee?.name ?? null,
        authUserId: row.actorAuthUserId,
      },
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listAuditLogFilterOptions() {
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      take: 200,
    }),
  ]);

  return {
    actions: actions.map((row) => row.action),
    entityTypes: entityTypes.map((row) => row.entityType),
  };
}
