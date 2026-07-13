import { BookingStatus, ChargeType, RoomStatus } from "@/generated/prisma/client";
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
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const roomIdsValue = parsed.body.roomIds;
    const raftIdsValue = parsed.body.raftIds;
    const roomIds: string[] | null =
      roomIdsValue === undefined
        ? []
        : Array.isArray(roomIdsValue) && roomIdsValue.every((id) => typeof id === "string" && id.trim())
          ? roomIdsValue.map((id) => id.trim())
          : null;
    const raftIds: string[] | null =
      raftIdsValue === undefined
        ? []
        : Array.isArray(raftIdsValue) && raftIdsValue.every((id) => typeof id === "string" && id.trim())
          ? raftIdsValue.map((id) => id.trim())
          : null;

    if (!roomIds) issues.push({ path: "roomIds", message: "Room ids must be strings" });
    if (!raftIds) issues.push({ path: "raftIds", message: "Raft ids must be strings" });
    if (roomIds && raftIds && !roomIds.length && !raftIds.length) {
      issues.push({
        path: "body",
        message: "At least one room or raft must be selected",
      });
    }
    if (issues.length)
      return validationErrorResponse(
        "กรุณาเลือกห้องหรือแพอย่างน้อย 1 รายการ",
        issues,
      );

    const selectedRoomIds = roomIds ?? [];
    const selectedRaftIds = raftIds ?? [];

    const added = await prisma.$transaction(async (tx) => {
      await acquireBookingResourceLocks(tx, {
        roomIds: selectedRoomIds,
        raftIds: selectedRaftIds,
      });
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { rooms: true, rafts: true } });
      if (!booking) throw new Error("NOT_FOUND");
      if (booking.status === BookingStatus.CHECKED_OUT || booking.status === BookingStatus.CANCELLED) throw new Error("BOOKING_CLOSED");
      if (selectedRoomIds.some((id) => booking.rooms.some((item) => item.roomId === id)) || selectedRaftIds.some((id) => booking.rafts.some((item) => item.raftId === id))) throw new Error("ALREADY_ADDED");
      const rooms = await tx.room.findMany({ where: { id: { in: selectedRoomIds } }, include: { roomType: true } }); const rafts = await tx.raft.findMany({ where: { id: { in: selectedRaftIds } } });
      if (rooms.length !== selectedRoomIds.length || rafts.length !== selectedRaftIds.length) throw new Error("NOT_FOUND_RESOURCE");
      if (rooms.some((room) => !availableRoomStatuses.includes(room.status))) throw new Error("ROOM_NOT_AVAILABLE");
      if (rafts.some((raft) => !availableRaftStatuses.includes(raft.status))) throw new Error("RAFT_NOT_AVAILABLE");
      const roomConflict = await tx.bookingRoom.findFirst({ where: { roomId: { in: selectedRoomIds }, bookingId: { not: bookingId }, booking: { status: { in: activeBookingConflictStatuses }, checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } } }, include: { room: true } });
      if (roomConflict) throw new Error(`ROOM_CONFLICT:${roomConflict.room.number}`);
      const raftConflict = await tx.bookingRaft.findFirst({ where: { raftId: { in: selectedRaftIds }, bookingId: { not: bookingId }, booking: { status: { in: activeBookingConflictStatuses }, checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } } }, include: { raft: true } });
      if (raftConflict) throw new Error(`RAFT_CONFLICT:${raftConflict.raft.number}`);
      const nights = Math.max(1, Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
      if (rooms.length) { await tx.bookingRoom.createMany({ data: rooms.map((room) => ({ bookingId, roomId: room.id, rate: room.roomType.basePrice, isExtra: true })) }); await tx.charge.create({ data: { bookingId, type: ChargeType.ROOM, description: `เพิ่มห้องพัก ${rooms.length} ห้อง · ${nights} คืน`, amount: rooms.reduce((sum, room) => sum + Number(room.roomType.basePrice) * nights, 0) } }); if (booking.status === BookingStatus.CHECKED_IN) { await tx.room.updateMany({ where: { id: { in: selectedRoomIds } }, data: { status: RoomStatus.OCCUPIED } }); const added = await tx.bookingRoom.findMany({ where: { bookingId, roomId: { in: selectedRoomIds } }, select: { id: true } }); await tx.roomInspection.createMany({ data: added.map((item) => ({ bookingRoomId: item.id })) }); } }
      if (rafts.length) { await tx.bookingRaft.createMany({ data: rafts.map((raft) => ({ bookingId, raftId: raft.id, rate: raft.basePrice, isExtra: true })) }); await tx.charge.create({ data: { bookingId, type: ChargeType.RAFT, description: `เพิ่มแพ ${rafts.length} หลัง · ${nights} คืน`, amount: rafts.reduce((sum, raft) => sum + Number(raft.basePrice) * nights, 0) } }); }
      return { roomCount: rooms.length, raftCount: rafts.length, nights };
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_RESOURCES_ADDED",
      entityType: "BOOKING",
      entityId: bookingId,
      metadata: added,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const labels: Record<string, [string, number]> = {
      NOT_FOUND: ["ไม่พบรายการจอง", 404],
      BOOKING_CLOSED: ["รายการจองนี้ปิดแล้ว", 400],
      ALREADY_ADDED: ["มีรายการที่เลือกอยู่ในการจองแล้ว", 400],
      NOT_FOUND_RESOURCE: ["ไม่พบห้องหรือแพที่เลือก", 400],
      ROOM_NOT_AVAILABLE: ["ห้องที่เลือกไม่พร้อมใช้งาน", 409],
      RAFT_NOT_AVAILABLE: ["แพที่เลือกไม่พร้อมใช้งาน", 409],
    };
    if (labels[message]) return apiErrorResponse(labels[message][0], labels[message][1], message);
    if (message.startsWith("ROOM_CONFLICT:")) return apiErrorResponse(`ห้อง ${message.split(":")[1]} ไม่ว่าง`, 409, "ROOM_CONFLICT");
    if (message.startsWith("RAFT_CONFLICT:")) return apiErrorResponse(`แพ ${message.split(":")[1]} ไม่ว่าง`, 409, "RAFT_CONFLICT");
    console.error("POST booking resources failed", error); return apiErrorResponse("ไม่สามารถเพิ่มห้องหรือแพได้", 500, "INTERNAL_ERROR");
  }
}

