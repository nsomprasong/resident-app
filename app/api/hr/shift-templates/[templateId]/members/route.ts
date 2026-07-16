import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { displayEmployeeName } from "@/lib/hr/employees";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { templateId } = await params;
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!template) {
      return apiErrorResponse("ไม่พบกะ", 404, "NOT_FOUND");
    }

    const memberships = await prisma.shiftMembership.findMany({
      where: { shiftTemplateId: templateId },
      orderBy: { createdAt: "asc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            nickname: true,
            email: true,
            employeeCode: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: memberships.map((membership) => ({
        id: membership.id,
        shiftTemplateId: membership.shiftTemplateId,
        employeeId: membership.employeeId,
        employeeName: displayEmployeeName(membership.employee),
        employeeCode: membership.employee.employeeCode,
        createdAt: membership.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET shift-template members failed", error);
    return apiErrorResponse("ไม่สามารถโหลดสมาชิกกะได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { templateId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const employeeId =
      typeof parsed.body.employeeId === "string"
        ? parsed.body.employeeId.trim()
        : "";
    if (!employeeId) {
      return validationErrorResponse("กรุณาเลือกพนักงาน", [
        { path: "employeeId", message: "ต้องระบุพนักงาน" },
      ]);
    }

    const template = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, isActive: true },
    });
    if (!template) {
      return apiErrorResponse("ไม่พบกะ", 404, "NOT_FOUND");
    }
    if (!template.isActive) {
      return apiErrorResponse("กะนี้ถูกปิดใช้งาน", 400, "TEMPLATE_INACTIVE");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        nickname: true,
        email: true,
        employeeCode: true,
        isActive: true,
        hrStatus: true,
      },
    });
    if (
      !employee ||
      !employee.isActive ||
      !["ACTIVE", "PROBATION"].includes(employee.hrStatus)
    ) {
      return apiErrorResponse(
        "พนักงานนี้ไม่สามารถจัดลงกะได้",
        400,
        "EMPLOYEE_INACTIVE",
      );
    }

    const existingMembership = await prisma.shiftMembership.findUnique({
      where: { employeeId },
      include: {
        shiftTemplate: { select: { id: true, name: true } },
      },
    });
    if (existingMembership) {
      return apiErrorResponse(
        `พนักงานนี้อยู่กะ “${existingMembership.shiftTemplate.name}” แล้ว — ถอดจากกะเดิมก่อน`,
        409,
        "ALREADY_ASSIGNED",
      );
    }

    const membership = await prisma.$transaction(async (tx) => {
      const created = await tx.shiftMembership.create({
        data: {
          shiftTemplateId: templateId,
          employeeId,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              nickname: true,
              email: true,
              employeeCode: true,
            },
          },
        },
      });
      await tx.employee.update({
        where: { id: employeeId },
        data: { defaultShiftTemplateId: templateId },
      });
      return created;
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_MEMBER_ADDED",
      entityType: "SHIFT_MEMBERSHIP",
      entityId: membership.id,
      metadata: {
        shiftTemplateId: templateId,
        employeeId,
        shiftName: template.name,
      },
    });

    return NextResponse.json(
      {
        id: membership.id,
        shiftTemplateId: membership.shiftTemplateId,
        employeeId: membership.employeeId,
        employeeName: displayEmployeeName(membership.employee),
        employeeCode: membership.employee.employeeCode,
        createdAt: membership.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse("พนักงานนี้อยู่ในกะอื่นแล้ว", 409, "ALREADY_ASSIGNED");
    }
    console.error("POST shift-template members failed", error);
    return apiErrorResponse("ไม่สามารถเพิ่มสมาชิกกะได้", 500, "INTERNAL_ERROR");
  }
}
