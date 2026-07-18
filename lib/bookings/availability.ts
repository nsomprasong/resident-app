import type {
  BookingStatus,
  RaftStatus,
  RoomStatus,
} from "@/generated/prisma/client";

export const activeBookingConflictStatuses: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
];

/**
 * Physical “free now” status for dashboard/ops (not used for date-range booking).
 */
export const availableRoomStatuses: RoomStatus[] = ["AVAILABLE"];

export const availableRaftStatuses: RaftStatus[] = ["AVAILABLE"];

/**
 * Statuses that may be assigned to a booking for a date range.
 * OCCUPIED/CLEANING are allowed because night locks use booking dates
 * (checkout day is free). Only MAINTENANCE blocks assignment.
 */
export const bookableRoomStatuses: RoomStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "CLEANING",
];

export const bookableRaftStatuses: RaftStatus[] = ["AVAILABLE"];

/**
 * Night occupancy is half-open [checkIn, checkOut):
 * stay 18→19 locks only the 18th; the 19th is free for the next booking.
 *
 * Prisma filter for an existing booking overlapping requested [checkIn, checkOut):
 *   existing.checkIn < requested.checkOut
 *   AND existing.checkOut > requested.checkIn
 */
export function bookingNightOverlapWhere(checkIn: Date, checkOut: Date) {
  return {
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  } as const;
}

/** Whether two stay ranges overlap under night-based (exclusive checkout) rules. */
export function bookingNightsOverlap(
  left: { checkIn: Date; checkOut: Date },
  right: { checkIn: Date; checkOut: Date },
): boolean {
  return left.checkIn < right.checkOut && right.checkIn < left.checkOut;
}

export function isRoomBookedForDateRange(options: {
  hasForeignBookingConflict: boolean;
  status: RoomStatus;
}): boolean {
  return (
    options.hasForeignBookingConflict || options.status === "MAINTENANCE"
  );
}
