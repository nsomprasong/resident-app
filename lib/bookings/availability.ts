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

export const availableRoomStatuses: RoomStatus[] = ["AVAILABLE"];

export const availableRaftStatuses: RaftStatus[] = ["AVAILABLE"];
