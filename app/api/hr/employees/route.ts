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
  isProtectedSupportEmail,
  protectedSupportEmployeeWhere,
  supportAccountForbiddenResponseMessage,
} from "@/lib/auth/support-account";
import {
  buildEmployeeDisplayName,
  isLoginEligibleStatus,
  parseHrEmployeeInput,
  serializeHrEmployee,
} from "@/lib/hr/employees";
import { prisma } from "@/lib/prisma";
import { resolveAuthUserIdForEmail } from "@/lib/supabase/admin";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const employeeInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  roleRecord: { select: { id: true, displayName: true } },
  defaultShiftTemplate: { select: { id: true, name: true } },
} as const;

async function nextEmployeeCode() {
  const latest = await prisma.employee.findFirst({
    where: { employeeCode: { startsWith: "EMP-" } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  const current = Number(latest?.employeeCode?.replace("EMP-", "") ?? "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `EMP-${String(next).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const employmentType = searchParams.get("employmentType");
    const hrStatus = searchParams.get("hrStatus");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20),
    );

    const currentUser = await getCurrentUser();
    const supportWhere = await protectedSupportEmployeeWhere({
      email: currentUser?.user.email,
      authUserId: currentUser?.user.id,
    });
    const where: Prisma.EmployeeWhereInput = {
      AND: [supportWhere],
    };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }
    if (employmentType === "DAILY" || employmentType === "MONTHLY") {
      where.employmentType = employmentType;
    }
    if (hrStatus) {
      where.hrStatus = hrStatus as Prisma.EnumEmployeeHrStatusFilter;
    }

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      items: items.map(serializeHrEmployee),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("GET /api/hr/employees failed", error);
    return apiErrorResponse("ไม่สามารถโหลดพนักงานได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseHrEmployeeInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", validated.issues);
    }

    const {
      firstName,
      lastName = "",
      employmentType = "MONTHLY",
      hrStatus = "ACTIVE",
      ...rest
    } = validated.data;

    if (!firstName) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
        { path: "firstName", message: "กรุณาระบุชื่อ" },
      ]);
    }

    if (
      typeof rest.email === "string" &&
      isProtectedSupportEmail(rest.email) &&
      !canActorAccessSupportEmployee(currentUser?.user.email, rest.email)
    ) {
      const existingSupport = await prisma.employee.findFirst({
        where: { email: { equals: rest.email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingSupport) {
        return apiErrorResponse(
          supportAccountForbiddenResponseMessage(),
          403,
          "SUPPORT_ACCOUNT_PROTECTED",
        );
      }
    }

    if (rest.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: rest.roleId },
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

    if (!rest.email) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
        { path: "email", message: "กรุณาระบุอีเมลสำหรับสร้างบัญชีเข้าสู่ระบบ" },
      ]);
    }
    const email = rest.email;

    const emailOwner = await prisma.employee.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (emailOwner) {
      return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
        { path: "email", message: "อีเมลซ้ำ" },
      ]);
    }

    if (rest.defaultShiftTemplateId) {
      const template = await prisma.shiftTemplate.findUnique({
        where: { id: rest.defaultShiftTemplateId },
        select: { id: true },
      });
      if (!template) {
        return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
          { path: "defaultShiftTemplateId", message: "ไม่พบกะที่เลือก" },
        ]);
      }
    }

    // Create the Supabase Auth user first (server-only, service role) so every
    // new employee is guaranteed to have login credentials from step one.
    const authResolved = await resolveAuthUserIdForEmail(email);
    if (!authResolved.ok) {
      return apiErrorResponse(authResolved.message, 502, "AUTH_PROVISION_FAILED");
    }

    const authOwner = await prisma.employee.findUnique({
      where: { authUserId: authResolved.authUserId },
      select: { id: true },
    });
    if (authOwner) {
      return validationErrorResponse(
        "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
        [{ path: "email", message: "authUserId ซ้ำ" }],
      );
    }

    const employeeCode = validated.data.employeeCode ?? (await nextEmployeeCode());
    const name = buildEmployeeDisplayName(firstName, lastName);

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            employeeCode,
            firstName,
            lastName,
            name,
            employmentType,
            hrStatus,
            isActive: isLoginEligibleStatus(hrStatus),
            nickname: rest.nickname,
            email,
            authUserId: authResolved.authUserId,
            mustResetPassword: authResolved.created,
            phone: rest.phone,
            address: rest.address,
            nationalId: rest.nationalId,
            birthDate: rest.birthDate,
            emergencyContactName: rest.emergencyContactName,
            emergencyContactPhone: rest.emergencyContactPhone,
            departmentId: rest.departmentId,
            positionId: rest.positionId,
            managerEmployeeId: rest.managerEmployeeId,
            branchName: rest.branchName,
            hiredAt: rest.hiredAt,
            probationEndsAt: rest.probationEndsAt,
            endedAt: rest.endedAt,
            bankAccountName: rest.bankAccountName,
            bankAccountNumber: rest.bankAccountNumber,
            bankName: rest.bankName,
            promptPay: rest.promptPay,
            notes: rest.notes,
            roleId: rest.roleId,
            hourlyRate: rest.hourlyRate,
            otHourlyRate: rest.otHourlyRate,
            payDayOfMonth: rest.payDayOfMonth,
            defaultShiftTemplateId: rest.defaultShiftTemplateId,
            photoUrl: rest.photoUrl,
          },
          include: employeeInclude,
        });

        if (rest.dailyRate !== undefined || rest.monthlySalary !== undefined) {
          await tx.employeeCompensation.create({
            data: {
              employeeId: employee.id,
              employmentType,
              dailyRate: rest.dailyRate ?? 0,
              hourlyRate: rest.hourlyRate ?? 0,
              monthlySalary: rest.monthlySalary ?? 0,
              effectiveFrom:
                rest.compensationEffectiveFrom ?? rest.hiredAt ?? new Date(),
              isActive: true,
            },
          });
        }

        return employee;
      });
    } catch (createError) {
      // Auth user already exists at this point; a retry with the same email
      // will find and reuse it via resolveAuthUserIdForEmail (no orphan risk).
      console.error(
        "POST /api/hr/employees failed after auth provisioning",
        { authUserCreated: authResolved.created, email },
        createError,
      );
      throw createError;
    }

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_EMPLOYEE_CREATED",
      entityType: "EMPLOYEE",
      entityId: created.id,
      metadata: {
        employeeCode: created.employeeCode,
        employmentType: created.employmentType,
        hrStatus: created.hrStatus,
        authUserCreated: authResolved.created,
      },
    });

    return NextResponse.json(serializeHrEmployee(created), { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse(
        "รหัสหรืออีเมลซ้ำในระบบ กรุณาลองบันทึกใหม่ (บัญชี Auth ที่สร้างไว้จะถูกใช้ซ้ำ ไม่สร้างซ้ำ)",
        409,
        "CONFLICT",
      );
    }
    console.error("POST /api/hr/employees failed", error);
    return apiErrorResponse("ไม่สามารถสร้างพนักงานได้", 500, "INTERNAL_ERROR");
  }
}
