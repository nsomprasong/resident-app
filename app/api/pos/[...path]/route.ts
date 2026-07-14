import { PosCashMovementType, PosPaymentMethod, PosStockMovementType, Prisma } from "@/generated/prisma/client";
import { apiErrorResponse, isRecord, readJsonObject } from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { employeeHasApiPermission, resolveApiPermission } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
import { money } from "@/lib/pos/money";
import { getPosSalesReport } from "@/lib/pos/reports";
import { refundSale } from "@/lib/pos/refunds";
import { cancelSale, createSale } from "@/lib/pos/sales";
import { getPosSettings } from "@/lib/pos/settings";
import { closeShift, openShift, approveShift } from "@/lib/pos/shifts";
import { nextHoldNumber, nextStockDocumentNumber } from "@/lib/pos/sequences";
import { applyStockChange } from "@/lib/pos/stock";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ path: string[] }> };
const paymentMethods = new Set(Object.values(PosPaymentMethod));

async function authorized(request: NextRequest) {
  const current = await getCurrentUser();
  const required = resolveApiPermission(request.method, request.nextUrl.pathname);
  const employee = current?.employee;
  if (!current || !employee?.isActive || !employee.role?.isActive || !required || !employeeHasApiPermission(employee.role.permissions, required)) {
    return null;
  }
  return { employeeId: employee.id, authUserId: current.user.id };
}

function text(body: Record<string, unknown>, name: string): string;
function text(body: Record<string, unknown>, name: string, required: false): string | undefined;
function text(body: Record<string, unknown>, name: string, required = true): string | undefined {
  const value = body[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new Error(`INVALID_${name.toUpperCase()}`);
  return undefined;
}
function numberValue(body: Record<string, unknown>, name: string, fallback?: number) {
  const value = body[name];
  if (typeof value === "number" || typeof value === "string") return money(value);
  if (fallback !== undefined) return money(fallback);
  throw new Error(`INVALID_${name.toUpperCase()}`);
}
async function body(request: NextRequest) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed;
  return parsed;
}
function asJson(value: unknown): Prisma.InputJsonValue {
  if (value === null) throw new Error("INVALID_JSON");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(asJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asJson(item)])) as Prisma.InputJsonObject;
  }
  throw new Error("INVALID_JSON");
}

export async function GET(request: NextRequest, context: Context) {
  const actor = await authorized(request);
  if (!actor) return apiErrorResponse("ไม่มีสิทธิ์เข้าถึง", 403, "FORBIDDEN");
  const path = (await context.params).path.join("/");
  try {
    if (path === "categories") return NextResponse.json(await prisma.posCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
    if (path === "products") {
      const query = request.nextUrl.searchParams.get("q")?.trim();
      return NextResponse.json(await prisma.posProduct.findMany({ where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }, { barcode: query }] } : undefined, include: { category: true }, orderBy: { name: "asc" } }));
    }
    if (path === "stock/ledger") {
      const productId = request.nextUrl.searchParams.get("productId");
      if (!productId) return apiErrorResponse("กรุณาระบุสินค้า", 400, "INVALID_PRODUCT_ID");
      return NextResponse.json(await prisma.posStockMovement.findMany({ where: { productId }, orderBy: { occurredAt: "desc" } }));
    }
    if (path === "shifts") return NextResponse.json(await prisma.posShift.findMany({ include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } }, orderBy: { openedAt: "desc" } }));
    if (path === "shifts/current") {
      return NextResponse.json(
        await prisma.posShift.findFirst({
          where: { openedById: actor.employeeId, status: "OPEN" },
          include: {
            cashMovements: true,
            openedBy: { select: { name: true } },
            closedBy: { select: { name: true } },
          },
        }),
      );
    }
    if (path === "sales") return NextResponse.json(await prisma.posSale.findMany({ include: { items: true, payments: true, refunds: true }, orderBy: { soldAt: "desc" }, take: 100 }));
    if (path.startsWith("sales/")) return NextResponse.json(await prisma.posSale.findUnique({ where: { id: path.split("/")[1] }, include: { items: { include: { product: true } }, payments: true, refunds: { include: { items: true } } } }));
    if (path === "holds") return NextResponse.json(await prisma.posHold.findMany({ where: { status: "OPEN" }, include: { items: true }, orderBy: { createdAt: "desc" } }));
    if (path.startsWith("holds/")) return NextResponse.json(await prisma.posHold.findUnique({ where: { id: path.split("/")[1] }, include: { items: true } }));
    if (path === "settings") return NextResponse.json(await getPosSettings());
    if (path === "reports") {
      const from = new Date(request.nextUrl.searchParams.get("from") ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      const to = new Date(request.nextUrl.searchParams.get("to") ?? new Date().toISOString());
      return NextResponse.json(await getPosSalesReport(from, to));
    }
    if (path === "accounting") return NextResponse.json(await prisma.posAccountingEntry.findMany({ orderBy: { occurredAt: "desc" }, take: 200 }));
    if (path === "bookings/search") return NextResponse.json(await prisma.booking.findMany({ where: { status: "CHECKED_IN" }, include: { guest: { select: { firstName: true, lastName: true } }, rooms: { include: { room: { select: { number: true } } } }, tourGroup: { select: { name: true } } }, take: 50 }));
    return apiErrorResponse("ไม่พบ API", 404, "NOT_FOUND");
  } catch (error) { console.error("POS GET failed", error); return apiErrorResponse("ไม่สามารถโหลดข้อมูล POS ได้", 500, "INTERNAL_ERROR"); }
}

