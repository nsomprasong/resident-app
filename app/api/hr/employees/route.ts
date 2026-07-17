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
import { nextEmployeeCode } from "@/lib/hr/employee-codes";
import {
  buildEmployeeDisplayName,
  isLoginEligibleStatus,
  parseHrEmployeeInput,
  serializeHrEmployee,
} from "@/lib/hr/employees";
import { syncActiveEmployeeCompensation } from "@/lib/hr/employee-compensation";
import { prisma } from "@/lib/prisma";
import {
  createEmployeeAuthUser,
  createTemporaryPassword,
  deleteAuthUserById,
} from "@/lib/supabase/admin";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

/** Auth user provisioning can exceed the default serverless budget. */
export const maxDuration = 30;

const employeeInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  roleRecord: { select: { id: true, displayName: true } },
  defaultShiftTemplate: { select: { id: true, name: true } },
  compensations: {
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
    select: { dailyRate: true, monthlySalary: true, hourlyRate: true },
  },
} as const;

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
        { username: { contains: q, mode: "insensitive" } },
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
  let createdAuthUserId: string | null = null;
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
      username,
      phone,
      email = null,
      ...rest
    } = validated.data;

    if (!firstName || !username || !phone) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
        {
          path: "body",
          message: "ต้องระบุชื่อ, Username และเบอร์โทรศัพท์",
        },
      ]);
    }

    if (
      typeof email === "string" &&
      isProtectedSupportEmail(email) &&
      !canActorAccessSupportEmployee(currentUser?.user.email, email)
    ) {
      const existingSupport = await prisma.employee.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
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

    const usernameOwner = await prisma.employee.findUnique({
      where: { username },
      select: { id: true },
    });
    if (usernameOwner) {
      return validationErrorResponse("Username นี้ถูกใช้แล้ว", [
        { path: "username", message: "Username ซ้ำ" },
      ]);
    }

    const phoneOwner = await prisma.employee.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (phoneOwner) {
      return validationErrorResponse("เบอร์โทรนี้ถูกใช้แล้ว", [
        { path: "phone", message: "เบอร์โทรซ้ำ" },
      ]);
    }

    if (email) {
      const emailOwner = await prisma.employee.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (emailOwner) {
        return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
          { path: "email", message: "อีเมลซ้ำ" },
        ]);
      }
    }

    if (rest.defaultShiftTemplateId) {
      const template = await prisma.shiftTemplate.findUnique({
        where: { id: rest.defaultShiftTemplateId },
        select: { id: true, isActive: true },
      });
      if (!template) {
        return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
          { path: "defaultShiftTemplateId", message: "ไม่พบกะที่เลือก" },
        ]);
      }
      if (!template.isActive) {
        return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
          {
            path: "defaultShiftTemplateId",
            message: "กะประจำต้องเป็นกะที่ยังใช้งานได้",
          },
        ]);
      }
    }

    // Temporary password is never shown — employee sets their own on first login.
    // Auth identity uses username-bound email (not Employee.email); Phone Auth login
    // is often disabled in Supabase even when Admin can create phone users.
    const authResolved = await createEmployeeAuthUser({
      username,
      phone,
      password: createTemporaryPassword(),
    });
    if (!authResolved.ok) {
      return apiErrorResponse(authResolved.message, 502, "AUTH_PROVISION_FAILED");
    }
    createdAuthUserId = authResolved.authUserId;

    const authOwner = await prisma.employee.findUnique({
      where: { authUserId: authResolved.authUserId },
      select: { id: true },
    });
    if (authOwner) {
      await deleteAuthUserById(authResolved.authUserId);
      createdAuthUserId = null;
      return validationErrorResponse(
        "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
        [{ path: "phone", message: "authUserId ซ้ำ" }],
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
            username,
            phone,
            email,
            authUserId: authResolved.authUserId,
            mustResetPassword: true,
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

        if (
          rest.dailyRate !== undefined ||
          rest.monthlySalary !== undefined ||
          rest.hourlyRate !== undefined
        ) {
          await syncActiveEmployeeCompensation(tx, employee.id, {
            employmentType,
            hourlyRate: rest.hourlyRate ?? null,
            dailyRate: rest.dailyRate,
            monthlySalary: rest.monthlySalary,
            effectiveFrom:
              rest.compensationEffectiveFrom ?? rest.hiredAt ?? new Date(),
          });
        }

        if (rest.defaultShiftTemplateId) {
          await tx.shiftMembership.create({
            data: {
              employeeId: employee.id,
              shiftTemplateId: rest.defaultShiftTemplateId,
            },
          });
        }

        return tx.employee.findUniqueOrThrow({
          where: { id: employee.id },
          include: employeeInclude,
        });
      });
    } catch (createError) {
      await deleteAuthUserById(authResolved.authUserId);
      createdAuthUserId = null;
      throw createError;
    }

    createdAuthUserId = null;

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
        authMode: "username_auth_email",
        username: created.username,
        authUserCreated: true,
        mustResetPassword: true,
      },
    });

    return NextResponse.json(serializeHrEmployee(created), { status: 201 });
  } catch (error) {
    if (createdAuthUserId) {
      await deleteAuthUserById(createdAuthUserId);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");
      if (target.includes("username")) {
        return validationErrorResponse("Username นี้ถูกใช้แล้ว", [
          { path: "username", message: "Username ซ้ำ" },
        ]);
      }
      if (target.includes("phone")) {
        return validationErrorResponse("เบอร์โทรนี้ถูกใช้แล้ว", [
          { path: "phone", message: "เบอร์โทรซ้ำ" },
        ]);
      }
      if (target.includes("email")) {
        return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
          { path: "email", message: "อีเมลซ้ำ" },
        ]);
      }
      return apiErrorResponse("ข้อมูลซ้ำในระบบ", 409, "CONFLICT");
    }
    console.error("POST /api/hr/employees failed", error);
    return apiErrorResponse("ไม่สามารถสร้างพนักงานได้", 500, "INTERNAL_ERROR");
  }
}
