import type { BookingStatus } from "@/generated/prisma/client";

export const todayOpsBookingStatuses: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
];

export type TodayOpsBookingInput = {
  checkIn: Date;
  checkOut: Date;
  tourGroupId: string | null;
  guestCount: number | null;
  roomCount: number;
  raftCount: number;
};

export type TodayOpsFoodInput = {
  quantity: number;
  isMinibar: boolean;
};

export type TodayOpsSummary = {
  roomsCheckInToday: number;
  roomsInHouse: number;
  tourGroupsToday: number;
  raftsToday: number;
  guestsToday: number;
  foodPortionsToday: number;
  foodKindsToday: number;
  minibarPortionsToday: number;
  checkInBookingCount: number;
  inHouseBookingCount: number;
};

function dateKeyUtc(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function summarizeTodayOps(input: {
  todayKey: string;
  bookings: TodayOpsBookingInput[];
  foodItems: TodayOpsFoodInput[];
  /** distinct non-minibar product ids ordered today */
  foodProductIds: string[];
}): TodayOpsSummary {
  const inHouse = input.bookings.filter(
    (booking) =>
      dateKeyUtc(booking.checkIn) <= input.todayKey &&
      dateKeyUtc(booking.checkOut) > input.todayKey,
  );
  const checkIns = inHouse.filter(
    (booking) => dateKeyUtc(booking.checkIn) === input.todayKey,
  );

  const tourGroupIds = new Set(
    inHouse
      .map((booking) => booking.tourGroupId)
      .filter((id): id is string => Boolean(id)),
  );

  const foodPortionsToday = input.foodItems
    .filter((item) => !item.isMinibar)
    .reduce((sum, item) => sum + item.quantity, 0);
  const minibarPortionsToday = input.foodItems
    .filter((item) => item.isMinibar)
    .reduce((sum, item) => sum + item.quantity, 0);

  return {
    roomsCheckInToday: checkIns.reduce(
      (sum, booking) => sum + booking.roomCount,
      0,
    ),
    roomsInHouse: inHouse.reduce((sum, booking) => sum + booking.roomCount, 0),
    tourGroupsToday: tourGroupIds.size,
    raftsToday: inHouse.reduce((sum, booking) => sum + booking.raftCount, 0),
    guestsToday: inHouse.reduce(
      (sum, booking) => sum + (booking.guestCount ?? 0),
      0,
    ),
    foodPortionsToday,
    foodKindsToday: new Set(input.foodProductIds).size,
    minibarPortionsToday,
    checkInBookingCount: checkIns.length,
    inHouseBookingCount: inHouse.length,
  };
}

export function bangkokTodayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Calendar day bounds in Asia/Bangkok as absolute Date range */
export function bangkokDayBounds(todayKey: string) {
  const start = new Date(`${todayKey}T00:00:00+07:00`);
  const end = new Date(`${todayKey}T23:59:59.999+07:00`);
  return { start, end };
}

export function bangkokDateOnly(todayKey: string) {
  return new Date(`${todayKey}T00:00:00.000Z`);
}
