import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { BulkAssignMode } from "@/lib/hr/schedule-bulk-assign";
import {
  bulkAssignPeriodShifts,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ periodId: string }> };

const modes = new Set<BulkAssignMode>([
  "FILL_EMPTY",
  "REPLACE_ALL",
  "REPLACE_SELECTED",
]);

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const employeeIds = Array.isArray(parsed.body.employeeIds)
      ? parsed.body.employeeIds.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
    const cells = Array.isArray(parsed.body.cells)
      ? parsed.body.cells
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as { employeeId?: unknown; dateKey?: unknown };
            if (
              typeof row.employeeId !== "string" ||
              typeof row.dateKey !== "string"
            ) {
              return null;
            }
            return { employeeId: row.employeeId, dateKey: row.dateKey };
          })
          .filter(
            (item): item is { employeeId: string; dateKey: string } =>
              item !== null,
          )
      : [];
    const shiftTemplateId =
      typeof parsed.body.shiftTemplateId === "string"
        ? parsed.body.shiftTemplateId.trim()
        : "";
    const modeRaw =
      typeof parsed.body.mode === "string" ? parsed.body.mode : "FILL_EMPTY";
    const mode = modes.has(modeRaw as BulkAssignMode)
      ? (modeRaw as BulkAssignMode)
      : null;
    const weekdays = Array.isArray(parsed.body.weekdays)
      ? parsed.body.weekdays.filter(
          (item): item is number =>
            typeof item === "number" && item >= 0 && item <= 6,
        )
      : [];

    const cellMode = cells.length > 0;
    if (
      !shiftTemplateId ||
      !mode ||
      (!cellMode && (!employeeIds.length || !weekdays.length)) ||
      (cellMode && !cells.length)
    ) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลกำหนดกะทั้งรอบ", [
        { path: "employeeIds", message: "เลือกพนักงาน หรือเลือกช่องบนตาราง" },
        { path: "cells", message: "เลือกช่องบนตาราง" },
        { path: "shiftTemplateId", message: "เลือกกะ" },
        { path: "mode", message: "เลือกวิธีบันทึก" },
        { path: "weekdays", message: "เลือกวันทำงาน (เมื่อไม่ใช้เลือกช่อง)" },
      ]);
    }

    const result = await bulkAssignPeriodShifts({
      periodId,
      actorEmployeeId,
      employeeIds: cellMode ? undefined : employeeIds,
      cells: cellMode ? cells : undefined,
      shiftTemplateId,
      mode,
      weekdays: cellMode ? undefined : weekdays,
      dateFrom:
        typeof parsed.body.dateFrom === "string" ? parsed.body.dateFrom : null,
      dateTo:
        typeof parsed.body.dateTo === "string" ? parsed.body.dateTo : null,
      replaceOverrides: parsed.body.replaceOverrides === true,
      reason:
        typeof parsed.body.reason === "string" ? parsed.body.reason : null,
      dryRun: parsed.body.dryRun === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "REASON_REQUIRED"
            ? 400
            : 400;
      return apiErrorResponse(error.message, status, error.code);
    }
    console.error(error);
    return apiErrorResponse("กำหนดกะทั้งรอบไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
