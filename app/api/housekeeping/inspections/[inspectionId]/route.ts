import {
  ChargeType,
  InspectionItemType,
  InspectionStatus,
  RoomStatus,
} from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type InspectionItemInput = {
  catalogId: string;
  type: InspectionItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
};

function parseOptionalImageUrl(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    issues.push({ path, message: "imageUrl must be a string" });
    return { ok: false };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^https?:\/\//i.test(trimmed) || trimmed.length > 2000) {
    issues.push({ path, message: "imageUrl must be a valid http(s) URL" });
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> },
) {
  try {
    const { inspectionId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const notes =
      parsed.body.notes === undefined
        ? undefined
        : typeof parsed.body.notes === "string"
          ? parsed.body.notes.trim()
          : null;
    const complete = parsed.body.complete;
    const itemsValue = parsed.body.items;
    const items: InspectionItemInput[] = [];

    if (notes === null) {
      issues.push({ path: "notes", message: "Inspection notes must be a string" });
    }
    if (complete !== undefined && typeof complete !== "boolean") {
      issues.push({ path: "complete", message: "Complete flag must be boolean" });
    }
    if (itemsValue !== undefined && !Array.isArray(itemsValue)) {
      issues.push({ path: "items", message: "Inspection items must be an array" });
    }
    if (Array.isArray(itemsValue)) {
      itemsValue.forEach((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          issues.push({
            path: `items.${index}`,
            message: "Inspection item must be an object",
          });
          return;
        }

        const itemRecord = item as Record<string, unknown>;
        const catalogId =
          typeof itemRecord.catalogId === "string" ? itemRecord.catalogId.trim() : "";
        const description =
          typeof itemRecord.description === "string"
            ? itemRecord.description.trim()
            : "";
        const quantity = Number(itemRecord.quantity);
        const unitPrice = Number(itemRecord.unitPrice);
        const type = itemRecord.type;
        const imageUrlParsed = parseOptionalImageUrl(
          itemRecord.imageUrl,
          `items.${index}.imageUrl`,
          issues,
        );

        if (!catalogId) {
          issues.push({
            path: `items.${index}.catalogId`,
            message: "Inspection catalog id is required",
          });
        }
        if (!description) {
          issues.push({
            path: `items.${index}.description`,
            message: "Inspection item description is required",
          });
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          issues.push({
            path: `items.${index}.quantity`,
            message: "Inspection item quantity must be greater than 0",
          });
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          issues.push({
            path: `items.${index}.unitPrice`,
            message: "Inspection item unit price must be 0 or greater",
          });
        }
        if (
          typeof type !== "string" ||
          !Object.values(InspectionItemType).includes(type as InspectionItemType)
        ) {
          issues.push({
            path: `items.${index}.type`,
            message: "Inspection item type is invalid",
          });
        }

        if (
          catalogId &&
          description &&
          Number.isFinite(quantity) &&
          quantity > 0 &&
          Number.isFinite(unitPrice) &&
          unitPrice >= 0 &&
          typeof type === "string" &&
          Object.values(InspectionItemType).includes(type as InspectionItemType) &&
          imageUrlParsed.ok
        ) {
          items.push({
            catalogId,
            description,
            quantity,
            unitPrice,
            type: type as InspectionItemType,
            imageUrl: imageUrlParsed.value,
          });
        }
      });
    }
    if (issues.length)
      return validationErrorResponse(
        "พบรายการที่ไม่มีในราคากลาง กรุณาเลือกใหม่",
        issues,
      );

    const result = await prisma.$transaction(async (tx) => {
      const catalogs = await tx.inspectionCatalog.findMany({
        where: {
          id: {
            in: items
              .map((item) => item.catalogId)
              .filter((id): id is string => Boolean(id)),
          },
          isActive: true,
        },
      });
      if (catalogs.length !== items.length) throw new Error("INVALID_CATALOG");
      const catalogMap = new Map(catalogs.map((item) => [item.id, item]));
      const pricedItems = items.map((item) => {
        const catalog = catalogMap.get(item.catalogId!);
        if (!catalog) throw new Error("INVALID_CATALOG");
        return {
          catalogId: catalog.id,
          type: catalog.type,
          description: catalog.name,
          quantity: item.quantity,
          unitPrice: Number(catalog.unitPrice),
          imageUrl: item.imageUrl,
        };
      });
      const current = await tx.roomInspection.findUnique({
        where: { id: inspectionId },
        include: {
          charge: true,
          bookingRoom: {
            include: {
              room: true,
              booking: {
                include: {
                  charges: true,
                  payments: { where: { status: "PAID" } },
                  orders: {
                    where: { status: { not: "CANCELLED" } },
                    include: { items: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!current) throw new Error("NOT_FOUND");
      const booking = current.bookingRoom.booking;
      await tx.inspectionItem.deleteMany({ where: { inspectionId } });
      if (pricedItems.length)
        await tx.inspectionItem.createMany({
          data: pricedItems.map((item) => ({
            inspectionId,
            catalogId: item.catalogId,
            type: item.type,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            imageUrl: item.imageUrl,
          })),
        });
      const completed =
        complete || current.status === InspectionStatus.COMPLETED;
      const completedById = completed
        ? (current.completedById ?? currentUser?.employee?.id ?? null)
        : null;
      const updatedInspection = await tx.roomInspection.update({
        where: { id: inspectionId },
        data: {
          notes: notes || null,
          status: completed
            ? InspectionStatus.COMPLETED
            : InspectionStatus.IN_PROGRESS,
          completedAt: completed ? (current.completedAt ?? new Date()) : null,
          completedById,
        },
        select: { id: true, status: true, completedById: true },
      });
      if (completed)
        await tx.room.update({
          where: { id: current.bookingRoom.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      const amount = pricedItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const description = pricedItems.length
        ? `ตรวจห้อง ${current.bookingRoom.room.number}: ${pricedItems.map((item) => `${item.description} x${item.quantity}`).join(", ")}`
        : `ตรวจห้อง ${current.bookingRoom.room.number}: ไม่มีค่าใช้จ่ายเพิ่ม`;
      if (amount > 0)
        await tx.charge.upsert({
          where: { inspectionId },
          update: { amount, description },
          create: {
            bookingId: booking.id,
            inspectionId,
            type: ChargeType.OTHER,
            description,
            amount,
          },
        });
      else if (current.charge)
        await tx.charge.delete({ where: { id: current.charge.id } });
      return {
        inspectionId: updatedInspection.id,
        bookingId: booking.id,
        status: updatedInspection.status,
        itemCount: pricedItems.length,
        chargeAmount: amount,
      };
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HOUSEKEEPING_INSPECTION_UPDATED",
      entityType: "ROOM_INSPECTION",
      entityId: result.inspectionId,
      metadata: {
        bookingId: result.bookingId,
        status: result.status,
        itemCount: result.itemCount,
        chargeAmount: result.chargeAmount,
        completedById: result.status === InspectionStatus.COMPLETED
          ? currentUser?.employee?.id ?? null
          : null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND")
      return apiErrorResponse("ไม่พบรายการตรวจห้อง", 404, "NOT_FOUND");
    if (message === "INVALID_CATALOG")
      return apiErrorResponse(
        "พบรายการที่ไม่มีในราคากลาง กรุณาเลือกใหม่",
        400,
        "INVALID_CATALOG",
      );
    console.error("PATCH inspection failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกผลตรวจได้", 500, "INTERNAL_ERROR");
  }
}
