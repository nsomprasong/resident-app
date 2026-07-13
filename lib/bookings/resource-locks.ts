import { Prisma } from "@/generated/prisma/client";

type BookingResourceLockClient = {
  $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<number>;
};

type BookingResourceLocks = {
  roomIds: string[];
  raftIds: string[];
};

export async function acquireBookingResourceLocks(
  client: BookingResourceLockClient,
  resources: BookingResourceLocks,
) {
  const lockKeys = [
    ...resources.roomIds.map((id) => `booking-room:${id}`),
    ...resources.raftIds.map((id) => `booking-raft:${id}`),
  ];

  for (const lockKey of [...new Set(lockKeys)].sort()) {
    await client.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `;
  }
}
