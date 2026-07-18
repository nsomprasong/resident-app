import {
  BookingStatus,
  ChargeType,
  RoomStatus,
  type Prisma,
} from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
} from "@/lib/bookings/availability";
import {
  formatGroupPackageDescription,
  groupPackageAmount,
  isGroupPackageChargeDescription,
} from "@/lib/bookings/group-package";
import { bookingNights } from "@/lib/bookings/pricing-flags";
import { acquireBookingResourceLocks } from "@/lib/bookings/resource-locks";

export type StayResourceFlag = { id: string; isExtra: boolean };

export type StayConflictRoom = { id: string; number: string };
export type StayConflictRaft = { id: string; name: string };
export type StayKeepableRoom = StayConflictRoom & { isExtra: boolean };
export type StayKeepableRaft = StayConflictRaft & { isExtra: boolean };

export type StayResourceConflictPayload = {
  conflicts: {
    rooms: StayConflictRoom[];
    rafts: StayConflictRaft[];
  };
  keepable: {
    rooms: StayKeepableRoom[];
    rafts: StayKeepableRaft[];
  };
};

export class StayResourceConflictError extends Error {
  readonly payload: StayResourceConflictPayload;

  constructor(payload: StayResourceConflictPayload) {
    super("RESOURCE_CONFLICT");
    this.name = "StayResourceConflictError";
    this.payload = payload;
  }
}

export function parseStayDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function todayBangkokDate(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return parseStayDate(`${get("year")}-${get("month")}-${get("day")}`);
}

export type StayDatesInput =
  | {
      ok: true;
      checkIn: Date;
      checkOut: Date;
      checkInText: string;
      checkOutText: string;
    }
  | { ok: false; issues: ValidationIssue[] };

export function parseStayDatesInput(body: {
  checkIn?: unknown;
  checkOut?: unknown;
}): StayDatesInput {
  const issues: ValidationIssue[] = [];
  const checkInText =
    typeof body.checkIn === "string" ? body.checkIn.trim() : "";
  const checkOutText =
    typeof body.checkOut === "string" ? body.checkOut.trim() : "";

  if (!checkInText) {
    issues.push({ path: "checkIn", message: "Check-in date is required" });
  }
  if (!checkOutText) {
    issues.push({ path: "checkOut", message: "Check-out date is required" });
  }
  if (issues.length) return { ok: false, issues };

  const checkIn = parseStayDate(checkInText);
  const checkOut = parseStayDate(checkOutText);
  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime()) ||
    checkOut <= checkIn
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "checkOut",
          message: "Check-out date must be after check-in date",
        },
      ],
    };
  }

  return { ok: true, checkIn, checkOut, checkInText, checkOutText };
}

export function parseStayResourceFlags(
  value: unknown,
  path: string,
):
  | { ok: true; items: StayResourceFlag[] }
  | { ok: false; issues: ValidationIssue[] } {
  if (value === undefined) {
    return { ok: true, items: [] };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ path, message: `${path} must be an array` }],
    };
  }

  const issues: ValidationIssue[] = [];
  const byId = new Map<string, StayResourceFlag>();
  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({
        path: `${path}.${index}`,
        message: "Entry must be an object",
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
    byId.set(id, { id, isExtra: record.isExtra });
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, items: [...byId.values()] };
}

export function formatNightDeltaDescription(
  kind: "room" | "raft",
  label: string,
  deltaNights: number,
): string {
  const nightsLabel =
    deltaNights > 0 ? `+${deltaNights} คืน` : `${deltaNights} คืน`;
  return kind === "room"
    ? `ปรับวันเข้าพัก ห้อง ${label} · ${nightsLabel}`
    : `ปรับวันเข้าพัก แพ ${label} · ${nightsLabel}`;
}

type Tx = Prisma.TransactionClient;

type ChargeCreate = {
  bookingId: string;
  type: ChargeType;
  description: string;
  amount: number;
};

