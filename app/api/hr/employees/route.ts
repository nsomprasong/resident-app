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
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const employeeInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  roleRecord: { select: { id: true, displayName: true } },
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

    const employeeCode = validated.data.employeeCode ?? (await nextEmployeeCode());
    const name = buildEmployeeDisplayName(firstName, lastName);

    const created = await prisma.employee.create({
      data: {
        employeeCode,
        firstName,
        lastName,
        name,
        employmentType,
        hrStatus,
        isActive: isLoginEligibleStatus(hrStatus),
        nickname: rest.nickname,
        email: rest.email,
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
        photoUrl: rest.photoUrl,
      },
      include: employeeInclude,
    });

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
      return apiErrorResponse("รหัสหรืออีเมลซ้ำในระบบ", 409, "CONFLICT");
    }
    console.error("POST /api/hr/employees failed", error);
    return apiErrorResponse("ไม่สามารถสร้างพนักงานได้", 500, "INTERNAL_ERROR");
  }
}
