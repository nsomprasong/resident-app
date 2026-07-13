import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isRaftUuid,
  parseRaftInput,
  serializeRaftMaster,
} from "@/lib/settings/rafts";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ raftId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { raftId } = await context.params;
    if (!isRaftUuid(raftId)) {
      return apiErrorResponse("ไม่พบแพ", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRaftInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลแพ", validated.issues);
    }

    const existing = await prisma.raft.findUnique({ where: { id: raftId } });
    if (!existing) {
      return apiErrorResponse("ไม่พบแพ", 404, "NOT_FOUND");
    }

    const raft = await prisma.raft.update({
      where: { id: raftId },
      data: validated.data,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "RAFT_UPDATED",
      entityType: "RAFT",
      entityId: raft.id,
      metadata: {
        number: raft.number,
        name: raft.name,
        status: raft.status,
      },
    });

    return NextResponse.json(serializeRaftMaster(raft));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("หมายเลขแพนี้มีอยู่แล้ว", [
        { path: "number", message: "หมายเลขซ้ำ" },
      ]);
    }
    console.error("PATCH /api/rafts/[raftId] failed", error);
    return apiErrorResponse("อัปเดตแพไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
