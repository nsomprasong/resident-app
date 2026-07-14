import type { EmploymentType, Prisma } from "@/generated/prisma/client";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { displayEmployeeName } from "@/lib/hr/employees";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function moneyNum(value: { toString(): string } | number): number {
  return Number(value);
}

function serialize(item: {
  id: string;
  employeeId: string;
  employmentType: EmploymentType;
  dailyRate: { toString(): string };
  hourlyRate: { toString(): string };
  monthlySalary: { toString(): string };
  positionAllowance: { toString(): string };
  mealAllowance: { toString(): string };
  housingAllowance: { toString(): string };
  travelAllowance: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  notes: string | null;
  employee?: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    employeeCode: string | null;
  };
}) {
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeName: item.employee ? displayEmployeeName(item.employee) : null,
    employeeCode: item.employee?.employeeCode ?? null,
    employmentType: item.employmentType,
    dailyRate: moneyNum(item.dailyRate),
    hourlyRate: moneyNum(item.hourlyRate),
    monthlySalary: moneyNum(item.monthlySalary),
    positionAllowance: moneyNum(item.positionAllowance),
    mealAllowance: moneyNum(item.mealAllowance),
    housingAllowance: moneyNum(item.housingAllowance),
    travelAllowance: moneyNum(item.travelAllowance),
    effectiveFrom: dateKeyUtc(item.effectiveFrom),
    effectiveTo: item.effectiveTo ? dateKeyUtc(item.effectiveTo) : null,
    isActive: item.isActive,
    notes: item.notes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    const where: Prisma.EmployeeCompensationWhereInput = {
      isActive: true,
    };
    if (employeeId) {
      if (!isUuid(employeeId)) {
        return apiErrorResponse("รหัสพนักงานไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      where.employeeId = employeeId;
    }

    const rows = await prisma.employeeCompensation.findMany({
      where,
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
      },
      orderBy: [{ employee: { name: "asc" } }, { effectiveFrom: "desc" }],
    });
    return NextResponse.json({ items: rows.map(serialize) });
  } catch (error) {
    console.error("GET /api/hr/compensations failed", error);
    return apiErrorResponse("ไม่สามารถโหลดค่าตอบแทนได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    if (!permissions.includes("hr.payroll.calculate")) {
      return apiErrorResponse("ไม่มีสิทธิ์ตั้งค่าค่าตอบแทน", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const issues: ValidationIssue[] = [];
    const employeeId =
      typeof parsed.body.employeeId === "string"
        ? parsed.body.employeeId.trim()
        : "";
    const employmentType =
      typeof parsed.body.employmentType === "string"
        ? parsed.body.employmentType.trim()
        : "";
    const effectiveFromRaw =
      typeof parsed.body.effectiveFrom === "string"
        ? parsed.body.effectiveFrom.trim()
        : "";
    const effectiveFrom = parseDateKey(effectiveFromRaw);
    if (!isUuid(employeeId)) {
      issues.push({ path: "employeeId", message: "รหัสพนักงานไม่ถูกต้อง" });
    }
    if (!["DAILY", "MONTHLY"].includes(employmentType)) {
      issues.push({ path: "employmentType", message: "ต้องเป็น DAILY หรือ MONTHLY" });
    }
    if (!effectiveFrom) {
      issues.push({ path: "effectiveFrom", message: "วันที่ไม่ถูกต้อง" });
    }
    if (issues.length || !effectiveFrom) {
      return validationErrorResponse("กรุณาตรวจสอบค่าตอบแทน", issues);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.employeeCompensation.updateMany({
        where: { employeeId, isActive: true },
        data: { isActive: false, effectiveTo: effectiveFrom },
      });
      return tx.employeeCompensation.create({
        data: {
          employeeId,
          employmentType: employmentType as EmploymentType,
          dailyRate: Number(parsed.body.dailyRate ?? 0),
          hourlyRate: Number(parsed.body.hourlyRate ?? 0),
          monthlySalary: Number(parsed.body.monthlySalary ?? 0),
          positionAllowance: Number(parsed.body.positionAllowance ?? 0),
          mealAllowance: Number(parsed.body.mealAllowance ?? 0),
          housingAllowance: Number(parsed.body.housingAllowance ?? 0),
          travelAllowance: Number(parsed.body.travelAllowance ?? 0),
          effectiveFrom,
          notes:
            typeof parsed.body.notes === "string"
              ? parsed.body.notes.trim() || null
              : null,
          isActive: true,
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
        },
      });
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_COMPENSATION_SET",
      entityType: "EMPLOYEE_COMPENSATION",
      entityId: created.id,
      metadata: { employeeId, employmentType },
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/hr/compensations failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกค่าตอบแทนได้", 500, "INTERNAL_ERROR");
  }
}
