import { Prisma } from "@/generated/prisma/client";

type FinancialLockClient = {
  $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<number>;
};

export async function acquireBookingFinancialLock(
  client: FinancialLockClient,
  bookingId: string,
) {
  await client.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${"booking-financial:" + bookingId}, 0))
  `;
}