function parseIdList(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): string[] | null {
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path} must be an array of strings` });
    return null;
  }
  if (!value.every((id) => typeof id === "string" && id.trim())) {
    issues.push({ path, message: `${path} must be an array of strings` });
    return null;
  }
  return [...new Set(value.map((id) => (id as string).trim()))];
}

type ResourceInput = { id: string; isExtra: boolean };

function parseResourceInputs(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  legacyIds: string[] | null,
): ResourceInput[] | null {
  if (value === undefined) {
    if (!legacyIds) return null;
    return legacyIds.map((id) => ({ id, isExtra: true }));
  }
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path} must be an array` });
    return null;
  }

  const items: ResourceInput[] = [];
  value.forEach((entry, index) => {
    if (typeof entry === "string" && entry.trim()) {
      items.push({ id: entry.trim(), isExtra: true });
      return;
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({
        path: `${path}.${index}`,
        message: "Resource entry must be an object",
      });
      return;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      issues.push({ path: `${path}.${index}.id`, message: "Id is required" });
      return;
    }
    if (typeof record.isExtra !== "boolean") {
      issues.push({
        path: `${path}.${index}.isExtra`,
        message: "isExtra must be boolean",
      });
      return;
    }
    items.push({ id, isExtra: record.isExtra });
  });

  const byId = new Map<string, ResourceInput>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const legacyRoomIds =
      parsed.body.roomIds === undefined
        ? null
        : parseIdList(parsed.body.roomIds, "roomIds", issues);
    const legacyRaftIds =
      parsed.body.raftIds === undefined
        ? null
        : parseIdList(parsed.body.raftIds, "raftIds", issues);
    const nextRooms = parseResourceInputs(
      parsed.body.rooms,
      "rooms",
      issues,
      legacyRoomIds,
    );
    const nextRafts = parseResourceInputs(
      parsed.body.rafts,
      "rafts",
      issues,
      legacyRaftIds,
    );

    if (nextRooms === null || nextRafts === null) {
      if (!issues.length) {
        issues.push({
          path: "body",
          message: "rooms and rafts are required",
        });
      }
    } else if (!nextRooms.length && !nextRafts.length) {
      issues.push({
        path: "body",
        message: "At least one room or raft is required",
      });
    }
    if (issues.length) {
      return validationErrorResponse(
        "กรุณาเลือกห้องหรือแพอย่างน้อย 1 รายการ",
        issues,
      );
    }

    const desiredRooms = nextRooms!;
    const desiredRafts = nextRafts!;
    const nextRoomIds = desiredRooms.map((item) => item.id);
    const nextRaftIds = desiredRafts.map((item) => item.id);
    const roomExtraMap = new Map(
      desiredRooms.map((item) => [item.id, item.isExtra]),
    );
    const raftExtraMap = new Map(
      desiredRafts.map((item) => [item.id, item.isExtra]),
    );

    const result = await prisma.$transaction(async (tx) => {
      await acquireBookingResourceLocks(tx, {
        roomIds: nextRoomIds,
        raftIds: nextRaftIds,
      });

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          rooms: { include: { room: true, inspection: true } },
          rafts: { include: { raft: true } },
        },
      });
      if (!booking) throw new Error("NOT_FOUND");
      if (
        booking.status === BookingStatus.CHECKED_OUT ||
        booking.status === BookingStatus.CANCELLED
      ) {
        throw new Error("BOOKING_CLOSED");
      }

      const isGroup = Boolean(booking.tourGroupId);
      const resolveExtra = (requested: boolean) => (isGroup ? requested : true);

      const currentRoomIds = booking.rooms.map((item) => item.roomId);
      const currentRaftIds = booking.rafts.map((item) => item.raftId);
      const removeRoomIds = currentRoomIds.filter(
        (id) => !nextRoomIds.includes(id),
      );
      const addRoomIds = nextRoomIds.filter(
        (id) => !currentRoomIds.includes(id),
      );
      const keepRoomIds = nextRoomIds.filter((id) =>
        currentRoomIds.includes(id),
      );
      const removeRaftIds = currentRaftIds.filter(
        (id) => !nextRaftIds.includes(id),
      );
      const addRaftIds = nextRaftIds.filter(
        (id) => !currentRaftIds.includes(id),
      );
      const keepRaftIds = nextRaftIds.filter((id) =>
        currentRaftIds.includes(id),
      );

      const nights = Math.max(
        1,
        Math.ceil(
          (booking.checkOut.getTime() - booking.checkIn.getTime()) /
            86_400_000,
        ),
      );

      let flagChanges = 0;

      await acquireBookingResourceLocks(tx, {
        roomIds: [...removeRoomIds, ...addRoomIds, ...keepRoomIds],
        raftIds: [...removeRaftIds, ...addRaftIds, ...keepRaftIds],
      });

      if (removeRoomIds.length) {
        const removing = booking.rooms.filter((item) =>
          removeRoomIds.includes(item.roomId),
        );
        for (const item of removing) {
          const adjust =
            item.isExtra || !isGroup ? Number(item.rate) * nights : 0;
          if (adjust > 0) {
            await tx.charge.create({
              data: {
                bookingId,
                type: ChargeType.ROOM,
                description: `ลบห้อง ${item.room.number}`,
                amount: -adjust,
              },
            });
          }
        }
        await tx.bookingRoom.deleteMany({
          where: { bookingId, roomId: { in: removeRoomIds } },
        });
        if (booking.status === BookingStatus.CHECKED_IN) {
          await tx.room.updateMany({
            where: { id: { in: removeRoomIds } },
            data: { status: RoomStatus.AVAILABLE },
          });
        }
      }

      if (removeRaftIds.length) {
        const removing = booking.rafts.filter((item) =>
          removeRaftIds.includes(item.raftId),
        );
        for (const item of removing) {
          const adjust =
            item.isExtra || !isGroup ? Number(item.rate) * nights : 0;
          if (adjust > 0) {
            await tx.charge.create({
              data: {
                bookingId,
                type: ChargeType.RAFT,
                description: `ลบแพ ${item.raft.name}`,
                amount: -adjust,
              },
            });
          }
        }
        await tx.bookingRaft.deleteMany({
          where: { bookingId, raftId: { in: removeRaftIds } },
        });
      }

      for (const roomId of keepRoomIds) {
        const current = booking.rooms.find((item) => item.roomId === roomId);
        if (!current) continue;
        const nextExtra = resolveExtra(roomExtraMap.get(roomId) ?? current.isExtra);
        if (current.isExtra === nextExtra) continue;
        flagChanges += 1;
        await tx.bookingRoom.update({
          where: { id: current.id },
          data: { isExtra: nextExtra },
        });
        const amount = Number(current.rate) * nights;
        if (nextExtra) {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.ROOM,
              description: `คิดเพิ่มห้อง ${current.room.number} · ${nights} คืน`,
              amount,
            },
          });
        } else {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.ROOM,
              description: `ย้ายห้อง ${current.room.number} เข้าแพ็กเกจเหมา`,
              amount: -amount,
            },
          });
        }
      }

      for (const raftId of keepRaftIds) {
        const current = booking.rafts.find((item) => item.raftId === raftId);
        if (!current) continue;
        const nextExtra = resolveExtra(raftExtraMap.get(raftId) ?? current.isExtra);
        if (current.isExtra === nextExtra) continue;
        flagChanges += 1;
        await tx.bookingRaft.update({
          where: { id: current.id },
          data: { isExtra: nextExtra },
        });
        const amount = Number(current.rate) * nights;
        if (nextExtra) {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.RAFT,
              description: `คิดเพิ่มแพ ${current.raft.name} · ${nights} คืน`,
              amount,
            },
          });
        } else {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.RAFT,
              description: `ย้ายแพ ${current.raft.name} เข้าแพ็กเกจเหมา`,
              amount: -amount,
            },
          });
        }
      }

      if (addRoomIds.length) {
        const rooms = await tx.room.findMany({
          where: { id: { in: addRoomIds } },
          include: { roomType: true },
        });
        if (rooms.length !== addRoomIds.length) throw new Error("NOT_FOUND_RESOURCE");
        if (rooms.some((room) => !availableRoomStatuses.includes(room.status))) {
          throw new Error("ROOM_NOT_AVAILABLE");
        }
        const roomConflict = await tx.bookingRoom.findFirst({
          where: {
            roomId: { in: addRoomIds },
            bookingId: { not: bookingId },
            booking: {
              status: { in: activeBookingConflictStatuses },
              checkIn: { lt: booking.checkOut },
              checkOut: { gt: booking.checkIn },
            },
          },
          include: { room: true },
        });
        if (roomConflict) {
          throw new Error(`ROOM_CONFLICT:${roomConflict.room.number}`);
        }

        const roomPayload = rooms.map((room) => {
          const isExtra = resolveExtra(roomExtraMap.get(room.id) ?? true);
          return {
            room,
            isExtra,
            amount: Number(room.roomType.basePrice) * nights,
          };
        });

        await tx.bookingRoom.createMany({
          data: roomPayload.map(({ room, isExtra }) => ({
            bookingId,
            roomId: room.id,
            rate: room.roomType.basePrice,
            isExtra,
          })),
        });

        const extraRooms = roomPayload.filter((item) => item.isExtra);
        if (extraRooms.length) {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.ROOM,
              description: `เพิ่มห้องพักคิดเพิ่ม ${extraRooms.length} ห้อง · ${nights} คืน`,
              amount: extraRooms.reduce((sum, item) => sum + item.amount, 0),
            },
          });
        }

        if (booking.status === BookingStatus.CHECKED_IN) {
          await tx.room.updateMany({
            where: { id: { in: addRoomIds } },
            data: { status: RoomStatus.OCCUPIED },
          });
          const added = await tx.bookingRoom.findMany({
            where: { bookingId, roomId: { in: addRoomIds } },
            select: { id: true },
          });
          await tx.roomInspection.createMany({
            data: added.map((item) => ({ bookingRoomId: item.id })),
          });
        }
      }

      if (addRaftIds.length) {
        const rafts = await tx.raft.findMany({
          where: { id: { in: addRaftIds } },
        });
        if (rafts.length !== addRaftIds.length) throw new Error("NOT_FOUND_RESOURCE");
        if (rafts.some((raft) => !availableRaftStatuses.includes(raft.status))) {
          throw new Error("RAFT_NOT_AVAILABLE");
        }
        const raftConflict = await tx.bookingRaft.findFirst({
          where: {
            raftId: { in: addRaftIds },
            bookingId: { not: bookingId },
            booking: {
              status: { in: activeBookingConflictStatuses },
              checkIn: { lt: booking.checkOut },
              checkOut: { gt: booking.checkIn },
            },
          },
          include: { raft: true },
        });
        if (raftConflict) {
          throw new Error(`RAFT_CONFLICT:${raftConflict.raft.number}`);
        }

        const raftPayload = rafts.map((raft) => {
          const isExtra = resolveExtra(raftExtraMap.get(raft.id) ?? true);
          return {
            raft,
            isExtra,
            amount: Number(raft.basePrice) * nights,
          };
        });

        await tx.bookingRaft.createMany({
          data: raftPayload.map(({ raft, isExtra }) => ({
            bookingId,
            raftId: raft.id,
            rate: raft.basePrice,
            isExtra,
          })),
        });

        const extraRafts = raftPayload.filter((item) => item.isExtra);
        if (extraRafts.length) {
          await tx.charge.create({
            data: {
              bookingId,
              type: ChargeType.RAFT,
              description: `เพิ่มแพคิดเพิ่ม ${extraRafts.length} หลัง · ${nights} คืน`,
              amount: extraRafts.reduce((sum, item) => sum + item.amount, 0),
            },
          });
        }
      }

      return {
        removedRooms: removeRoomIds.length,
        addedRooms: addRoomIds.length,
        removedRafts: removeRaftIds.length,
        addedRafts: addRaftIds.length,
        pricingFlagChanges: flagChanges,
      };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_RESOURCES_UPDATED",
      entityType: "BOOKING",
      entityId: bookingId,
      metadata: result,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const labels: Record<string, [string, number]> = {
      NOT_FOUND: ["ไม่พบรายการจอง", 404],
      BOOKING_CLOSED: ["รายการจองนี้ปิดแล้ว", 400],
      NOT_FOUND_RESOURCE: ["ไม่พบห้องหรือแพที่เลือก", 400],
      ROOM_NOT_AVAILABLE: ["ห้องที่เลือกไม่พร้อมใช้งาน", 409],
      RAFT_NOT_AVAILABLE: ["แพที่เลือกไม่พร้อมใช้งาน", 409],
    };
    if (labels[message]) {
      return apiErrorResponse(labels[message][0], labels[message][1], message);
    }
    if (message.startsWith("ROOM_CONFLICT:")) {
      return apiErrorResponse(
        `ห้อง ${message.split(":")[1]} ไม่ว่าง`,
        409,
        "ROOM_CONFLICT",
      );
    }
    if (message.startsWith("RAFT_CONFLICT:")) {
      return apiErrorResponse(
        `แพ ${message.split(":")[1]} ไม่ว่าง`,
        409,
        "RAFT_CONFLICT",
      );
    }
    console.error("PATCH booking resources failed", error);
    return apiErrorResponse(
      "ไม่สามารถอัปเดตห้องหรือแพได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

