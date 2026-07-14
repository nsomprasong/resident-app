import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { displayEmployeeName } from "@/lib/hr/employees";
import {
  availableLeaveDays,
  decimalDays,
} from "@/lib/hr/leave";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: NextRequest) {
  try {
    const yearRaw = request.nextUrl.searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : new Date().getUTCFullYear();
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return apiErrorResponse("ปีไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }
    if (employeeId && !isUuid(employeeId)) {
      return apiErrorResponse("รหัสพนักงานไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const balances = await prisma.leaveBalance.findMany({
      where: {
        year,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        leaveType: {
          select: { id: true, code: true, name: true, isPaid: true },
        },
      },
      orderBy: [{ employee: { name: "asc" } }, { leaveType: { name: "asc" } }],
    });

    return NextResponse.json({
      year,
      balances: balances.map((item) => {
        const entitled = decimalDays(item.entitled);
        const used = decimalDays(item.used);
        const pending = decimalDays(item.pending);
        return {
          id: item.id,
          employeeId: item.employeeId,
          employeeName: displayEmployeeName(item.employee),
          employeeCode: item.employee.employeeCode,
          leaveTypeId: item.leaveTypeId,
          leaveTypeCode: item.leaveType.code,
          leaveTypeName: item.leaveType.name,
          isPaid: item.leaveType.isPaid,
          year: item.year,
          entitled,
          used,
          pending,
          available: availableLeaveDays({ entitled, used, pending }),
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/hr/leave-balances failed", error);
    return apiErrorResponse("ไม่สามารถโหลดยอดวันลาได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    if (!permissions.includes("hr.settings.manage")) {
      return apiErrorResponse("ไม่มีสิทธิ์ปรับสิทธิวันลา", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const issues: ValidationIssue[] = [];
    const employeeId =
      typeof parsed.body.employeeId === "string"
        ? parsed.body.employeeId.trim()
        : "";
    const leaveTypeId =
      typeof parsed.body.leaveTypeId === "string"
        ? parsed.body.leaveTypeId.trim()
        : "";
    const year = Number(parsed.body.year ?? new Date().getUTCFullYear());
    const entitled = Number(parsed.body.entitled);
    if (!isUuid(employeeId)) {
      issues.push({ path: "employeeId", message: "รหัสพนักงานไม่ถูกต้อง" });
    }
    if (!isUuid(leaveTypeId)) {
      issues.push({ path: "leaveTypeId", message: "ประเภทลาไม่ถูกต้อง" });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      issues.push({ path: "year", message: "ปีไม่ถูกต้อง" });
    }
    if (!Number.isFinite(entitled) || entitled < 0) {
      issues.push({ path: "entitled", message: "สิทธิไม่ถูกต้อง" });
    }
    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบสิทธิวันลา", issues);
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });
    if (!leaveType || !leaveType.isActive) {
      return apiErrorResponse("ไม่พบประเภทลาที่ใช้งานได้", 404, "NOT_FOUND");
    }

    const saved = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
      create: {
        employeeId,
        leaveTypeId,
        year,
        entitled,
      },
      update: { entitled },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_LEAVE_BALANCE_SET",
      entityType: "LEAVE_BALANCE",
      entityId: saved.id,
      metadata: { employeeId, leaveTypeId, year, entitled },
    });

    return NextResponse.json({
      id: saved.id,
      employeeId: saved.employeeId,
      leaveTypeId: saved.leaveTypeId,
      year: saved.year,
      entitled: decimalDays(saved.entitled),
      used: decimalDays(saved.used),
      pending: decimalDays(saved.pending),
    });
  } catch (error) {
    console.error("POST /api/hr/leave-balances failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกสิทธิวันลาได้", 500, "INTERNAL_ERROR");
  }
}
