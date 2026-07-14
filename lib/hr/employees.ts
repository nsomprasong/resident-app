import type {
  Department,
  Employee,
  EmployeeHrStatus,
  EmploymentType,
  Position,
  Role,
  ShiftTemplate,
} from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";

export const employmentTypes = ["DAILY", "MONTHLY"] as const;
export const employeeHrStatuses = [
  "ACTIVE",
  "PROBATION",
  "SUSPENDED",
  "RESIGNED",
  "TERMINATED",
  "ARCHIVED",
] as const;

export const employmentTypeLabels: Record<EmploymentType, string> = {
  DAILY: "รายวัน",
  MONTHLY: "รายเดือน",
};

export const employeeHrStatusLabels: Record<EmployeeHrStatus, string> = {
  ACTIVE: "ปฏิบัติงาน",
  PROBATION: "ทดลองงาน",
  SUSPENDED: "พักงาน",
  RESIGNED: "ลาออก",
  TERMINATED: "เลิกจ้าง",
  ARCHIVED: "เก็บถาวร",
};

export type HrEmployeeRecord = {
  id: string;
  employeeCode: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  nationalId: string | null;
  birthDate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  employmentType: EmploymentType;
  employmentTypeLabel: string;
  hrStatus: EmployeeHrStatus;
  hrStatusLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  managerEmployeeId: string | null;
  branchName: string | null;
  hiredAt: string | null;
  probationEndsAt: string | null;
  endedAt: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  promptPay: string | null;
  notes: string | null;
  authUserId: string | null;
  hasAuth: boolean;
  roleId: string | null;
  roleDisplayName: string | null;
  hourlyRate: number | null;
  otHourlyRate: number | null;
  payDayOfMonth: number | null;
  defaultShiftTemplateId: string | null;
  defaultShiftTemplateName: string | null;
  isActive: boolean;
};

type EmployeeWithHr = Employee & {
  department: Pick<Department, "id" | "name"> | null;
  position: Pick<Position, "id" | "name"> | null;
  roleRecord: Pick<Role, "id" | "displayName"> | null;
  defaultShiftTemplate: Pick<ShiftTemplate, "id" | "name"> | null;
};

function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function displayEmployeeName(input: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const combined = [input.firstName, input.lastName]
    .filter((part) => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return combined || input.name;
}

export function isLoginEligibleStatus(status: EmployeeHrStatus) {
  return status === "ACTIVE" || status === "PROBATION";
}

export function serializeHrEmployee(employee: EmployeeWithHr): HrEmployeeRecord {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: displayEmployeeName(employee),
    firstName: employee.firstName,
    lastName: employee.lastName,
    nickname: employee.nickname,
    photoUrl: employee.photoUrl,
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    nationalId: employee.nationalId,
    birthDate: dateOnly(employee.birthDate),
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    employmentType: employee.employmentType,
    employmentTypeLabel: employmentTypeLabels[employee.employmentType],
    hrStatus: employee.hrStatus,
    hrStatusLabel: employeeHrStatusLabels[employee.hrStatus],
    departmentId: employee.departmentId,
    departmentName: employee.department?.name ?? null,
    positionId: employee.positionId,
    positionName: employee.position?.name ?? null,
    managerEmployeeId: employee.managerEmployeeId,
    branchName: employee.branchName,
    hiredAt: dateOnly(employee.hiredAt),
    probationEndsAt: dateOnly(employee.probationEndsAt),
    endedAt: dateOnly(employee.endedAt),
    bankAccountName: employee.bankAccountName,
    bankAccountNumber: employee.bankAccountNumber,
    bankName: employee.bankName,
    promptPay: employee.promptPay,
    notes: employee.notes,
    authUserId: employee.authUserId,
    hasAuth: Boolean(employee.authUserId),
    roleId: employee.roleId,
    roleDisplayName: employee.roleRecord?.displayName ?? null,
    hourlyRate:
      employee.hourlyRate === null ? null : Number(employee.hourlyRate),
    otHourlyRate:
      employee.otHourlyRate === null ? null : Number(employee.otHourlyRate),
    payDayOfMonth: employee.payDayOfMonth,
    defaultShiftTemplateId: employee.defaultShiftTemplateId,
    defaultShiftTemplateName: employee.defaultShiftTemplate?.name ?? null,
    isActive: employee.isActive,
  };
}

type FieldSource = Record<string, unknown>;

