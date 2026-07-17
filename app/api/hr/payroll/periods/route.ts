import type {
  PayrollPeriodType,
  Prisma,
} from "@/generated/prisma/client";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { workforceEmployeeWhere } from "@/lib/auth/support-account";
import { resolvePayrollCompensation } from "@/lib/hr/employee-compensation";
import { displayEmployeeName } from "@/lib/hr/employees";
import { eachDateKeyInclusive } from "@/lib/hr/leave";
import {
  buildPayslipPayload,
  calculatePayrollEntry,
  parsePayrollSettings,
} from "@/lib/hr/payroll";
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

function serializePeriod(period: {
  id: string;
  name: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  lockedAt: Date | null;
  calculatedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  notes: string | null;
  _count?: { entries: number };
}) {
  return {
    id: period.id,
    name: period.name,
    periodType: period.periodType,
    periodStart: dateKeyUtc(period.periodStart),
    periodEnd: dateKeyUtc(period.periodEnd),
    status: period.status,
    lockedAt: period.lockedAt?.toISOString() ?? null,
    calculatedAt: period.calculatedAt?.toISOString() ?? null,
    reviewedAt: period.reviewedAt?.toISOString() ?? null,
    approvedAt: period.approvedAt?.toISOString() ?? null,
    paidAt: period.paidAt?.toISOString() ?? null,
    notes: period.notes,
    entryCount: period._count?.entries ?? undefined,
  };
}

