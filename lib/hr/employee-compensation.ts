import type {
  Employee,
  EmployeeCompensation,
  EmploymentType,
  Prisma,
} from "@/generated/prisma/client";

import type { CompensationLike } from "@/lib/hr/payroll";

export type EmployeeCompensationDetailInput = {
  employmentType: EmploymentType;
  hourlyRate?: number | null;
  dailyRate?: number;
  monthlySalary?: number;
  effectiveFrom?: Date;
};

function dec(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

/** Build payroll input from employee profile + active compensation row (allowances / รายวัน-เดือน). */
export function resolvePayrollCompensation(
  employee: Pick<Employee, "employmentType" | "hourlyRate" | "otHourlyRate">,
  active: Pick<
    EmployeeCompensation,
    | "employmentType"
    | "dailyRate"
    | "hourlyRate"
    | "monthlySalary"
    | "positionAllowance"
    | "mealAllowance"
    | "housingAllowance"
    | "travelAllowance"
  > | null,
): CompensationLike | null {
  const employmentType = employee.employmentType;
  const hourlyFromEmployee =
    employee.hourlyRate != null ? Number(employee.hourlyRate) : null;
  const dailyRate = active ? dec(active.dailyRate) : 0;
  const monthlySalary = active ? dec(active.monthlySalary) : 0;
  const hourlyRate =
    hourlyFromEmployee != null && hourlyFromEmployee > 0
      ? hourlyFromEmployee
      : active
        ? dec(active.hourlyRate)
        : 0;

  const hasPay =
    employmentType === "DAILY"
      ? dailyRate > 0 || hourlyRate > 0
      : monthlySalary > 0 || hourlyRate > 0;

  if (!hasPay) return null;

  return {
    employmentType,
    dailyRate,
    hourlyRate,
    monthlySalary,
    positionAllowance: active ? dec(active.positionAllowance) : 0,
    mealAllowance: active ? dec(active.mealAllowance) : 0,
    housingAllowance: active ? dec(active.housingAllowance) : 0,
    travelAllowance: active ? dec(active.travelAllowance) : 0,
    otHourlyRate:
      employee.otHourlyRate == null ? null : Number(employee.otHourlyRate),
  };
}

export function hasCompensationDetailPatch(
  data: EmployeeCompensationDetailInput | undefined,
): boolean {
  if (!data) return false;
  return (
    data.hourlyRate !== undefined ||
    data.dailyRate !== undefined ||
    data.monthlySalary !== undefined
  );
}

/** Keep one active row aligned with รายละเอียดพนักงาน (for payroll history / allowances). */
export async function syncActiveEmployeeCompensation(
  tx: Prisma.TransactionClient,
  employeeId: string,
  input: EmployeeCompensationDetailInput,
): Promise<void> {
  const active = await tx.employeeCompensation.findFirst({
    where: { employeeId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });

  const hourlyRate =
    input.hourlyRate !== undefined
      ? (input.hourlyRate ?? 0)
      : active
        ? dec(active.hourlyRate)
        : 0;
  const dailyRate =
    input.dailyRate !== undefined
      ? input.dailyRate
      : active
        ? dec(active.dailyRate)
        : 0;
  const monthlySalary =
    input.monthlySalary !== undefined
      ? input.monthlySalary
      : active
        ? dec(active.monthlySalary)
        : 0;
  const effectiveFrom = input.effectiveFrom ?? new Date();

  if (active) {
    await tx.employeeCompensation.update({
      where: { id: active.id },
      data: {
        employmentType: input.employmentType,
        hourlyRate,
        dailyRate,
        monthlySalary,
      },
    });
    return;
  }

  if (dailyRate <= 0 && monthlySalary <= 0 && hourlyRate <= 0) {
    return;
  }

  await tx.employeeCompensation.create({
    data: {
      employeeId,
      employmentType: input.employmentType,
      hourlyRate,
      dailyRate,
      monthlySalary,
      effectiveFrom,
      isActive: true,
    },
  });
}

export function compensationRatesFromEmployeeRow(
  employee: Pick<Employee, "hourlyRate">,
  active: Pick<
    EmployeeCompensation,
    "dailyRate" | "monthlySalary" | "hourlyRate"
  > | null,
): { dailyRate: number; monthlySalary: number; hourlyRate: number | null } {
  return {
    dailyRate: active ? dec(active.dailyRate) : 0,
    monthlySalary: active ? dec(active.monthlySalary) : 0,
    hourlyRate:
      employee.hourlyRate != null
        ? Number(employee.hourlyRate)
        : active
          ? dec(active.hourlyRate)
          : null,
  };
}