export async function POST(request: NextRequest, context: Context) {
  const actor = await authorized(request);
  if (!actor) return apiErrorResponse("ไม่มีสิทธิ์เข้าถึง", 403, "FORBIDDEN");
  const path = (await context.params).path.join("/");
  const parsed = await body(request); if (!parsed.ok) return parsed.response;
  try {
    if (path === "categories") return NextResponse.json(await prisma.posCategory.create({ data: { name: text(parsed.body, "name"), sortOrder: Number(parsed.body.sortOrder ?? 0) } }), { status: 201 });
    if (path === "products") return NextResponse.json(await prisma.posProduct.create({ data: { sku: text(parsed.body, "sku"), barcode: text(parsed.body, "barcode", false) ?? null, name: text(parsed.body, "name"), categoryId: text(parsed.body, "categoryId"), unit: text(parsed.body, "unit", false) ?? "ชิ้น", costPrice: numberValue(parsed.body, "costPrice"), sellPrice: numberValue(parsed.body, "sellPrice"), lowStockThreshold: numberValue(parsed.body, "lowStockThreshold", 5), imageUrl: text(parsed.body, "imageUrl", false) ?? null } }), { status: 201 });
    if (path === "stock/receive" || path === "stock/adjust") {
      const delta = numberValue(parsed.body, "quantity");
      const type = path.endsWith("receive") ? PosStockMovementType.RECEIVE : (delta.gte(0) ? PosStockMovementType.ADJUST_IN : PosStockMovementType.ADJUST_OUT);
      const movement = await prisma.$transaction(async (tx) => applyStockChange(tx, { productId: text(parsed.body, "productId"), delta, type, actorEmployeeId: actor.employeeId, allowNegativeStock: (await getPosSettings()).allowNegativeStock, documentNumber: text(parsed.body, "documentNumber", false), reason: text(parsed.body, "reason", false) }));
      return NextResponse.json(movement, { status: 201 });
    }
    if (path === "stock/count") {
      const countItems = parsed.body.items;
      if (!Array.isArray(countItems)) throw new Error("INVALID_ITEMS");
      const result = await prisma.$transaction(async (tx) => {
        const documentNumber = await nextStockDocumentNumber(tx, (await getPosSettings()).receiptPrefix);
        const count = await tx.posStockCount.create({ data: { documentNumber, note: text(parsed.body, "note", false) ?? null, actorEmployeeId: actor.employeeId } });
        for (const raw of countItems) {
          if (!isRecord(raw)) throw new Error("INVALID_ITEMS");
          const product = await tx.posProduct.findUnique({ where: { id: text(raw, "productId") } }); if (!product) throw new Error("PRODUCT_NOT_FOUND");
          const counted = numberValue(raw, "countedQuantity"); const variance = counted.minus(product.quantityOnHand);
          await tx.posStockCountItem.create({ data: { countId: count.id, productId: product.id, systemQuantity: product.quantityOnHand, countedQuantity: counted, variance } });
          if (!variance.isZero()) await applyStockChange(tx, { productId: product.id, delta: variance, type: PosStockMovementType.COUNT_ADJUST, actorEmployeeId: actor.employeeId, documentNumber, referenceType: "POS_STOCK_COUNT", referenceId: count.id, allowNegativeStock: false });
        } return count;
      }); return NextResponse.json(result, { status: 201 });
    }
    if (path === "shifts") return NextResponse.json(await openShift(actor.employeeId, numberValue(parsed.body, "openingFloat"), text(parsed.body, "note", false)), { status: 201 });
    if (path.endsWith("/close")) return NextResponse.json(await closeShift(path.split("/")[1], actor.employeeId, numberValue(parsed.body, "closingCashCounted"), text(parsed.body, "note", false)));
    if (path.endsWith("/approve")) { const result = await approveShift(path.split("/")[1], actor.employeeId); return NextResponse.json(result); }
    if (path.endsWith("/cash")) return NextResponse.json(await prisma.posCashMovement.create({ data: { shiftId: path.split("/")[1], type: text(parsed.body, "type") === "IN" ? PosCashMovementType.IN : PosCashMovementType.OUT, amount: numberValue(parsed.body, "amount"), reason: text(parsed.body, "reason"), actorEmployeeId: actor.employeeId } }));
    if (path === "sales") {
      if (!Array.isArray(parsed.body.lines) || !Array.isArray(parsed.body.payments)) throw new Error("INVALID_SALE");
      const sale = await createSale({ employeeId: actor.employeeId, shiftId: text(parsed.body, "shiftId"), idempotencyKey: text(parsed.body, "idempotencyKey"), lines: parsed.body.lines.filter(isRecord).map((line) => ({ productId: text(line, "productId"), quantity: text(line, "quantity"), discount: text(line, "discount", false) ?? 0 })), payments: parsed.body.payments.filter(isRecord).map((payment) => { const method = text(payment, "method"); if (!paymentMethods.has(method as PosPaymentMethod)) throw new Error("INVALID_PAYMENT_METHOD"); return { method: method as PosPaymentMethod, amount: text(payment, "amount"), reference: text(payment, "reference", false) }; }), billDiscount: text(parsed.body, "billDiscount", false) ?? 0, bookingId: text(parsed.body, "bookingId", false), note: text(parsed.body, "note", false) });
      await recordAuditLog({ actor: { employeeId: actor.employeeId, authUserId: actor.authUserId }, action: "POS_SALE_CREATED", entityType: "POS_SALE", entityId: sale.id }); return NextResponse.json(sale, { status: 201 });
    }
    if (path.endsWith("/cancel")) return NextResponse.json(await cancelSale(path.split("/")[1], actor.employeeId, text(parsed.body, "reason")));
    if (path.endsWith("/refund")) return NextResponse.json(await refundSale({ saleId: path.split("/")[1], employeeId: actor.employeeId, reason: text(parsed.body, "reason"), refundMethod: text(parsed.body, "refundMethod") as PosPaymentMethod, items: Array.isArray(parsed.body.items) ? parsed.body.items.filter(isRecord).map((item) => ({ saleItemId: text(item, "saleItemId"), quantity: text(item, "quantity"), restock: item.restock !== false })) : [] }));
    if (path === "holds") {
      const lines = parsed.body.lines;
      if (lines !== undefined && !Array.isArray(lines)) throw new Error("INVALID_LINES");
      const hold = await prisma.$transaction(async (tx) =>
        tx.posHold.create({
          data: {
            holdNumber: await nextHoldNumber(tx, (await getPosSettings()).receiptPrefix),
            heldById: actor.employeeId,
            shiftId: text(parsed.body, "shiftId", false),
            billDiscount: numberValue(parsed.body, "billDiscount", 0),
            note: text(parsed.body, "note", false),
            payload: asJson(parsed.body),
            items: {
              create: (lines ?? []).filter(isRecord).map((line) => ({
                productId: text(line, "productId"),
                quantity: numberValue(line, "quantity"),
                unitPrice: numberValue(line, "unitPrice"),
                discount: numberValue(line, "discount", 0),
              })),
            },
          },
          include: { items: true },
        }),
      );
      return NextResponse.json(hold, { status: 201 });
    }
    return apiErrorResponse("ไม่พบ API", 404, "NOT_FOUND");
  } catch (error) { console.error("POS POST failed", error); const code = error instanceof Error ? error.message : "INTERNAL_ERROR"; return apiErrorResponse("บันทึกข้อมูล POS ไม่สำเร็จ", code.startsWith("INVALID") ? 400 : 409, code); }
}

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await authorized(request); if (!actor) return apiErrorResponse("ไม่มีสิทธิ์เข้าถึง", 403, "FORBIDDEN");
  const path = (await context.params).path.join("/"); const parsed = await body(request); if (!parsed.ok) return parsed.response;
  try {
    if (path.startsWith("categories/")) return NextResponse.json(await prisma.posCategory.update({ where: { id: path.split("/")[1] }, data: { ...(typeof parsed.body.name === "string" ? { name: parsed.body.name.trim() } : {}), ...(typeof parsed.body.isActive === "boolean" ? { isActive: parsed.body.isActive } : {}), ...(typeof parsed.body.sortOrder === "number" ? { sortOrder: parsed.body.sortOrder } : {}) } }));
    if (path.startsWith("products/")) {
      return NextResponse.json(
        await prisma.posProduct.update({
          where: { id: path.split("/")[1] },
          data: {
            ...(typeof parsed.body.name === "string"
              ? { name: parsed.body.name.trim() }
              : {}),
            ...(typeof parsed.body.isActive === "boolean"
              ? { isActive: parsed.body.isActive }
              : {}),
            ...(typeof parsed.body.sellPrice === "string" ||
            typeof parsed.body.sellPrice === "number"
              ? { sellPrice: money(parsed.body.sellPrice) }
              : {}),
            ...(typeof parsed.body.barcode === "string"
              ? { barcode: parsed.body.barcode.trim() || null }
              : {}),
            ...(typeof parsed.body.imageUrl === "string"
              ? { imageUrl: parsed.body.imageUrl.trim() || null }
              : {}),
            ...(parsed.body.imageUrl === null ? { imageUrl: null } : {}),
          },
        }),
      );
    }
    if (path.startsWith("holds/")) return NextResponse.json(await prisma.posHold.update({ where: { id: path.split("/")[1] }, data: { ...(parsed.body.action === "resume" ? { status: "RESUMED", resumedAt: new Date() } : {}), ...(parsed.body.action === "cancel" ? { status: "CANCELLED" } : {}), ...(typeof parsed.body.note === "string" ? { note: parsed.body.note.trim() } : {}) } }));
    if (path === "settings") { const allowed = ["allowNegativeStock", "receiptPrefix", "maxRefundDays", "defaultLowStock", "storeName"]; const results = await Promise.all(allowed.filter((key) => key in parsed.body).map((key) => prisma.posSetting.upsert({ where: { key }, create: { key, value: asJson(parsed.body[key]) }, update: { value: asJson(parsed.body[key]) } }))); return NextResponse.json(results); }
    return apiErrorResponse("ไม่พบ API", 404, "NOT_FOUND");
  } catch (error) { console.error("POS PATCH failed", error); return apiErrorResponse("แก้ไขข้อมูล POS ไม่สำเร็จ", 400, "UPDATE_FAILED"); }
}
