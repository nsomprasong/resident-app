import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseRoleInput, serializeRole } from "@/lib/settings/roles";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
    return NextResponse.json(roles.map(serializeRole));
  } catch (error) {
    console.error("GET /api/roles failed", error);
    return apiErrorResponse("ไม่สามารถโหลด roles ได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoleInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูล role", validated.issues);
    }

    const { code, displayName } = validated.data;
    if (!code || !displayName) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูล role", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const role = await prisma.role.create({
      data: {
        code,
        displayName,
        isActive: true,
      },
      include: { _count: { select: { employees: true } } },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROLE_CREATED",
      entityType: "ROLE",
      entityId: role.id,
      metadata: { code: role.code, displayName: role.displayName },
    });

    return NextResponse.json(serializeRole(role), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("รหัส role นี้มีอยู่แล้ว", [
        { path: "code", message: "รหัสซ้ำ" },
      ]);
    }
    console.error("POST /api/roles failed", error);
    return apiErrorResponse("เพิ่ม role ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