function readTrimmed(source: FieldSource, key: string): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalDate(
  source: FieldSource,
  key: string,
  issues: ValidationIssue[],
): Date | null | undefined {
  if (!(key in source)) return undefined;
  const raw = source[key];
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    issues.push({ path: key, message: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" });
    return undefined;
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

export type ParsedHrEmployeeInput = {
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  nationalId?: string | null;
  birthDate?: Date | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  employmentType?: EmploymentType;
  hrStatus?: EmployeeHrStatus;
  departmentId?: string | null;
  positionId?: string | null;
  managerEmployeeId?: string | null;
  branchName?: string | null;
  hiredAt?: Date | null;
  probationEndsAt?: Date | null;
  endedAt?: Date | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  promptPay?: string | null;
  notes?: string | null;
  roleId?: string | null;
  hourlyRate?: number | null;
  otHourlyRate?: number | null;
  payDayOfMonth?: number | null;
  defaultShiftTemplateId?: string | null;
  photoUrl?: string | null;
  employeeCode?: string;
  /** Compensation section — creates an EmployeeCompensation row alongside the employee. */
  dailyRate?: number;
  monthlySalary?: number;
  compensationEffectiveFrom?: Date;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseHrEmployeeInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedHrEmployeeInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedHrEmployeeInput = {};

  const firstName = readTrimmed(body, "firstName");
  if (mode === "create" || firstName !== undefined) {
    if (!firstName) {
      issues.push({ path: "firstName", message: "กรุณาระบุชื่อ" });
    } else if (firstName.length > 80) {
      issues.push({ path: "firstName", message: "ชื่อยาวเกินไป" });
    } else {
      data.firstName = firstName;
    }
  }

  const lastName = readTrimmed(body, "lastName");
  if (mode === "create" || lastName !== undefined) {
    if (lastName === undefined || lastName === "") {
      if (mode === "create") data.lastName = "";
      else if (lastName !== undefined) data.lastName = "";
    } else if (lastName.length > 80) {
      issues.push({ path: "lastName", message: "นามสกุลยาวเกินไป" });
    } else {
      data.lastName = lastName;
    }
  }

  if ("nickname" in body) {
    const nickname = readTrimmed(body, "nickname");
    data.nickname = nickname ? nickname : null;
  }

  if (mode === "create" || "email" in body) {
    const emailRaw = readTrimmed(body, "email");
    if (!emailRaw) {
      if (mode === "create") {
        issues.push({ path: "email", message: "กรุณาระบุอีเมลสำหรับสร้างบัญชีเข้าสู่ระบบ" });
      } else {
        data.email = null;
      }
    } else {
      const email = emailRaw.toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        issues.push({ path: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" });
      } else {
        data.email = email;
      }
    }
  }

  for (const key of [
    "phone",
    "address",
    "nationalId",
    "emergencyContactName",
    "emergencyContactPhone",
    "branchName",
    "bankAccountName",
    "bankAccountNumber",
    "bankName",
    "promptPay",
    "notes",
    "photoUrl",
  ] as const) {
    if (key in body) {
      const value = readTrimmed(body, key);
      data[key] = value ? value : null;
    }
  }

  const employmentType = readTrimmed(body, "employmentType");
  if (mode === "create" || employmentType !== undefined) {
    if (
      !employmentType ||
      !(employmentTypes as readonly string[]).includes(employmentType)
    ) {
      issues.push({
        path: "employmentType",
        message: "ประเภทการจ้างต้องเป็น DAILY หรือ MONTHLY",
      });
    } else {
      data.employmentType = employmentType as EmploymentType;
    }
  }

  if ("hrStatus" in body) {
    const hrStatus = readTrimmed(body, "hrStatus");
    if (
      !hrStatus ||
      !(employeeHrStatuses as readonly string[]).includes(hrStatus)
    ) {
      issues.push({ path: "hrStatus", message: "สถานะพนักงานไม่ถูกต้อง" });
    } else {
      data.hrStatus = hrStatus as EmployeeHrStatus;
    }
  } else if (mode === "create") {
    data.hrStatus = "ACTIVE";
  }

  for (const key of [
    "departmentId",
    "positionId",
    "managerEmployeeId",
    "roleId",
    "defaultShiftTemplateId",
  ] as const) {
    if (key in body) {
      const value = readTrimmed(body, key);
      if (!value) data[key] = null;
      else if (!isUuid(value)) {
        issues.push({ path: key, message: "รหัสอ้างอิงไม่ถูกต้อง" });
      } else {
        data[key] = value;
      }
    }
  }

  data.birthDate = readOptionalDate(body, "birthDate", issues);
  data.hiredAt = readOptionalDate(body, "hiredAt", issues);
  data.probationEndsAt = readOptionalDate(body, "probationEndsAt", issues);
  data.endedAt = readOptionalDate(body, "endedAt", issues);

  if ("hourlyRate" in body) {
    const raw = body.hourlyRate;
    if (raw === null || raw === "") {
      data.hourlyRate = null;
    } else {
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate < 0) {
        issues.push({ path: "hourlyRate", message: "อัตราค่าแรงไม่ถูกต้อง" });
      } else {
        data.hourlyRate = rate;
      }
    }
  }

  if ("otHourlyRate" in body) {
    const raw = body.otHourlyRate;
    if (raw === null || raw === "") {
      data.otHourlyRate = null;
    } else {
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate < 0) {
        issues.push({ path: "otHourlyRate", message: "อัตรา OT ไม่ถูกต้อง" });
      } else {
        data.otHourlyRate = rate;
      }
    }
  }

  if ("payDayOfMonth" in body) {
    const raw = body.payDayOfMonth;
    if (raw === null || raw === "") {
      data.payDayOfMonth = null;
    } else {
      const day = Number(raw);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        issues.push({
          path: "payDayOfMonth",
          message: "วันจ่ายเงินต้องเป็นจำนวนเต็ม 1–31",
        });
      } else {
        data.payDayOfMonth = day;
      }
    }
  }

  if ("dailyRate" in body) {
    const rate = Number(body.dailyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      issues.push({ path: "dailyRate", message: "ค่าแรงรายวันไม่ถูกต้อง" });
    } else {
      data.dailyRate = rate;
    }
  }

  if ("monthlySalary" in body) {
    const salary = Number(body.monthlySalary);
    if (!Number.isFinite(salary) || salary < 0) {
      issues.push({ path: "monthlySalary", message: "เงินเดือนไม่ถูกต้อง" });
    } else {
      data.monthlySalary = salary;
    }
  }

  if ("compensationEffectiveFrom" in body) {
    const parsedDate = readOptionalDate(body, "compensationEffectiveFrom", issues);
    if (parsedDate) data.compensationEffectiveFrom = parsedDate;
  }

  if ("employeeCode" in body) {
    const code = readTrimmed(body, "employeeCode");
    if (code) {
      if (code.length > 32) {
        issues.push({ path: "employeeCode", message: "รหัสพนักงานยาวเกินไป" });
      } else {
        data.employeeCode = code.toUpperCase();
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}

export function buildEmployeeDisplayName(
  firstName: string,
  lastName: string | undefined,
) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}
