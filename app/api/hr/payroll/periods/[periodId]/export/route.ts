import {
  apiErrorResponse,
} from "@/lib/api/validation";
import { displayEmployeeName } from "@/lib/hr/employees";
import { buildPayrollExportCsv } from "@/lib/hr/payroll";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ periodId: string }> },
) {
  try {
    const { periodId } = await context.params;
    if (!isUuid(periodId)) {
      return apiErrorResponse("รหัสรอบไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const format = request.nextUrl.searchParams.get("format") ?? "csv";
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
      },
    });
    if (!period) {
      return apiErrorResponse("ไม่พบรอบจ่าย", 404, "NOT_FOUND");
    }

    if (format === "json") {
      return NextResponse.json({
        periodId: period.id,
        name: period.name,
        status: period.status,
        payslips: period.entries
          .filter((entry) => entry.payslip)
          .map((entry) => ({
            entryId: entry.id,
            employeeId: entry.employeeId,
            employeeName: displayEmployeeName(entry.employee),
            payload: entry.payslip?.payload ?? null,
          })),
      });
    }

    const csv = buildPayrollExportCsv(
      period.entries.map((entry) => ({
        employeeCode: entry.employee.employeeCode,
        employeeName: displayEmployeeName(entry.employee),
        employmentType: entry.employmentType,
        basePay: Number(entry.basePay),
        otPay: Number(entry.otPay),
        holidayPay: Number(entry.holidayPay),
        allowances: Number(entry.allowances),
        bonuses: Number(entry.bonuses),
        deductions: Number(entry.deductions),
        advances: Number(entry.advances),
        unpaidLeaveDeduction: Number(entry.unpaidLeaveDeduction),
        absenceDeduction: Number(entry.absenceDeduction),
        lateDeduction: Number(entry.lateDeduction),
        grossPay: Number(entry.grossPay),
        netPay: Number(entry.netPay),
      })),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${periodId}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/hr/payroll/periods/[periodId]/export failed", error);
    return apiErrorResponse("ไม่สามารถส่งออกรอบจ่ายได้", 500, "INTERNAL_ERROR");
  }
}
