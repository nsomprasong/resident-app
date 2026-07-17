import {
  BookingStatus,
  ChargeType,
  OrderStatus,
} from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
} from "@/lib/bookings/availability";
import { acquireBookingResourceLocks } from "@/lib/bookings/resource-locks";
import { parseBookingExtraCharges } from "@/lib/bookings/extra-charges";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const labels: Record<BookingStatus, string> = {
  PENDING: "รอดำเนินการ",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็กอิน",
  CHECKED_OUT: "เช็กเอาต์",
  CANCELLED: "ยกเลิก",
};
const images = [
  "/images/room/room1.jpg",
  "/images/room/room2.jpg",
  "/images/room/room3.jpg",
  "/images/room/room4.jpg",
];
const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return parseDate(`${get("year")}-${get("month")}-${get("day")}`);
}

export async function GET(request: NextRequest) {
  try {
    const history = request.nextUrl.searchParams.get("history") === "true";
    const date = parseDate(
      request.nextUrl.searchParams.get("date") ??
        new Date().toISOString().slice(0, 10),
    );
    if (Number.isNaN(date.getTime()))
      return NextResponse.json(
        { message: "วันที่ไม่ถูกต้อง" },
        { status: 400 },
      );
    const bookings = await prisma.booking.findMany({
      where: history
        ? {
            status: {
              in: [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED],
            },
          }
        : {
            checkIn: { lte: date },
            checkOut: { gt: date },
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT],
            },
          },
      include: {
        guest: true,
        tourGroup: true,
        rooms: { include: { room: true } },
        rafts: { include: { raft: true } },
      },
      orderBy: history ? { updatedAt: "desc" } : { createdAt: "desc" },
    });
    return NextResponse.json(
      bookings.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        mode: booking.tourGroupId ? "group" : "solo",
        customerName:
          booking.tourGroup?.name ??
          [booking.guest?.firstName, booking.guest?.lastName]
            .filter(Boolean)
            .join(" "),
        status: booking.closedAt ? "ปิดงานแล้ว" : labels[booking.status],
        rooms: booking.rooms.map(({ room }, index) => ({
          id: booking.id,
          roomId: room.id,
          name: `ห้อง ${room.number}`,
          status: booking.closedAt ? "ปิดงานแล้ว" : labels[booking.status],
          image: images[index % images.length],
        })),
        rafts: booking.rafts.map(({ raft }) => ({
          id: raft.id,
          name: raft.name,
          capacity: raft.capacity,
        })),
      })),
    );
  } catch (error) {
    console.error("GET bookings failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดรายการจองได้" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const modeValue = parsed.body.mode;
    const name =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
    const contactName =
      typeof parsed.body.contactName === "string"
        ? parsed.body.contactName.trim()
        : undefined;
    const phone =
      typeof parsed.body.phone === "string" ? parsed.body.phone.trim() : "";
    const guestIdValue =
      typeof parsed.body.guestId === "string" ? parsed.body.guestId.trim() : "";
    const checkInValue =
      typeof parsed.body.checkIn === "string" ? parsed.body.checkIn : "";
    const checkOutValue =
      typeof parsed.body.checkOut === "string" ? parsed.body.checkOut : "";
    const roomIdsValue = parsed.body.roomIds;
    const raftIdsValue = parsed.body.raftIds;
    const raftsValue = parsed.body.rafts;
    const foodItemsValue = parsed.body.foodItems;
    const foodSetMetaRaw =
      typeof parsed.body.foodSet === "object" &&
      parsed.body.foodSet !== null &&
      !Array.isArray(parsed.body.foodSet)
        ? (parsed.body.foodSet as Record<string, unknown>)
        : null;
    const foodSetName =
      typeof foodSetMetaRaw?.name === "string"
        ? foodSetMetaRaw.name.trim()
        : "";
    const foodSetSourceIdRaw = foodSetMetaRaw?.sourceFoodSetId;
    const foodSetSourceId =
      foodSetSourceIdRaw === null
        ? null
        : typeof foodSetSourceIdRaw === "string" && foodSetSourceIdRaw.trim()
          ? foodSetSourceIdRaw.trim()
          : null;
    const roomIds: string[] | null =
      roomIdsValue === undefined
        ? []
        : Array.isArray(roomIdsValue) && roomIdsValue.every((id) => typeof id === "string" && id.trim())
          ? roomIdsValue.map((id) => id.trim())
          : null;
    const selectedRafts: Array<{ id: string; isExtra: boolean }> = [];
    let raftsValid = true;
    if (raftsValue !== undefined) {
      if (!Array.isArray(raftsValue)) {
        issues.push({ path: "rafts", message: "Rafts must be an array" });
        raftsValid = false;
      } else {
        raftsValue.forEach((entry, index) => {
          if (typeof entry === "string" && entry.trim()) {
            selectedRafts.push({
              id: entry.trim(),
              isExtra: modeValue === "group" ? false : true,
            });
            return;
          }
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            issues.push({
              path: `rafts.${index}`,
              message: "Raft entry must be an object",
            });
            raftsValid = false;
            return;
          }
          const record = entry as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id.trim() : "";
          if (!id) {
            issues.push({ path: `rafts.${index}.id`, message: "Raft id is required" });
            raftsValid = false;
            return;
          }
          if (typeof record.isExtra !== "boolean") {
            issues.push({
              path: `rafts.${index}.isExtra`,
              message: "isExtra must be boolean",
            });
            raftsValid = false;
            return;
          }
          selectedRafts.push({ id, isExtra: record.isExtra });
        });
      }
    } else if (raftIdsValue !== undefined) {
      if (
        !Array.isArray(raftIdsValue) ||
        !raftIdsValue.every((id) => typeof id === "string" && id.trim())
      ) {
        issues.push({ path: "raftIds", message: "Raft ids must be strings" });
        raftsValid = false;
      } else {
        for (const id of raftIdsValue.map((value) => value.trim())) {
          selectedRafts.push({
            id,
            isExtra: modeValue === "group" ? false : true,
          });
        }
      }
    }
    const foodItems: Array<{
      productId: string;
      quantity: number;
      isExtra: boolean;
      note: string | null;
    }> = [];

    if (!name) issues.push({ path: "name", message: "Customer name is required" });
    if (!phone) issues.push({ path: "phone", message: "Customer phone is required" });
    if (!checkInValue) issues.push({ path: "checkIn", message: "Check-in date is required" });
    if (!checkOutValue) issues.push({ path: "checkOut", message: "Check-out date is required" });
    if (guestIdValue && modeValue === "group") {
      issues.push({
        path: "guestId",
        message: "guestId is only valid for solo bookings",
      });
    }
    if (
      guestIdValue &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        guestIdValue,
      )
    ) {
      issues.push({ path: "guestId", message: "guestId must be a valid uuid" });
    }
    if (modeValue !== "solo" && modeValue !== "group") {
      issues.push({ path: "mode", message: "Booking mode is invalid" });
    }
    if (!roomIds) issues.push({ path: "roomIds", message: "Room ids must be strings" });
    if (!raftsValid) {
      /* issues already recorded */
    }
    if (roomIds && raftsValid && !roomIds.length && !selectedRafts.length) {
      issues.push({ path: "resources", message: "At least one room or raft is required" });
    }
    if (foodItemsValue !== undefined && !Array.isArray(foodItemsValue)) {
      issues.push({ path: "foodItems", message: "Food items must be an array" });
    }
    if (Array.isArray(foodItemsValue)) {
      foodItemsValue.forEach((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          issues.push({ path: `foodItems.${index}`, message: "Food item must be an object" });
          return;
        }
        const itemRecord = item as Record<string, unknown>;
        const productId =
          typeof itemRecord.productId === "string" ? itemRecord.productId.trim() : "";
        const quantity = Number(itemRecord.quantity);
        const isExtraValue = itemRecord.isExtra;
        const isExtra =
          isExtraValue === undefined
            ? undefined
            : typeof isExtraValue === "boolean"
              ? isExtraValue
              : null;
        const noteValue = itemRecord.note;
        const note =
          noteValue === undefined || noteValue === null
            ? null
            : typeof noteValue === "string"
              ? noteValue.trim() || null
              : undefined;
        if (!productId) {
          issues.push({ path: `foodItems.${index}.productId`, message: "Product id is required" });
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          issues.push({ path: `foodItems.${index}.quantity`, message: "Food quantity must be greater than 0" });
        }
        if (isExtra === null) {
          issues.push({
            path: `foodItems.${index}.isExtra`,
            message: "isExtra must be boolean",
          });
        }
        if (note === undefined) {
          issues.push({
            path: `foodItems.${index}.note`,
            message: "note must be a string",
          });
        }
        if (
          productId &&
          Number.isFinite(quantity) &&
          quantity > 0 &&
          isExtra !== null &&
          note !== undefined
        ) {
          foodItems.push({
            productId,
            quantity,
            isExtra:
              modeValue === "group"
                ? isExtra === undefined
                  ? false
                  : isExtra
                : true,
            note,
          });
        }
      });
    }

    const parsedExtraCharges = parseBookingExtraCharges(
      parsed.body.extraCharges,
      "extraCharges",
    );
    if (!parsedExtraCharges.ok) {
      issues.push(...parsedExtraCharges.issues);
    }
    const extraCharges = parsedExtraCharges.ok
      ? parsedExtraCharges.charges
      : [];

    if (issues.length)
      return validationErrorResponse(
        "กรุณากรอกข้อมูลและเลือกห้องหรือแพอย่างน้อย 1 รายการ",
        issues,
      );

    const mode = modeValue as "solo" | "group";
    const guestCount =
      parsed.body.guestCount === undefined ? undefined : Number(parsed.body.guestCount);
    const pricePerPerson =
      parsed.body.pricePerPerson === undefined
        ? undefined
        : Number(parsed.body.pricePerPerson);
    const groupIssues: ValidationIssue[] = [];
    if (
      mode === "group" &&
      (!Number.isFinite(guestCount) ||
        !guestCount ||
        guestCount < 1)
    ) {
      groupIssues.push({ path: "guestCount", message: "Guest count must be greater than 0" });
    }
    if (
      mode === "group" &&
      (!Number.isFinite(pricePerPerson) ||
        pricePerPerson === undefined ||
        pricePerPerson < 0)
    ) {
      groupIssues.push({ path: "pricePerPerson", message: "Price per person must be 0 or greater" });
    }
    if (groupIssues.length)
      return validationErrorResponse(
        "กรุณาระบุจำนวนคนและราคาต่อหัว",
        groupIssues,
      );
    const checkIn = parseDate(checkInValue);
    const checkOut = parseDate(checkOutValue);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    )
      return validationErrorResponse(
        "วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน",
        [{ path: "checkOut", message: "Check-out date must be after check-in date" }],
      );
    if (checkIn < todayBangkok())
      return validationErrorResponse(
        "วันเช็กอินต้องเป็นวันนี้หรือวันในอนาคต",
        [{ path: "checkIn", message: "Check-in date cannot be in the past" }],
      );
    const selectedRoomIds = roomIds ?? [];
    const selectedRaftIds = selectedRafts.map((item) => item.id);
    const raftExtraById = new Map(
      selectedRafts.map((item) => [
        item.id,
        mode === "group" ? item.isExtra : true,
      ]),
    );
    const result = await prisma.$transaction(async (tx) => {
      await acquireBookingResourceLocks(tx, {
        roomIds: selectedRoomIds,
        raftIds: selectedRaftIds,
      });
      const rooms = await tx.room.findMany({
        where: { id: { in: selectedRoomIds } },
        include: { roomType: true },
      });
      const rafts = await tx.raft.findMany({ where: { id: { in: selectedRaftIds } } });
      const products = await tx.product.findMany({
        where: {
          id: { in: foodItems.map((item) => item.productId) },
          isActive: true,
        },
      });
      if (rooms.length !== selectedRoomIds.length) throw new Error("ROOM_NOT_FOUND");
      if (rafts.length !== selectedRaftIds.length) throw new Error("RAFT_NOT_FOUND");
      if (rooms.some((room) => !availableRoomStatuses.includes(room.status))) {
        throw new Error("ROOM_NOT_AVAILABLE");
      }
      if (rafts.some((raft) => !availableRaftStatuses.includes(raft.status))) {
        throw new Error("RAFT_NOT_AVAILABLE");
      }
      if (
        products.length !==
        new Set(foodItems.map((item) => item.productId)).size
      )
        throw new Error("PRODUCT_NOT_FOUND");
      const roomConflict = await tx.bookingRoom.findFirst({
        where: {
          roomId: { in: selectedRoomIds },
          booking: {
            status: {
              in: activeBookingConflictStatuses,
            },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        include: { room: true },
      });
      if (roomConflict)
        throw new Error(`ROOM_CONFLICT:${roomConflict.room.number}`);
      const raftConflict = await tx.bookingRaft.findFirst({
        where: {
          raftId: { in: selectedRaftIds },
          booking: {
            status: { in: activeBookingConflictStatuses },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        include: { raft: true },
      });
      if (raftConflict)
        throw new Error(`RAFT_CONFLICT:${raftConflict.raft.number}`);
      let guestId: string | undefined;
      let tourGroupId: string | undefined;
      if (mode === "group") {
        const group = await tx.tourGroup.create({
          data: {
            name,
            contactName: contactName || name,
            phone,
          },
        });
        tourGroupId = group.id;
      } else if (guestIdValue) {
        const existingGuest = await tx.guest.findUnique({
          where: { id: guestIdValue },
        });
        if (!existingGuest) {
          throw new Error("GUEST_NOT_FOUND");
        }
        const [firstName, ...last] = name.split(/\s+/);
        await tx.guest.update({
          where: { id: existingGuest.id },
          data: {
            firstName,
            lastName: last.join(" ") || "-",
            phone,
          },
        });
        guestId = existingGuest.id;
      } else {
        const [firstName, ...last] = name.split(/\s+/);
        const guest = await tx.guest.create({
          data: {
            firstName,
            lastName: last.join(" ") || "-",
            phone,
          },
        });
        guestId = guest.id;
      }
      const nights = Math.max(
        1,
        Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
      );
      const roomTotal = rooms.reduce(
        (sum, room) => sum + Number(room.roomType.basePrice) * nights,
        0,
      );
      const raftPayload = rafts.map((raft) => {
        const isExtra = raftExtraById.get(raft.id) ?? mode !== "group";
        return {
          raft,
          isExtra,
          amount: Number(raft.basePrice) * nights,
        };
      });
      const raftTotal = raftPayload.reduce((sum, item) => sum + item.amount, 0);
      const extraRaftTotal = raftPayload
        .filter((item) => item.isExtra)
        .reduce((sum, item) => sum + item.amount, 0);
      const extraRaftCount = raftPayload.filter((item) => item.isExtra).length;
      const groupPackage =
        mode === "group"
          ? (guestCount ?? 0) * (pricePerPerson ?? 0)
          : 0;
      const booking = await tx.booking.create({
        data: {
          reference: `BK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          status: BookingStatus.PENDING,
          checkIn,
          checkOut,
          guestId,
          tourGroupId,
          guestCount: mode === "group" ? guestCount : undefined,
          pricePerPerson:
            mode === "group" ? pricePerPerson : undefined,
          rooms: {
            create: rooms.map((room) => ({
              roomId: room.id,
              rate: room.roomType.basePrice,
              isExtra: false,
            })),
          },
          rafts: {
            create: raftPayload.map(({ raft, isExtra }) => ({
              raftId: raft.id,
              rate: raft.basePrice,
              isExtra,
            })),
          },
          charges: {
            create:
              mode === "group"
                ? [
                    {
                      type: ChargeType.OTHER,
                      description: `ราคาเหมากลุ่ม ${guestCount} คน × ฿${pricePerPerson}`,
                      amount: groupPackage,
                    },
                    ...(extraRaftCount
                      ? [
                          {
                            type: ChargeType.RAFT,
                            description: `แพคิดเพิ่ม ${extraRaftCount} หลัง · ${nights} คืน`,
                            amount: extraRaftTotal,
                          },
                        ]
                      : []),
                    ...extraCharges.map((charge) => ({
                      type: charge.type,
                      description: charge.description,
                      amount: charge.amount,
                    })),
                  ]
                : [
                    ...(rooms.length
                      ? [
                          {
                            type: ChargeType.ROOM,
                            description: `ค่าห้องพัก ${nights} คืน`,
                            amount: roomTotal,
                          },
                        ]
                      : []),
                    ...(raftPayload.length
                      ? [
                          {
                            type: ChargeType.RAFT,
                            description: `ค่าแพ ${raftPayload.length} หลัง · ${nights} คืน`,
                            amount: raftTotal,
                          },
                        ]
                      : []),
                    ...extraCharges.map((charge) => ({
                      type: charge.type,
                      description: charge.description,
                      amount: charge.amount,
                    })),
                  ],
          },
        },
        select: { id: true, reference: true },
      });
      if (foodItems.length) {
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );
        await tx.order.create({
          data: {
            number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            status: OrderStatus.PENDING,
            bookingId: booking.id,
            roomId: rooms[0]?.id,
            note:
              mode === "group"
                ? "อาหารหลักรวมในราคาเหมา"
                : "อาหารสั่งพร้อมการจอง",
            items: {
              create: foodItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: productMap.get(item.productId)!.price,
                isExtra: item.isExtra,
                ...(item.note ? { note: item.note } : {}),
              })),
            },
          },
        });
      }

      // Persist group-only food set customization (does not mutate master FoodSet).
      if (mode === "group" && tourGroupId && foodItems.length) {
        let sourceFoodSetId: string | null = foodSetSourceId;
        if (sourceFoodSetId) {
          const source = await tx.foodSet.findUnique({
            where: { id: sourceFoodSetId },
            select: { id: true },
          });
          if (!source) sourceFoodSetId = null;
        }
        await tx.tourGroupFoodSet.create({
          data: {
            tourGroupId,
            name: foodSetName || "ชุดของกรุ๊ป",
            sourceFoodSetId,
            items: {
              create: foodItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                isExtra: item.isExtra,
                ...(item.note ? { optionNote: item.note } : {}),
              })),
            },
          },
        });
      }

      return {
        id: booking.id,
        reference: booking.reference,
        tourGroupId: tourGroupId ?? null,
      };
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_CREATED",
      entityType: "BOOKING",
      entityId: result.id,
      metadata: {
        mode,
        roomCount: selectedRoomIds.length,
        raftCount: selectedRaftIds.length,
        foodItemCount: foodItems.length,
        tourGroupId: result.tourGroupId,
        nights: Math.max(
          1,
          Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
        ),
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ROOM_NOT_FOUND")
      return apiErrorResponse("ไม่พบห้องที่เลือก", 400, "ROOM_NOT_FOUND");
    if (message === "RAFT_NOT_FOUND")
      return apiErrorResponse("ไม่พบแพที่เลือก", 400, "RAFT_NOT_FOUND");
    if (message === "ROOM_NOT_AVAILABLE")
      return apiErrorResponse("ห้องที่เลือกไม่พร้อมใช้งาน", 409, "ROOM_NOT_AVAILABLE");
    if (message === "RAFT_NOT_AVAILABLE")
      return apiErrorResponse("แพที่เลือกไม่พร้อมใช้งาน", 409, "RAFT_NOT_AVAILABLE");
    if (message === "PRODUCT_NOT_FOUND")
      return apiErrorResponse("ไม่พบอาหารที่เลือก", 400, "PRODUCT_NOT_FOUND");
    if (message === "GUEST_NOT_FOUND")
      return apiErrorResponse("ไม่พบลูกค้าที่เลือก", 400, "GUEST_NOT_FOUND");
    if (message.startsWith("ROOM_CONFLICT:"))
      return apiErrorResponse(`ห้อง ${message.split(":")[1]} ไม่ว่าง`, 409, "ROOM_CONFLICT");
    if (message.startsWith("RAFT_CONFLICT:"))
      return apiErrorResponse(`แพ ${message.split(":")[1]} ไม่ว่าง`, 409, "RAFT_CONFLICT");
    console.error("POST bookings failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกการจองได้", 500, "INTERNAL_ERROR");
  }
}
