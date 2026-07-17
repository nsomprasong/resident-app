import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { deleteAuthUserById } from "@/lib/supabase/admin";
import {
  DATA_RESET_CONFIRM_PHRASE,
  DataResetDependencyError,
  DataResetSafetyError,
  countDataResetTargets,
  executeDataResetIndependently,
  hrResetTargetLabels,
  hrResetTargets,
  masterResetTargetLabels,
  masterResetTargets,
  resolveDataResetTargets,
  serviceResetTargetLabels,
  serviceResetTargets,
  supermarketResetTargetLabels,
  supermarketResetTargets,
  systemResetTargetLabels,
  systemResetTargets,
  type DataResetCategory,
  type DataResetTarget,
} from "@/lib/system/data-reset";
import { NextRequest, NextResponse } from "next/server";

function targetLabel(category: DataResetCategory, target: DataResetTarget) {
  if (category === "service") {
    return serviceResetTargetLabels[target as keyof typeof serviceResetTargetLabels] ?? target;
  }
  if (category === "hr") {
    return hrResetTargetLabels[target as keyof typeof hrResetTargetLabels] ?? target;
  }
  if (category === "master") {
    return masterResetTargetLabels[target as keyof typeof masterResetTargetLabels] ?? target;
  }
  if (category === "supermarket") {
    return (
      supermarketResetTargetLabels[
        target as keyof typeof supermarketResetTargetLabels
      ] ?? target
    );
  }
  return systemResetTargetLabels[target as keyof typeof systemResetTargetLabels] ?? target;
}

function serializeCatalog() {
  return {
    confirmPhrase: DATA_RESET_CONFIRM_PHRASE,
    service: serviceResetTargets.map((id) => ({
      id,
      label: serviceResetTargetLabels[id],
    })),
    hr: hrResetTargets.map((id) => ({
      id,
      label: hrResetTargetLabels[id],
    })),
    master: masterResetTargets.map((id) => ({
      id,
      label: masterResetTargetLabels[id],
    })),
    supermarket: supermarketResetTargets.map((id) => ({
      id,
      label: supermarketResetTargetLabels[id],
    })),
    system: systemResetTargets.map((id) => ({
      id,
      label: systemResetTargetLabels[id],
    })),
  };
}

function isDataResetCategory(value: unknown): value is DataResetCategory {
  return (
    value === "service" ||
    value === "hr" ||
    value === "master" ||
    value === "supermarket" ||
    value === "system"
  );
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
        message: "Category must be service, hr, master, supermarket, or system",
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

    const preserveEmployeeIds = currentUser?.employee?.id
      ? [currentUser.employee.id]
      : [];

    const result = await executeDataResetIndependently(
      prisma,
      category,
      resolved.targets,
      { preserveEmployeeIds },
    );

    const authCleanup: Array<{ authUserId: string; ok: boolean }> = [];
    for (const authUserId of result.orphanAuthUserIds) {
      const deleted = await deleteAuthUserById(authUserId);
      authCleanup.push({ authUserId, ok: deleted.ok });
      if (!deleted.ok) {
        console.error(
          "Auth cleanup after employee reset failed",
          authUserId,
          deleted.message,
        );
      }
    }

    const deletedTotal = Object.values(result.deleted).reduce(
      (sum, value) => sum + (value ?? 0),
      0,
    );

    if (deletedTotal === 0 && result.failed.length > 0) {
      const first = result.failed[0];
      return apiErrorResponse(
        first?.message ?? "ไม่สามารถล้างข้อมูลได้",
        409,
        "DEPENDENCY_BLOCKED",
      );
    }

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
        failed: result.failed,
        authCleanup,
      },
    });

    const counts = await countDataResetTargets(prisma);
    const failedMessages = result.failed.map(
      (item) => `${targetLabel(category, item.target)}: ${item.message}`,
    );
    return NextResponse.json({
      ok: true,
      partial: result.failed.length > 0,
      message:
        result.failed.length > 0
          ? `บางรายการลบไม่สำเร็จ — ${failedMessages.join(" | ")}`
          : undefined,
      ...result,
      counts,
      catalog: serializeCatalog(),
    });
  } catch (error) {
    if (error instanceof DataResetDependencyError) {
      return apiErrorResponse(error.message, 409, error.code);
    }
    if (error instanceof DataResetSafetyError) {
      return apiErrorResponse(error.message, 409, error.code);
    }

    const prismaCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (prismaCode === "P2003") {
      return apiErrorResponse(
        "ไม่สามารถลบได้ เพราะยังมีข้อมูลที่อ้างอิงอยู่ — ลบข้อมูลที่ขึ้นกับรายการนั้นก่อน (เช่น ขาย POS, ลงเวลา, การจอง)",
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
