import type { Prisma } from "@/generated/prisma/client";

export type AuditLogListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};

function parseDayBound(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const iso = endOfDay
    ? `${value.trim()}T23:59:59.999+07:00`
    : `${value.trim()}T00:00:00.000+07:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildAuditLogWhere(
  query: AuditLogListQuery,
): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  const q = query.q?.trim();
  if (q) {
    and.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        {
          actorEmployee: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }

  const action = query.action?.trim();
  if (action) {
    and.push({ action: { equals: action } });
  }

  const entityType = query.entityType?.trim();
  if (entityType) {
    and.push({ entityType: { equals: entityType } });
  }

  const from = parseDayBound(query.from, false);
  const to = parseDayBound(query.to, true);
  if (from || to) {
    and.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function clampAuditLogPage(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
