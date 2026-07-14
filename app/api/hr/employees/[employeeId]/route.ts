import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  assertActorMayAssignRoleCode,
  canActorAccessSupportEmployee,
  canActorMutateSupportEmployee,
  isProtectedSupportEmail,
  isProtectedSupportEmployeeRecord,
  supportAccountForbiddenResponseMessage,
} from "@/lib/auth/support-account";
import {
  buildEmployeeDisplayName,
  isLoginEligibleStatus,
  parseHrEmployeeInput,
  serializeHrEmployee,
} from "@/lib/hr/employees";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const employeeInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  roleRecord: { select: { id: true, displayName: true } },
  defaultShiftTemplate: { select: { id: true, name: true } },
} as const;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: employeeInclude,
    });
    if (!employee) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    if (
      !(await canActorMutateSupportEmployee(
        {
          email: currentUser?.user.email,
          authUserId: currentUser?.user.id,
        },
        employee,
      ))
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    return NextResponse.json(serializeHrEmployee(employee));
  } catch (error) {
    console.error("GET /api/hr/employees/[id] failed", error);
    return apiErrorResponse("ไม่สามารถโหลดพนักงานได้", 500, "INTERNAL_ERROR");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        hrStatus: true,
        email: true,
        authUserId: true,
      },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    if (
      !(await canActorMutateSupportEmployee(
        {
          email: currentUser?.user.email,
          authUserId: currentUser?.user.id,
        },
        existing,
      ))
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    const validated = parseHrEmployeeInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", validated.issues);
    }

    if (
      validated.data.hrStatus === "ARCHIVED" &&
      !permissions.includes("hr.employee.archive")
    ) {
      return apiErrorResponse(
        "ไม่มีสิทธิ์เก็บถาวรพนักงาน",
        403,
        "FORBIDDEN",
      );
    }

    if (
      (await isProtectedSupportEmployeeRecord(existing)) &&
      validated.data.hrStatus === "ARCHIVED"
    ) {
      return apiErrorResponse(
        "ห้ามเก็บถาวรบัญชี support ของระบบ",
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    if (
      typeof validated.data.email === "string" &&
      isProtectedSupportEmail(validated.data.email) &&
      !canActorAccessSupportEmployee(
        currentUser?.user.email,
        validated.data.email,
      )
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    if (validated.data.roleId !== undefined) {
      if (validated.data.roleId) {
        const role = await prisma.role.findUnique({
          where: { id: validated.data.roleId },
          select: { code: true },
        });
        const adminRoleCheck = assertActorMayAssignRoleCode(
          currentUser?.user.email,
          role?.code,
        );
        if (!adminRoleCheck.ok) {
          return apiErrorResponse(
            adminRoleCheck.message,
            403,
            "SYSTEM_ADMIN_ROLE_PROTECTED",
          );
        }
      }
    }

    const firstName = validated.data.firstName ?? existing.firstName ?? "";
    const lastName =
      validated.data.lastName !== undefined
        ? validated.data.lastName
        : (existing.lastName ?? "");
    const hrStatus = validated.data.hrStatus ?? existing.hrStatus;
    const patch = validated.data;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
        ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
        ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.nationalId !== undefined
          ? { nationalId: patch.nationalId }
          : {}),
        ...(patch.birthDate !== undefined ? { birthDate: patch.birthDate } : {}),
        ...(patch.emergencyContactName !== undefined
          ? { emergencyContactName: patch.emergencyContactName }
          : {}),
        ...(patch.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: patch.emergencyContactPhone }
          : {}),
        ...(patch.employmentType !== undefined
          ? { employmentType: patch.employmentType }
          : {}),
        ...(patch.hrStatus !== undefined ? { hrStatus: patch.hrStatus } : {}),
        ...(patch.departmentId !== undefined
          ? { departmentId: patch.departmentId }
          : {}),
        ...(patch.positionId !== undefined
          ? { positionId: patch.positionId }
          : {}),
        ...(patch.managerEmployeeId !== undefined
          ? { managerEmployeeId: patch.managerEmployeeId }
          : {}),
        ...(patch.branchName !== undefined
          ? { branchName: patch.branchName }
          : {}),
        ...(patch.hiredAt !== undefined ? { hiredAt: patch.hiredAt } : {}),
        ...(patch.probationEndsAt !== undefined
          ? { probationEndsAt: patch.probationEndsAt }
          : {}),
        ...(patch.endedAt !== undefined ? { endedAt: patch.endedAt } : {}),
        ...(patch.bankAccountName !== undefined
          ? { bankAccountName: patch.bankAccountName }
          : {}),
        ...(patch.bankAccountNumber !== undefined
          ? { bankAccountNumber: patch.bankAccountNumber }
          : {}),
        ...(patch.bankName !== undefined ? { bankName: patch.bankName } : {}),
        ...(patch.promptPay !== undefined ? { promptPay: patch.promptPay } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.roleId !== undefined ? { roleId: patch.roleId } : {}),
        ...(patch.hourlyRate !== undefined
          ? { hourlyRate: patch.hourlyRate }
          : {}),
        ...(patch.otHourlyRate !== undefined
          ? { otHourlyRate: patch.otHourlyRate }
          : {}),
        ...(patch.payDayOfMonth !== undefined
          ? { payDayOfMonth: patch.payDayOfMonth }
          : {}),
        ...(patch.defaultShiftTemplateId !== undefined
          ? { defaultShiftTemplateId: patch.defaultShiftTemplateId }
          : {}),
        ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
        ...(patch.employeeCode !== undefined
          ? { employeeCode: patch.employeeCode }
          : {}),
        name: buildEmployeeDisplayName(firstName, lastName || undefined),
        isActive: isLoginEligibleStatus(hrStatus),
      },
      include: employeeInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_EMPLOYEE_UPDATED",
      entityType: "EMPLOYEE",
      entityId: updated.id,
      metadata: {
        previousStatus: existing.hrStatus,
        hrStatus: updated.hrStatus,
        fields: Object.keys(validated.data),
      },
    });

    return NextResponse.json(serializeHrEmployee(updated));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse("รหัสหรืออีเมลซ้ำในระบบ", 409, "CONFLICT");
    }
    console.error("PATCH /api/hr/employees/[id] failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกพนักงานได้", 500, "INTERNAL_ERROR");
  }
}
