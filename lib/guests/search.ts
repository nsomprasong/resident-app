import { prisma } from "@/lib/prisma";

export type GuestSuggestKind = "guest" | "tour_group";

export type GuestSuggestItem = {
  id: string;
  kind: GuestSuggestKind;
  name: string;
  contactName: string | null;
  phone: string | null;
  bookingCount: number;
};

function displayGuestName(firstName: string, lastName: string) {
  return [firstName, lastName === "-" ? "" : lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export async function searchGuestHistory(options: {
  query: string;
  includeTourGroups?: boolean;
  limit?: number;
}): Promise<GuestSuggestItem[]> {
  const query = options.query.trim();
  if (query.length < 1) return [];

  const limit = Math.min(20, Math.max(1, options.limit ?? 12));
  const tokens = query.split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] ?? query;
  const restToken = tokens.slice(1).join(" ");

  const guests = await prisma.guest.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        ...(restToken
          ? [
              {
                AND: [
                  { firstName: { contains: firstToken, mode: "insensitive" as const } },
                  { lastName: { contains: restToken, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    include: {
      _count: { select: { bookings: true } },
    },
  });

  const items: GuestSuggestItem[] = guests.map((guest) => ({
    id: guest.id,
    kind: "guest",
    name: displayGuestName(guest.firstName, guest.lastName),
    contactName: null,
    phone: guest.phone,
    bookingCount: guest._count.bookings,
  }));

  if (!options.includeTourGroups) return items;

  const groups = await prisma.tourGroup.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    include: {
      _count: { select: { bookings: true } },
    },
  });

  for (const group of groups) {
    items.push({
      id: group.id,
      kind: "tour_group",
      name: group.name,
      contactName: group.contactName,
      phone: group.phone,
      bookingCount: group._count.bookings,
    });
  }

  return items
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, limit);
}