async function findConflictingRoomIds(
  tx: Tx,
  bookingId: string,
  roomIds: string[],
  checkIn: Date,
  checkOut: Date,
) {
  if (!roomIds.length) return [] as StayConflictRoom[];
  const rows = await tx.bookingRoom.findMany({
    where: {
      roomId: { in: roomIds },
      bookingId: { not: bookingId },
      booking: {
        status: { in: activeBookingConflictStatuses },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    },
    select: {
      roomId: true,
      room: { select: { number: true } },
    },
  });
  const byId = new Map<string, StayConflictRoom>();
  for (const row of rows) {
    byId.set(row.roomId, { id: row.roomId, number: row.room.number });
  }
  return [...byId.values()];
}

async function findConflictingRaftIds(
  tx: Tx,
  bookingId: string,
  raftIds: string[],
  checkIn: Date,
  checkOut: Date,
) {
  if (!raftIds.length) return [] as StayConflictRaft[];
  const rows = await tx.bookingRaft.findMany({
    where: {
      raftId: { in: raftIds },
      bookingId: { not: bookingId },
      booking: {
        status: { in: activeBookingConflictStatuses },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    },
    select: {
      raftId: true,
      raft: { select: { name: true } },
    },
  });
  const byId = new Map<string, StayConflictRaft>();
  for (const row of rows) {
    byId.set(row.raftId, { id: row.raftId, name: row.raft.name });
  }
  return [...byId.values()];
}

export async function applyBookingStayUpdate(
  tx: Tx,
  bookingId: string,
  input: {
    checkIn: Date;
    checkOut: Date;
    guestCount?: number;
    pricePerPerson?: number;
    enforceFutureCheckIn: boolean;
    rooms?: StayResourceFlag[];
    rafts?: StayResourceFlag[];
  },
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      closedAt: true,
      tourGroupId: true,
      checkIn: true,
      checkOut: true,
      guestCount: true,
      pricePerPerson: true,
      rooms: {
        include: {
          room: { select: { number: true } },
          inspection: { select: { id: true } },
        },
      },
      rafts: {
        include: { raft: { select: { name: true } } },
      },
      charges: {
        where: { type: ChargeType.OTHER },
        orderBy: { createdAt: "asc" },
        select: { id: true, description: true },
      },
    },
  });

  if (!booking) throw new Error("NOT_FOUND");
  if (
    booking.status === BookingStatus.CHECKED_OUT ||
    booking.status === BookingStatus.CANCELLED ||
    booking.closedAt
  ) {
    throw new Error("BOOKING_CLOSED");
  }

  const isGroup = Boolean(booking.tourGroupId);
  if (
    input.enforceFutureCheckIn &&
    booking.status === BookingStatus.PENDING &&
    input.checkIn < todayBangkokDate()
  ) {
    throw new Error("CHECKIN_IN_PAST");
  }

  if (isGroup) {
    if (
      input.guestCount === undefined ||
      input.pricePerPerson === undefined
    ) {
      throw new Error("PACKAGE_REQUIRED");
    }
  }

  const hasResourceOverride =
    input.rooms !== undefined || input.rafts !== undefined;
  const desiredRooms =
    input.rooms ??
    booking.rooms.map((item) => ({
      id: item.roomId,
      isExtra: item.isExtra,
    }));
  const desiredRafts =
    input.rafts ??
    booking.rafts.map((item) => ({
      id: item.raftId,
      isExtra: item.isExtra,
    }));

  if (hasResourceOverride && !desiredRooms.length && !desiredRafts.length) {
    throw new Error("RESOURCES_REQUIRED");
  }

  const checkRoomIds = hasResourceOverride
    ? desiredRooms.map((item) => item.id)
    : booking.rooms.map((item) => item.roomId);
  const checkRaftIds = hasResourceOverride
    ? desiredRafts.map((item) => item.id)
    : booking.rafts.map((item) => item.raftId);

  const conflictingRooms = await findConflictingRoomIds(
    tx,
    bookingId,
    checkRoomIds,
    input.checkIn,
    input.checkOut,
  );
  const conflictingRafts = await findConflictingRaftIds(
    tx,
    bookingId,
    checkRaftIds,
    input.checkIn,
    input.checkOut,
  );

  if (conflictingRooms.length || conflictingRafts.length) {
    if (!hasResourceOverride) {
      const conflictRoomIds = new Set(conflictingRooms.map((item) => item.id));
      const conflictRaftIds = new Set(conflictingRafts.map((item) => item.id));
      throw new StayResourceConflictError({
        conflicts: {
          rooms: conflictingRooms,
          rafts: conflictingRafts,
        },
        keepable: {
          rooms: booking.rooms
            .filter((item) => !conflictRoomIds.has(item.roomId))
            .map((item) => ({
              id: item.roomId,
              number: item.room.number,
              isExtra: item.isExtra,
            })),
          rafts: booking.rafts
            .filter((item) => !conflictRaftIds.has(item.raftId))
            .map((item) => ({
              id: item.raftId,
              name: item.raft.name,
              isExtra: item.isExtra,
            })),
        },
      });
    }
    if (conflictingRooms.length) {
      throw new Error(`ROOM_CONFLICT:${conflictingRooms[0].number}`);
    }
    throw new Error(`RAFT_CONFLICT:${conflictingRafts[0].name}`);
  }

  const previousNights = bookingNights(booking.checkIn, booking.checkOut);
  const nextNights = bookingNights(input.checkIn, input.checkOut);
  const deltaNights = nextNights - previousNights;
  const resolveExtra = (requested: boolean) => (isGroup ? requested : true);

  const previousGuestCount = booking.guestCount;
  const previousPricePerPerson = booking.pricePerPerson
    ? Number(booking.pricePerPerson)
    : null;

  const chargeCreates: ChargeCreate[] = [];
  let replacedResources = false;

  if (hasResourceOverride) {
    const nextRooms = desiredRooms.map((item) => ({
      id: item.id,
      isExtra: resolveExtra(item.isExtra),
    }));
    const nextRafts = desiredRafts.map((item) => ({
      id: item.id,
      isExtra: resolveExtra(item.isExtra),
    }));
    const nextRoomIds = nextRooms.map((item) => item.id);
    const nextRaftIds = nextRafts.map((item) => item.id);
    const roomExtraMap = new Map(nextRooms.map((item) => [item.id, item.isExtra]));
    const raftExtraMap = new Map(nextRafts.map((item) => [item.id, item.isExtra]));

    const currentRoomIds = booking.rooms.map((item) => item.roomId);
    const currentRaftIds = booking.rafts.map((item) => item.raftId);
    const removeRoomIds = currentRoomIds.filter((id) => !nextRoomIds.includes(id));
    const addRoomIds = nextRoomIds.filter((id) => !currentRoomIds.includes(id));
    const keepRoomIds = nextRoomIds.filter((id) => currentRoomIds.includes(id));
    const removeRaftIds = currentRaftIds.filter((id) => !nextRaftIds.includes(id));
    const addRaftIds = nextRaftIds.filter((id) => !currentRaftIds.includes(id));
    const keepRaftIds = nextRaftIds.filter((id) => currentRaftIds.includes(id));

    await acquireBookingResourceLocks(tx, {
      roomIds: [...removeRoomIds, ...addRoomIds, ...keepRoomIds],
      raftIds: [...removeRaftIds, ...addRaftIds, ...keepRaftIds],
    });

    if (removeRoomIds.length) {
      const removing = booking.rooms.filter((item) =>
        removeRoomIds.includes(item.roomId),
      );
      for (const item of removing) {
        const billed = isGroup ? item.isExtra : true;
        if (!billed) continue;
        const adjust = Number(item.rate) * previousNights;
        if (adjust === 0) continue;
        chargeCreates.push({
          bookingId,
          type: ChargeType.ROOM,
          description: `เลื่อนวัน ลบห้อง ${item.room.number}`,
          amount: -adjust,
        });
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
        const billed = isGroup ? item.isExtra : true;
        if (!billed) continue;
        const adjust = Number(item.rate) * previousNights;
        if (adjust === 0) continue;
        chargeCreates.push({
          bookingId,
          type: ChargeType.RAFT,
          description: `เลื่อนวัน ลบแพ ${item.raft.name}`,
          amount: -adjust,
        });
      }
      await tx.bookingRaft.deleteMany({
        where: { bookingId, raftId: { in: removeRaftIds } },
      });
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        ...(isGroup
          ? {
              guestCount: input.guestCount,
              pricePerPerson: input.pricePerPerson,
            }
          : {}),
      },
    });

    for (const roomId of keepRoomIds) {
      const current = booking.rooms.find((item) => item.roomId === roomId);
      if (!current) continue;
      const nextExtra = roomExtraMap.get(roomId) ?? current.isExtra;
      if (current.isExtra !== nextExtra) {
        await tx.bookingRoom.update({
          where: { id: current.id },
          data: { isExtra: nextExtra },
        });
        const amount = Number(current.rate) * nextNights;
        chargeCreates.push({
          bookingId,
          type: ChargeType.ROOM,
          description: nextExtra
            ? `คิดเพิ่มห้อง ${current.room.number} · ${nextNights} คืน`
            : `ย้ายห้อง ${current.room.number} เข้าแพ็กเกจเหมา`,
          amount: nextExtra ? amount : -amount,
        });
      } else if (deltaNights !== 0) {
        const billed = isGroup ? nextExtra : true;
        if (billed) {
          const amount = Number(current.rate) * deltaNights;
          if (amount !== 0) {
            chargeCreates.push({
              bookingId,
              type: ChargeType.ROOM,
              description: formatNightDeltaDescription(
                "room",
                current.room.number,
                deltaNights,
              ),
              amount,
            });
          }
        }
      }
    }

    for (const raftId of keepRaftIds) {
      const current = booking.rafts.find((item) => item.raftId === raftId);
      if (!current) continue;
      const nextExtra = raftExtraMap.get(raftId) ?? current.isExtra;
      if (current.isExtra !== nextExtra) {
        await tx.bookingRaft.update({
          where: { id: current.id },
          data: { isExtra: nextExtra },
        });
        const amount = Number(current.rate) * nextNights;
        chargeCreates.push({
          bookingId,
          type: ChargeType.RAFT,
          description: nextExtra
            ? `คิดเพิ่มแพ ${current.raft.name} · ${nextNights} คืน`
            : `ย้ายแพ ${current.raft.name} เข้าแพ็กเกจเหมา`,
          amount: nextExtra ? amount : -amount,
        });
      } else if (deltaNights !== 0) {
        const billed = isGroup ? nextExtra : true;
        if (billed) {
          const amount = Number(current.rate) * deltaNights;
          if (amount !== 0) {
            chargeCreates.push({
              bookingId,
              type: ChargeType.RAFT,
              description: formatNightDeltaDescription(
                "raft",
                current.raft.name,
                deltaNights,
              ),
              amount,
            });
          }
        }
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
      const roomPayload = rooms.map((room) => {
        const isExtra = roomExtraMap.get(room.id) ?? true;
        return {
          room,
          isExtra,
          amount: Number(room.roomType.basePrice) * nextNights,
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
      const billedRooms = roomPayload.filter((item) => item.isExtra || !isGroup);
      if (billedRooms.length) {
        chargeCreates.push({
          bookingId,
          type: ChargeType.ROOM,
          description: `เลื่อนวัน เพิ่มห้อง ${billedRooms.length} ห้อง · ${nextNights} คืน`,
          amount: billedRooms.reduce((sum, item) => sum + item.amount, 0),
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
      const raftPayload = rafts.map((raft) => {
        const isExtra = raftExtraMap.get(raft.id) ?? true;
        return {
          raft,
          isExtra,
          amount: Number(raft.basePrice) * nextNights,
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
      const billedRafts = raftPayload.filter((item) => item.isExtra || !isGroup);
      if (billedRafts.length) {
        chargeCreates.push({
          bookingId,
          type: ChargeType.RAFT,
          description: `เลื่อนวัน เพิ่มแพ ${billedRafts.length} หลัง · ${nextNights} คืน`,
          amount: billedRafts.reduce((sum, item) => sum + item.amount, 0),
        });
      }
    }

    replacedResources = true;
  } else {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        ...(isGroup
          ? {
              guestCount: input.guestCount,
              pricePerPerson: input.pricePerPerson,
            }
          : {}),
      },
    });

    if (deltaNights !== 0) {
      for (const item of booking.rooms) {
        const billed = isGroup ? item.isExtra : true;
        if (!billed) continue;
        const amount = Number(item.rate) * deltaNights;
        if (amount === 0) continue;
        chargeCreates.push({
          bookingId,
          type: ChargeType.ROOM,
          description: formatNightDeltaDescription(
            "room",
            item.room.number,
            deltaNights,
          ),
          amount,
        });
      }
      for (const item of booking.rafts) {
        const billed = isGroup ? item.isExtra : true;
        if (!billed) continue;
        const amount = Number(item.rate) * deltaNights;
        if (amount === 0) continue;
        chargeCreates.push({
          bookingId,
          type: ChargeType.RAFT,
          description: formatNightDeltaDescription(
            "raft",
            item.raft.name,
            deltaNights,
          ),
          amount,
        });
      }
    }
  }

  let packageAmount: number | null = null;
  if (
    isGroup &&
    input.guestCount !== undefined &&
    input.pricePerPerson !== undefined
  ) {
    packageAmount = groupPackageAmount(input.guestCount, input.pricePerPerson);
    const description = formatGroupPackageDescription(
      input.guestCount,
      input.pricePerPerson,
    );
    const packageCharge = booking.charges.find((charge) =>
      isGroupPackageChargeDescription(charge.description),
    );
    if (packageCharge) {
      await tx.charge.update({
        where: { id: packageCharge.id },
        data: { description, amount: packageAmount },
      });
    } else {
      chargeCreates.push({
        bookingId,
        type: ChargeType.OTHER,
        description,
        amount: packageAmount,
      });
    }
  }

  if (chargeCreates.length) {
    await tx.charge.createMany({ data: chargeCreates });
  }

  return {
    isGroup,
    checkIn: input.checkIn.toISOString().slice(0, 10),
    checkOut: input.checkOut.toISOString().slice(0, 10),
    previousNights,
    nextNights,
    deltaNights,
    guestCount: isGroup ? (input.guestCount ?? null) : null,
    pricePerPerson: isGroup ? (input.pricePerPerson ?? null) : null,
    packageAmount,
    previousGuestCount,
    previousPricePerPerson,
    previousCheckIn: booking.checkIn.toISOString().slice(0, 10),
    previousCheckOut: booking.checkOut.toISOString().slice(0, 10),
    nightChargeCount: chargeCreates.filter(
      (item) => item.type !== ChargeType.OTHER,
    ).length,
    replacedResources,
  };
}