function serializeEntry(
  entry: Prisma.PayrollEntryGetPayload<{
    include: {
      employee: {
        select: {
          id: true;
          name: true;
          firstName: true;
          lastName: true;
          employeeCode: true;
        };
      };
      payslip: true;
    };
  }>,
) {
  return {
    id: entry.id,
    periodId: entry.periodId,
    employeeId: entry.employeeId,
    employeeName: displayEmployeeName(entry.employee),
    employeeCode: entry.employee.employeeCode,
    employmentType: entry.employmentType,
    basePay: moneyNum(entry.basePay),
    otPay: moneyNum(entry.otPay),
    holidayPay: moneyNum(entry.holidayPay),
    allowances: moneyNum(entry.allowances),
    bonuses: moneyNum(entry.bonuses),
    deductions: moneyNum(entry.deductions),
    advances: moneyNum(entry.advances),
    unpaidLeaveDeduction: moneyNum(entry.unpaidLeaveDeduction),
    absenceDeduction: moneyNum(entry.absenceDeduction),
    lateDeduction: moneyNum(entry.lateDeduction),
    grossPay: moneyNum(entry.grossPay),
    netPay: moneyNum(entry.netPay),
    workedMinutes: entry.workedMinutes,
    otMinutes: entry.otMinutes,
    absentDays: moneyNum(entry.absentDays),
    unpaidLeaveDays: moneyNum(entry.unpaidLeaveDays),
    lateMinutes: entry.lateMinutes,
    hourlyRateSnapshot:
      entry.hourlyRateSnapshot == null
        ? null
        : moneyNum(entry.hourlyRateSnapshot),
    otHourlyRateSnapshot:
      entry.otHourlyRateSnapshot == null
        ? null
        : moneyNum(entry.otHourlyRateSnapshot),
    otMultiplierSnapshot:
      entry.otMultiplierSnapshot == null
        ? null
        : moneyNum(entry.otMultiplierSnapshot),
    dailyRateSnapshot:
      entry.dailyRateSnapshot == null
        ? null
        : moneyNum(entry.dailyRateSnapshot),
    monthlySalarySnapshot:
      entry.monthlySalarySnapshot == null
        ? null
        : moneyNum(entry.monthlySalarySnapshot),
    replacementShiftCount: entry.replacementShiftCount,
    doubleShiftCount: entry.doubleShiftCount,
    hasPayslip: Boolean(entry.payslip),
    payslipId: entry.payslip?.id ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const periodId = request.nextUrl.searchParams.get("periodId");
    if (periodId) {
      if (!isUuid(periodId)) {
        return apiErrorResponse("รหัสรอบไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
        include: {
          entries: {
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
              payslip: true,
            },
            orderBy: { employee: { name: "asc" } },
          },
          adjustments: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!period) {
        return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
      }
      return NextResponse.json({
        period: serializePeriod(period),
        entries: period.entries.map(serializeEntry),
        adjustments: period.adjustments.map((item) => ({
          id: item.id,
          employeeId: item.employeeId,
          type: item.type,
          amount: moneyNum(item.amount),
          reason: item.reason,
        })),
      });
    }

    const periods = await prisma.payrollPeriod.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: [{ periodStart: "desc" }],
      take: 50,
    });
    return NextResponse.json({
      periods: periods.map(serializePeriod),
    });
  } catch (error) {
    console.error("GET /api/hr/payroll/periods failed", error);
    return apiErrorResponse("ไม่สามารถโหลดรอบจ่ายได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }
    const permissions = currentUser.employee?.role?.permissions ?? [];
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const mode =
      typeof parsed.body.mode === "string" ? parsed.body.mode.trim() : "create";

    if (mode === "create") {
      if (!permissions.includes("hr.payroll.calculate")) {
        return apiErrorResponse("ไม่มีสิทธิ์สร้างรอบจ่าย", 403, "FORBIDDEN");
      }
      const issues: ValidationIssue[] = [];
      const name =
        typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
      const periodType =
        typeof parsed.body.periodType === "string"
          ? parsed.body.periodType.trim()
          : "";
      const startRaw =
        typeof parsed.body.periodStart === "string"
          ? parsed.body.periodStart.trim()
          : "";
      const endRaw =
        typeof parsed.body.periodEnd === "string"
          ? parsed.body.periodEnd.trim()
          : "";
      const start = parseDateKey(startRaw);
      const end = parseDateKey(endRaw);
      if (!name) issues.push({ path: "name", message: "กรุณาระบุชื่อรอบ" });
      if (
        !["DAILY", "WEEKLY", "SEMI_MONTHLY", "MONTHLY", "CUSTOM"].includes(
          periodType,
        )
      ) {
        issues.push({ path: "periodType", message: "ประเภทช่วงไม่ถูกต้อง" });
      }
      if (!start || !end || start > end) {
        issues.push({ path: "periodStart", message: "ช่วงวันที่ไม่ถูกต้อง" });
      }
      if (issues.length || !start || !end) {
        return validationErrorResponse("กรุณาตรวจสอบรอบจ่าย", issues);
      }

      const created = await prisma.payrollPeriod.create({
        data: {
          name,
          periodType: periodType as PayrollPeriodType,
          periodStart: start,
          periodEnd: end,
          notes:
            typeof parsed.body.notes === "string"
              ? parsed.body.notes.trim() || null
              : null,
        },
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_PERIOD_CREATED",
        entityType: "PAYROLL_PERIOD",
        entityId: created.id,
        metadata: { name, periodType, periodStart: startRaw, periodEnd: endRaw },
      });

      return NextResponse.json(serializePeriod(created), { status: 201 });
    }

    if (mode === "calculate") {
      if (!permissions.includes("hr.payroll.calculate")) {
        return apiErrorResponse("ไม่มีสิทธิ์คำนวณค่าจ้าง", 403, "FORBIDDEN");
      }
      const periodId =
        typeof parsed.body.periodId === "string"
          ? parsed.body.periodId.trim()
          : "";
      if (!isUuid(periodId)) {
        return validationErrorResponse("รหัสรอบไม่ถูกต้อง", [
          { path: "periodId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
      }
      if (period.status === "APPROVED" || period.status === "PAID") {
        return apiErrorResponse("รอบถูกล็อกแล้ว", 409, "LOCKED");
      }

      const settingsRows = await prisma.payrollSetting.findMany();
      const settings = parsePayrollSettings(settingsRows);
      const periodKeys = eachDateKeyInclusive(
        dateKeyUtc(period.periodStart),
        dateKeyUtc(period.periodEnd),
      );
      const periodCalendarDays = periodKeys.length;
      const monthDays = new Date(
        Date.UTC(
          period.periodStart.getUTCFullYear(),
          period.periodStart.getUTCMonth() + 1,
          0,
        ),
      ).getUTCDate();

      const employees = await prisma.employee.findMany({
        where: {
          ...workforceEmployeeWhere(),
        },
        include: {
          compensations: {
            where: { isActive: true },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
      });

      const [attendances, leaves, adjustments, scheduledShifts] =
        await Promise.all([
          prisma.attendanceRecord.findMany({
            where: {
              workDate: {
                gte: period.periodStart,
                lte: period.periodEnd,
              },
            },
          }),
          prisma.leaveRequest.findMany({
            where: {
              status: "APPROVED",
              startDate: { lte: period.periodEnd },
              endDate: { gte: period.periodStart },
            },
            include: { leaveType: true },
          }),
          prisma.payrollAdjustment.findMany({
            where: { periodId },
          }),
          prisma.scheduledShift.findMany({
            where: {
              workDate: {
                gte: period.periodStart,
                lte: period.periodEnd,
              },
              status: { in: ["SCHEDULED", "COMPLETED", "ABSENT", "LEAVE"] },
              assignmentType: { in: ["REPLACEMENT", "DOUBLE_SHIFT"] },
            },
            select: {
              employeeId: true,
              assignmentType: true,
            },
          }),
        ]);

      const shiftCountsByEmployee = new Map<
        string,
        { replacement: number; double: number }
      >();
      for (const shift of scheduledShifts) {
        const current = shiftCountsByEmployee.get(shift.employeeId) ?? {
          replacement: 0,
          double: 0,
        };
        if (shift.assignmentType === "REPLACEMENT") current.replacement += 1;
        if (shift.assignmentType === "DOUBLE_SHIFT") current.double += 1;
        shiftCountsByEmployee.set(shift.employeeId, current);
      }

      const entryCount = await prisma.$transaction(async (tx) => {
        await tx.payrollPayslip.deleteMany({ where: { periodId } });
        await tx.payrollEntry.deleteMany({ where: { periodId } });

        let created = 0;
        for (const employee of employees) {
          const compensationRow = employee.compensations[0] ?? null;
          const compensation = resolvePayrollCompensation(
            employee,
            compensationRow,
          );
          if (!compensation) continue;

          const empAttendance = attendances.filter(
            (item) => item.employeeId === employee.id,
          );
          let workedMinutes = 0;
          let otMinutes = 0;
          let lateMinutes = 0;
          let holidayWorkedMinutes = 0;
          let absentDays = 0;
          for (const row of empAttendance) {
            workedMinutes += row.workedMinutes;
            otMinutes += row.otApprovedMinutes;
            lateMinutes += row.lateMinutes;
            if (row.isHolidayWork) {
              holidayWorkedMinutes += row.workedMinutes;
            }
            if (row.status === "ABSENT") {
              absentDays += 1;
            }
          }

          let unpaidLeaveDays = 0;
          for (const leave of leaves) {
            if (leave.employeeId !== employee.id) continue;
            if (leave.leaveType.isPaid) continue;
            const overlapKeys = eachDateKeyInclusive(
              dateKeyUtc(
                leave.startDate > period.periodStart
                  ? leave.startDate
                  : period.periodStart,
              ),
              dateKeyUtc(
                leave.endDate < period.periodEnd
                  ? leave.endDate
                  : period.periodEnd,
              ),
            );
            const factor =
              leave.duration === "FULL_DAY" ? 1 : 0.5;
            unpaidLeaveDays += overlapKeys.length * factor;
          }

          // Avoid double-counting unpaid leave days already marked ABSENT from leave approve
          absentDays = Math.max(0, absentDays - unpaidLeaveDays);

          const empAdjustments = adjustments.filter(
            (item) => item.employeeId === employee.id,
          );
          const adj = {
            bonuses: 0,
            deductions: 0,
            advances: 0,
            otherEarnings: 0,
          };
          for (const item of empAdjustments) {
            const amount = moneyNum(item.amount);
            if (item.type === "BONUS") adj.bonuses += amount;
            if (item.type === "DEDUCTION") adj.deductions += amount;
            if (item.type === "ADVANCE") adj.advances += amount;
            if (item.type === "OTHER_EARNING") adj.otherEarnings += amount;
          }

          const calc = calculatePayrollEntry({
            compensation,
            attendance: {
              workedMinutes,
              otMinutes,
              lateMinutes,
              holidayWorkedMinutes,
              absentDays,
            },
            leave: { unpaidLeaveDays },
            adjustments: adj,
            settings,
            periodCalendarDays,
            monthDays,
          });

          const shiftCounts = shiftCountsByEmployee.get(employee.id) ?? {
            replacement: 0,
            double: 0,
          };

          const entry = await tx.payrollEntry.create({
            data: {
              periodId,
              employeeId: employee.id,
              employmentType: compensation.employmentType,
              ...calc,
              absentDays,
              unpaidLeaveDays,
              replacementShiftCount: shiftCounts.replacement,
              doubleShiftCount: shiftCounts.double,
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

          await tx.payrollAdjustment.updateMany({
            where: { periodId, employeeId: employee.id },
            data: { entryId: entry.id },
          });

          const payload = buildPayslipPayload({
            periodName: period.name,
            periodStart: dateKeyUtc(period.periodStart),
            periodEnd: dateKeyUtc(period.periodEnd),
            employeeName: displayEmployeeName(entry.employee),
            employeeCode: entry.employee.employeeCode,
            employmentType: entry.employmentType,
            calc,
          });

          await tx.payrollPayslip.create({
            data: {
              periodId,
              entryId: entry.id,
              employeeId: employee.id,
              payload,
            },
          });
          created += 1;
        }

        await tx.payrollPeriod.update({
          where: { id: periodId },
          data: {
            status: "CALCULATED",
            calculatedAt: new Date(),
            calculatedById: actorEmployeeId,
            lockedAt: null,
            reviewedAt: null,
            reviewedById: null,
            approvedAt: null,
            approvedById: null,
            paidAt: null,
            paidById: null,
          },
        });

        return created;
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_CALCULATED",
        entityType: "PAYROLL_PERIOD",
        entityId: periodId,
        metadata: { entryCount },
      });

      return NextResponse.json({ periodId, entryCount, status: "CALCULATED" });
    }

    if (mode === "review") {
      if (!permissions.includes("hr.payroll.calculate")) {
        return apiErrorResponse("ไม่มีสิทธิ์ตรวจทานรอบจ่าย", 403, "FORBIDDEN");
      }
      return transitionPeriod({
        periodId: String(parsed.body.periodId ?? ""),
        from: ["CALCULATED"],
        to: "REVIEWED",
        actorEmployeeId,
        authUserId: currentUser.user.id,
        field: "reviewed",
      });
    }

    if (mode === "approve") {
      if (!permissions.includes("hr.payroll.approve")) {
        return apiErrorResponse("ไม่มีสิทธิ์อนุมัติรอบจ่าย", 403, "FORBIDDEN");
      }
      return transitionPeriod({
        periodId: String(parsed.body.periodId ?? ""),
        from: ["REVIEWED", "CALCULATED"],
        to: "APPROVED",
        actorEmployeeId,
        authUserId: currentUser.user.id,
        field: "approved",
        lock: true,
      });
    }

    if (mode === "mark-paid") {
      if (!permissions.includes("hr.payroll.mark_paid")) {
        return apiErrorResponse("ไม่มีสิทธิ์บันทึกจ่ายแล้ว", 403, "FORBIDDEN");
      }
      return transitionPeriod({
        periodId: String(parsed.body.periodId ?? ""),
        from: ["APPROVED"],
        to: "PAID",
        actorEmployeeId,
        authUserId: currentUser.user.id,
        field: "paid",
        lock: true,
      });
    }

    if (mode === "unlock") {
      if (!permissions.includes("hr.payroll.unlock")) {
        return apiErrorResponse("ไม่มีสิทธิ์ปลดล็อกรอบจ่าย", 403, "FORBIDDEN");
      }
      const periodId =
        typeof parsed.body.periodId === "string"
          ? parsed.body.periodId.trim()
          : "";
      const unlockReason =
        typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
      if (!isUuid(periodId)) {
        return validationErrorResponse("รหัสรอบไม่ถูกต้อง", [
          { path: "periodId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }
      if (!unlockReason) {
        return validationErrorResponse("ต้องระบุเหตุผลการปลดล็อก", [
          { path: "reason", message: "ระบุเหตุผล" },
        ]);
      }
      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period || (period.status !== "APPROVED" && period.status !== "PAID")) {
        return apiErrorResponse("ปลดล็อกได้เฉพาะรอบที่อนุมัติ/จ่ายแล้ว", 409, "CONFLICT");
      }
      const updated = await prisma.payrollPeriod.update({
        where: { id: periodId },
        data: {
          status: "CALCULATED",
          lockedAt: null,
          approvedAt: null,
          approvedById: null,
          paidAt: null,
          paidById: null,
        },
      });
      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_UNLOCKED",
        entityType: "PAYROLL_PERIOD",
        entityId: periodId,
        metadata: { from: period.status, reason: unlockReason },
      });
      return NextResponse.json(serializePeriod(updated));
    }

    if (mode === "add-adjustment") {
      if (
        !permissions.includes("hr.payroll.adjust") &&
        !permissions.includes("hr.payroll.calculate")
      ) {
        return apiErrorResponse("ไม่มีสิทธิ์เพิ่มรายการปรับ", 403, "FORBIDDEN");
      }
      const issues: ValidationIssue[] = [];
      const periodId =
        typeof parsed.body.periodId === "string"
          ? parsed.body.periodId.trim()
          : "";
      const employeeId =
        typeof parsed.body.employeeId === "string"
          ? parsed.body.employeeId.trim()
          : "";
      const type =
        typeof parsed.body.type === "string" ? parsed.body.type.trim() : "";
      const reason =
        typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
      const amount = Number(parsed.body.amount);
      if (!isUuid(periodId)) {
        issues.push({ path: "periodId", message: "รหัสรอบไม่ถูกต้อง" });
      }
      if (!isUuid(employeeId)) {
        issues.push({ path: "employeeId", message: "รหัสพนักงานไม่ถูกต้อง" });
      }
      if (
        !["BONUS", "DEDUCTION", "ADVANCE", "OTHER_EARNING"].includes(type)
      ) {
        issues.push({ path: "type", message: "ประเภทไม่ถูกต้อง" });
      }
      if (!Number.isFinite(amount) || amount === 0) {
        issues.push({ path: "amount", message: "จำนวนเงินไม่ถูกต้อง" });
      }
      if (!reason) issues.push({ path: "reason", message: "ต้องระบุเหตุผล" });
      if (issues.length) {
        return validationErrorResponse("กรุณาตรวจสอบรายการปรับ", issues);
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
      }
      if (period.status === "APPROVED" || period.status === "PAID") {
        return apiErrorResponse("รอบถูกล็อกแล้ว", 409, "LOCKED");
      }

      const created = await prisma.payrollAdjustment.create({
        data: {
          periodId,
          employeeId,
          type: type as "BONUS" | "DEDUCTION" | "ADVANCE" | "OTHER_EARNING",
          amount: Math.abs(amount),
          reason,
          createdById: actorEmployeeId,
        },
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_ADJUSTMENT_ADDED",
        entityType: "PAYROLL_ADJUSTMENT",
        entityId: created.id,
        metadata: { periodId, employeeId, type, amount },
      });

      return NextResponse.json(
        {
          id: created.id,
          periodId,
          employeeId,
          type: created.type,
          amount: moneyNum(created.amount),
          reason: created.reason,
        },
        { status: 201 },
      );
    }

    if (mode === "update") {
      if (!permissions.includes("hr.payroll.calculate")) {
        return apiErrorResponse("ไม่มีสิทธิ์แก้ไขรอบจ่าย", 403, "FORBIDDEN");
      }

      const periodId =
        typeof parsed.body.periodId === "string"
          ? parsed.body.periodId.trim()
          : "";
      const issues: ValidationIssue[] = [];
      const name =
        typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
      const periodType =
        typeof parsed.body.periodType === "string"
          ? parsed.body.periodType.trim()
          : "";
      const startRaw =
        typeof parsed.body.periodStart === "string"
          ? parsed.body.periodStart.trim()
          : "";
      const endRaw =
        typeof parsed.body.periodEnd === "string"
          ? parsed.body.periodEnd.trim()
          : "";
      const start = parseDateKey(startRaw);
      const end = parseDateKey(endRaw);

      if (!isUuid(periodId)) {
        issues.push({ path: "periodId", message: "รหัสรอบไม่ถูกต้อง" });
      }
      if (!name) issues.push({ path: "name", message: "กรุณาระบุชื่อรอบ" });
      if (
        !["DAILY", "WEEKLY", "SEMI_MONTHLY", "MONTHLY", "CUSTOM"].includes(
          periodType,
        )
      ) {
        issues.push({ path: "periodType", message: "ประเภทช่วงไม่ถูกต้อง" });
      }
      if (!start || !end || start > end) {
        issues.push({ path: "periodStart", message: "ช่วงวันที่ไม่ถูกต้อง" });
      }
      if (issues.length || !start || !end) {
        return validationErrorResponse("กรุณาตรวจสอบรอบจ่าย", issues);
      }

      const existing = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
      }
      if (existing.status === "APPROVED" || existing.status === "PAID") {
        return apiErrorResponse(
          "รอบถูกล็อกแล้ว — ปลดล็อกก่อนแก้ไข หรือสร้างรอบใหม่",
          409,
          "LOCKED",
        );
      }

      const datesChanged =
        dateKeyUtc(existing.periodStart) !== startRaw ||
        dateKeyUtc(existing.periodEnd) !== endRaw;
      const mustRecalculate =
        datesChanged &&
        (existing.status === "CALCULATED" || existing.status === "REVIEWED");

      const updated = await prisma.$transaction(async (tx) => {
        if (mustRecalculate) {
          await tx.payrollPayslip.deleteMany({ where: { periodId } });
          await tx.payrollAdjustment.deleteMany({ where: { periodId } });
          await tx.payrollEntry.deleteMany({ where: { periodId } });
        }

        return tx.payrollPeriod.update({
          where: { id: periodId },
          data: {
            name,
            periodType: periodType as PayrollPeriodType,
            periodStart: start,
            periodEnd: end,
            notes:
              typeof parsed.body.notes === "string"
                ? parsed.body.notes.trim() || null
                : existing.notes,
            ...(mustRecalculate
              ? {
                  status: "DRAFT" as const,
                  calculatedAt: null,
                  calculatedById: null,
                  reviewedAt: null,
                  reviewedById: null,
                }
              : {}),
          },
        });
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_PERIOD_UPDATED",
        entityType: "PAYROLL_PERIOD",
        entityId: updated.id,
        metadata: {
          name,
          periodType,
          periodStart: startRaw,
          periodEnd: endRaw,
          clearedCalculation: mustRecalculate,
        },
      });

      return NextResponse.json(serializePeriod(updated));
    }

    if (mode === "delete") {
      if (!permissions.includes("hr.payroll.calculate")) {
        return apiErrorResponse("ไม่มีสิทธิ์ลบรอบจ่าย", 403, "FORBIDDEN");
      }

      const periodId =
        typeof parsed.body.periodId === "string"
          ? parsed.body.periodId.trim()
          : "";
      if (!isUuid(periodId)) {
        return validationErrorResponse("รหัสรอบไม่ถูกต้อง", [
          { path: "periodId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }

      const existing = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
        select: { id: true, name: true, status: true },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
      }
      if (existing.status === "APPROVED" || existing.status === "PAID") {
        return apiErrorResponse(
          "รอบถูกล็อกแล้ว — ปลดล็อกก่อนลบ",
          409,
          "LOCKED",
        );
      }

      await prisma.payrollPeriod.delete({ where: { id: periodId } });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_PAYROLL_PERIOD_DELETED",
        entityType: "PAYROLL_PERIOD",
        entityId: periodId,
        metadata: { name: existing.name, status: existing.status },
      });

      return NextResponse.json({ ok: true, id: periodId });
    }

    return apiErrorResponse("mode ไม่รองรับ", 400, "INVALID_MODE");
  } catch (error) {
    console.error("POST /api/hr/payroll/periods failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกรอบจ่ายได้", 500, "INTERNAL_ERROR");
  }
}

async function transitionPeriod(input: {
  periodId: string;
  from: string[];
  to: "REVIEWED" | "APPROVED" | "PAID";
  actorEmployeeId: string;
  authUserId: string;
  field: "reviewed" | "approved" | "paid";
  lock?: boolean;
}) {
  if (!isUuid(input.periodId)) {
    return validationErrorResponse("รหัสรอบไม่ถูกต้อง", [
      { path: "periodId", message: "UUID ไม่ถูกต้อง" },
    ]);
  }
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period || !input.from.includes(period.status)) {
    return apiErrorResponse("สถานะรอบไม่พร้อมเปลี่ยน", 409, "INVALID_STATE");
  }

  const data: Prisma.PayrollPeriodUpdateInput = {
    status: input.to,
  };
  if (input.lock) data.lockedAt = new Date();
  if (input.field === "reviewed") {
    data.reviewedAt = new Date();
    data.reviewedBy = { connect: { id: input.actorEmployeeId } };
  }
  if (input.field === "approved") {
    data.approvedAt = new Date();
    data.approvedBy = { connect: { id: input.actorEmployeeId } };
  }
  if (input.field === "paid") {
    data.paidAt = new Date();
    data.paidBy = { connect: { id: input.actorEmployeeId } };
  }

  const updated = await prisma.payrollPeriod.update({
    where: { id: input.periodId },
    data,
  });

  await recordAuditLog({
    actor: {
      employeeId: input.actorEmployeeId,
      authUserId: input.authUserId,
    },
    action: `HR_PAYROLL_${input.to}`,
    entityType: "PAYROLL_PERIOD",
    entityId: input.periodId,
  });

  return NextResponse.json(serializePeriod(updated));
}
