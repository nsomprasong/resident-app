/** Lexicographic sort with numeric awareness: 1, 2, 10 (not 1, 10, 2). */
export function compareRoomNumbers(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function compareRoomsByZoneAndNumber(
  a: { number: string; zoneName: string },
  b: { number: string; zoneName: string },
): number {
  const zoneCmp = a.zoneName.localeCompare(b.zoneName, "th", {
    sensitivity: "base",
  });
  if (zoneCmp !== 0) return zoneCmp;
  return compareRoomNumbers(a.number, b.number);
}

export function sortRoomsByZoneAndNumber<
  T extends { number: string; zone: { name: string } },
>(rooms: readonly T[]): T[] {
  return [...rooms].sort((left, right) =>
    compareRoomsByZoneAndNumber(
      { number: left.number, zoneName: left.zone.name },
      { number: right.number, zoneName: right.zone.name },
    ),
  );
}
