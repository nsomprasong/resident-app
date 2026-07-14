import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  DATA_RESET_CONFIRM_PHRASE,
  countDataResetTargets,
  executeDataReset,
  masterResetTargetLabels,
  masterResetTargets,
  resolveDataResetTargets,
  serviceResetTargetLabels,
  serviceResetTargets,
  supermarketResetTargetLabels,
  supermarketResetTargets,
  type DataResetCategory,
} from "@/lib/system/data-reset";
import { NextRequest, NextResponse } from "next/server";

function serializeCatalog() {
  return {
    confirmPhrase: DATA_RESET_CONFIRM_PHRASE,
    service: serviceResetTargets.map((id) => ({
      id,
      label: serviceResetTargetLabels[id],
    })),
    master: masterResetTargets.map((id) => ({
      id,
      label: masterResetTargetLabels[id],
    })),
    supermarket: supermarketResetTargets.map((id) => ({
      id,
      label: supermarketResetTargetLabels[id],
    })),
  };
}

function isDataResetCategory(value: unknown): value is DataResetCategory {
  return value === "service" || value === "master" || value === "supermarket";
}

export async function GET() {
  try {
    const counts = await countDataResetTargets(prisma);
    return NextResponse.json({
      ...serializeCatalog(),
      counts,
    });
  } catch (error) {
    console.error("GET /api/system/data-reset failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดสรุปข้อมูลได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const categoryValue = parsed.body.category;
    const targetsValue = parsed.body.targets;
    const confirmValue = parsed.body.confirm;

    if (!isDataResetCategory(categoryValue)) {
      issues.push({
        path: "category",
        message: "Category must be service, master, or supermarket",
      });
    }
    if (confirmValue !== DATA_RESET_CONFIRM_PHRASE) {
      issues.push({
        path: "confirm",
        message: `Confirm phrase must be exactly "${DATA_RESET_CONFIRM_PHRASE}"`,
      });
    }
    if (
      targetsValue !== "all" &&
      !(
        Array.isArray(targetsValue) &&
        targetsValue.every((item) => typeof item === "string")
      )
    ) {
      issues.push({
        path: "targets",
        message: 'Targets must be "all" or a string array',
      });
    }
    if (issues.length) {
      return validationErrorResponse(
        "กรุณายืนยันการล้างข้อมูลให้ถูกต้อง",
        issues,
      );
    }

    const category = categoryValue as DataResetCategory;
    const resolved = resolveDataResetTargets(
      category,
      targetsValue as "all" | string[],
    );
    if (!resolved.ok) {
      return apiErrorResponse(resolved.message, 400, "INVALID_TARGETS");
    }

    const result = await prisma.$transaction(
      async (tx) => executeDataReset(tx, category, resolved.targets),
      { timeout: 60_000 },
    );

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "DATA_RESET_EXECUTED",
      entityType: "SYSTEM",
      entityId: category,
      metadata: {
        category,
        targets: result.targets,
        deleted: result.deleted,
      },
    });

    const counts = await countDataResetTargets(prisma);
    return NextResponse.json({
      ok: true,
      ...result,
      counts,
      catalog: serializeCatalog(),
    });
  } catch (error) {
    const prismaCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (prismaCode === "P2003") {
      return apiErrorResponse(
        "ไม่สามารถลบได้ เพราะยังมีข้อมูลที่อ้างอิงอยู่ — ลบข้อมูลขายซูเปอร์มาร์เก็ตหรือข้อมูลบริการที่เกี่ยวข้องก่อน",
        409,
        "DEPENDENCY_BLOCKED",
      );
    }

    const pgMessage =
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "message" in error.cause &&
      typeof error.cause.message === "string"
        ? error.cause.message
        : null;

    if (pgMessage?.includes("audit_logs are immutable")) {
      return apiErrorResponse(
        "ไม่สามารถลบบันทึกตรวจสอบได้ในขณะนี้ — ลองลบรายการอื่นก่อน หรืออัปเดตระบบแล้วลองใหม่",
        409,
        "AUDIT_IMMUTABLE",
      );
    }

    console.error("POST /api/system/data-reset failed", error);
    return apiErrorResponse(
      "ไม่สามารถล้างข้อมูลได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
