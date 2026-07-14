import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const fromKey = request.nextUrl.searchParams.get("from");
    const toKey = request.nextUrl.searchParams.get("to");
    const where =
      fromKey && toKey
        ? {
            holidayDate: {
              gte: parseDateKey(fromKey) ?? undefined,
              lte: parseDateKey(toKey) ?? undefined,
            },
          }
        : {};

    const holidays = await prisma.holidayCalendar.findMany({
      where,
      orderBy: { holidayDate: "asc" },
    });
    return NextResponse.json(
      holidays.map((item) => ({
        id: item.id,
        name: item.name,
        holidayDate: dateKeyUtc(item.holidayDate),
        isDayOff: item.isDayOff,
        notes: item.notes,
      })),
    );
  } catch (error) {
    console.error("GET /api/hr/holidays failed", error);
    return apiErrorResponse("ไม่สามารถโหลดวันหยุดได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const mode =
      typeof parsed.body.mode === "string" ? parsed.body.mode.trim() : "create";

    if (mode === "delete") {
      const id =
        typeof parsed.body.id === "string" ? parsed.body.id.trim() : "";
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      ) {
        return validationErrorResponse("รหัสวันหยุดไม่ถูกต้อง", [
          { path: "id", message: "UUID ไม่ถูกต้อง" },
        ]);
      }
      await prisma.holidayCalendar.delete({ where: { id } });
      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "HR_HOLIDAY_DELETED",
        entityType: "HOLIDAY",
        entityId: id,
      });
      return NextResponse.json({ id, deleted: true });
    }

    const issues: ValidationIssue[] = [];
    const name =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
    const holidayDateRaw =
      typeof parsed.body.holidayDate === "string"
        ? parsed.body.holidayDate.trim()
        : "";
    const holidayDate = parseDateKey(holidayDateRaw);
    if (!name) issues.push({ path: "name", message: "กรุณาระบุชื่อวันหยุด" });
    if (!holidayDate)
      issues.push({ path: "holidayDate", message: "วันที่ไม่ถูกต้อง" });
    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบวันหยุด", issues);
    }

    const created = await prisma.holidayCalendar.create({
      data: {
        name,
        holidayDate: holidayDate!,
        isDayOff:
          typeof parsed.body.isDayOff === "boolean"
            ? parsed.body.isDayOff
            : true,
        notes:
          typeof parsed.body.notes === "string"
            ? parsed.body.notes.trim() || null
            : null,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_HOLIDAY_CREATED",
      entityType: "HOLIDAY",
      entityId: created.id,
      metadata: { holidayDate: holidayDateRaw, name },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        holidayDate: dateKeyUtc(created.holidayDate),
        isDayOff: created.isDayOff,
        notes: created.notes,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse("วันหยุดซ้ำ", 409, "CONFLICT");
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return apiErrorResponse("ไม่พบวันหยุด", 404, "NOT_FOUND");
    }
    console.error("POST /api/hr/holidays failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกวันหยุดได้", 500, "INTERNAL_ERROR");
  }
}
