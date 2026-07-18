"use client";

import { BedDouble, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { compareRoomsByZoneAndNumber } from "@/lib/bookings/room-sort";
import { BED_LAYOUTS, resolveBedLayout } from "@/lib/settings/bed-types";

import RoomIconSelect from "./RoomIconSlect";

interface Room {
  id: string | number;
  number?: string;
  roomNo?: string | number;
  booked?: boolean;
  status?: string;
  zone?: { id: string; name: string };
  roomType?: {
    id?: string;
    name: string;
    bedType?: string | null;
    capacity?: number;
    basePrice?: number;
  };
}

/** Night lock from API `booked` only — never lock because status is OCCUPIED/CLEANING. */
function isRoomUnavailable(room: Room, selected: boolean): boolean {
  if (selected) return false;
  return room.booked === true;
}

export default function ZoneRoomSelect({
  selectedRoomIds = [],
  onChange,
  checkIn,
  checkOut,
  excludeBookingId,
}: {
  selectedRoomIds?: string[];
  onChange?: (roomIds: string[]) => void;
  checkIn?: string;
  checkOut?: string;
  excludeBookingId?: string;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [zone, setZone] = useState("all");
  const [roomType, setRoomType] = useState("all");
  const [bedLayout, setBedLayout] = useState("all");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const params = new URLSearchParams();
        if (checkIn && checkOut) {
          params.set("checkIn", checkIn);
          params.set("checkOut", checkOut);
        }
        if (excludeBookingId) params.set("excludeBookingId", excludeBookingId);
        const queryText = params.toString();
        const response = await fetch(
          `/api/rooms${queryText ? `?${queryText}` : ""}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const data = (await response.json()) as Room[];
        if (Array.isArray(data)) setRooms(data);
      } catch {
        setRooms([]);
        setLoadError("โหลดห้องไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [checkIn, checkOut, excludeBookingId]);

  const zones = useMemo(
    () =>
      Array.from(
        new Map(
          rooms
            .filter((room) => room.zone)
            .map((room) => [room.zone!.id, room.zone!]),
        ).values(),
      ).sort((left, right) =>
        left.name.localeCompare(right.name, "th", { sensitivity: "base" }),
      ),
    [rooms],
  );

  const roomTypes = useMemo(
    () =>
      Array.from(
        new Map(
          rooms
            .filter((room) => room.roomType?.name)
            .map((room) => [room.roomType!.name, room.roomType!.name]),
        ).values(),
      ),
    [rooms],
  );

  const freeCount = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.booked !== true || selectedRoomIds.includes(String(room.id)),
      ).length,
    [rooms, selectedRoomIds],
  );

  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rooms
      .filter((room) => {
        const id = String(room.id);
        const selected = selectedRoomIds.includes(id);
        const unavailable = isRoomUnavailable(room, selected);
        const matchAvailable = !availableOnly || !unavailable || selected;
        const matchZone = zone === "all" || room.zone?.id === zone;
        const matchType = roomType === "all" || room.roomType?.name === roomType;
        const layout = resolveBedLayout(
          room.roomType?.bedType,
          room.roomType?.capacity,
        );
        const matchBed = bedLayout === "all" || layout?.code === bedLayout;
        const roomLabel = String(
          room.number ?? room.roomNo ?? room.id,
        ).toLowerCase();
        const matchQuery = !normalized || roomLabel.includes(normalized);
        return (
          matchAvailable &&
          matchZone &&
          matchType &&
          matchBed &&
          matchQuery
        );
      })
      .sort((left, right) => {
        const leftId = String(left.id);
        const rightId = String(right.id);
        const leftLocked = isRoomUnavailable(
          left,
          selectedRoomIds.includes(leftId),
        );
        const rightLocked = isRoomUnavailable(
          right,
          selectedRoomIds.includes(rightId),
        );
        if (leftLocked !== rightLocked) return leftLocked ? 1 : -1;
        return compareRoomsByZoneAndNumber(
          {
            number: String(left.number ?? left.roomNo ?? left.id),
            zoneName: left.zone?.name ?? "",
          },
          {
            number: String(right.number ?? right.roomNo ?? right.id),
            zoneName: right.zone?.name ?? "",
          },
        );
      });
  }, [
    availableOnly,
    bedLayout,
    query,
    roomType,
    rooms,
    selectedRoomIds,
    zone,
  ]);

  const roomsByZone = useMemo(() => {
    if (zone !== "all") {
      return [
        {
          zoneId: zone,
          zoneName: zones.find((item) => item.id === zone)?.name ?? "",
          rooms: visibleRooms,
        },
      ];
    }
    const groups = new Map<string, { zoneId: string; zoneName: string; rooms: Room[] }>();
    for (const room of visibleRooms) {
      const zoneId = room.zone?.id ?? "unknown";
      const zoneName = room.zone?.name ?? "ไม่มีโซน";
      const current = groups.get(zoneId);
      if (current) {
        current.rooms.push(room);
      } else {
        groups.set(zoneId, { zoneId, zoneName, rooms: [room] });
      }
    }
    return Array.from(groups.values());
  }, [visibleRooms, zone, zones]);

  const selectedRooms = rooms
    .filter((room) => selectedRoomIds.includes(String(room.id)))
    .sort((left, right) =>
      compareRoomsByZoneAndNumber(
        {
          number: String(left.number ?? left.roomNo ?? left.id),
          zoneName: left.zone?.name ?? "",
        },
        {
          number: String(right.number ?? right.roomNo ?? right.id),
          zoneName: right.zone?.name ?? "",
        },
      ),
    );
  const roomTotal = selectedRooms.reduce(
    (sum, room) => sum + Number(room.roomType?.basePrice ?? 0),
    0,
  );

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
    const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
    const value = Math.round((end - start) / 86_400_000);
    return Math.max(1, value);
  }, [checkIn, checkOut]);

  const toggle = (id: string) =>
    onChange?.(
      selectedRoomIds.includes(id)
        ? selectedRoomIds.filter((item) => item !== id)
        : [...selectedRoomIds, id],
    );

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <BedDouble size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">ห้องพัก</h3>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "กำลังตรวจสอบห้องว่าง..."
              : `ว่าง ${freeCount.toLocaleString("th-TH")}/${rooms.length.toLocaleString("th-TH")} ห้องในช่วงวันที่เลือก`}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            โซน
            <select
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="all">ทุกโซน</option>
              {zones.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            ประเภทห้อง
            <select
              value={roomType}
              onChange={(event) => setRoomType(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="all">ทุกประเภท</option>
              {roomTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            จำนวนเตียง
            <select
              value={bedLayout}
              onChange={(event) => setBedLayout(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="all">ทุกแบบ</option>
              {BED_LAYOUTS.map((layout) => (
                <option key={layout.code} value={layout.code}>
                  {layout.label}
                </option>
              ))}
            </select>
          </label>
          <label className="relative text-xs text-muted-foreground">
            ค้นหาเลขห้อง
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-8 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="เช่น B01 หรือ 101"
              className="mt-1 w-full rounded-xl border border-border bg-surface py-2 pl-8 pr-3 text-sm"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
            className="rounded border-border"
          />
          แสดงเฉพาะห้องว่าง
        </label>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบห้องว่าง...</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-2">
            {visibleRooms.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {availableOnly && freeCount === 0
                  ? "ไม่มีห้องว่างในช่วงวันที่เลือก — ลองเปลี่ยนวันหรือปิดตัวกรองห้องว่าง"
                  : "ไม่พบห้องตามตัวกรอง"}
              </p>
            ) : (
              <div className="space-y-3">
                {roomsByZone.map((group) => (
                  <div key={group.zoneId} className="space-y-2">
                    {zone === "all" && group.zoneName ? (
                      <p className="px-1 text-xs font-medium text-muted-foreground">
                        {group.zoneName}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {group.rooms.map((room) => {
                        const id = String(room.id);
                        return (
                          <RoomIconSelect
                            key={id}
                            roomNo={String(
                              room.number ?? room.roomNo ?? room.id,
                            )}
                            booked={isRoomUnavailable(
                              room,
                              selectedRoomIds.includes(id),
                            )}
                            selected={selectedRoomIds.includes(id)}
                            onToggle={() => toggle(id)}
                            roomType={room.roomType?.name}
                            bedType={room.roomType?.bedType}
                            capacity={room.roomType?.capacity}
                            price={
                              typeof room.roomType?.basePrice === "number"
                                ? room.roomType.basePrice
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-background px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground">
              เลือกแล้ว{" "}
              <span className="font-medium text-foreground">
                {selectedRooms.length} ห้อง
              </span>
              {selectedRooms.length > 0 ? (
                <span>
                  {" "}
                  (
                  {selectedRooms
                    .map((room) => room.number ?? room.roomNo)
                    .join(", ")}
                  )
                </span>
              ) : null}
            </p>
            <p className="font-semibold text-primary">
              รวม ฿{(roomTotal * nights).toLocaleString("th-TH")}
              {nights > 1 ? ` / ${nights} คืน` : ""}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
