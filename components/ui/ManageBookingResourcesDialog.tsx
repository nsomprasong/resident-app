"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";

import Modal from "./Modal";
import PricingToggle from "./PricingToggle";
import RaftSelect from "./RaftSelect";
import ZoneRoomSelect from "./ZoneRoomSelect";

export type ManagedResource = {
  id: string;
  label: string;
  rate: number;
  isExtra: boolean;
};

type ResourceDraft = {
  id: string;
  isExtra: boolean;
};

export default function ManageBookingResourcesDialog({
  open,
  setOpen,
  bookingId,
  checkIn,
  checkOut,
  mode,
  initialRooms,
  initialRafts,
  onSaved,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  mode: "group" | "solo";
  initialRooms: ManagedResource[];
  initialRafts: ManagedResource[];
  onSaved: () => void;
}) {
  const isGroup = mode === "group";
  const [rooms, setRooms] = useState<ResourceDraft[]>([]);
  const [rafts, setRafts] = useState<ResourceDraft[]>([]);
  const [roomMeta, setRoomMeta] = useState<Record<string, ManagedResource>>({});
  const [raftMeta, setRaftMeta] = useState<Record<string, ManagedResource>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRooms(
      initialRooms.map((room) => ({
        id: room.id,
        isExtra: isGroup ? room.isExtra : true,
      })),
    );
    setRafts(
      initialRafts.map((raft) => ({
        id: raft.id,
        isExtra: isGroup ? raft.isExtra : true,
      })),
    );
    setRoomMeta(
      Object.fromEntries(initialRooms.map((room) => [room.id, room])),
    );
    setRaftMeta(
      Object.fromEntries(initialRafts.map((raft) => [raft.id, raft])),
    );
    setError("");

    const loadCatalog = async () => {
      try {
        const params = new URLSearchParams({
          checkIn,
          checkOut,
          excludeBookingId: bookingId,
        });
        const [roomsRes, raftsRes] = await Promise.all([
          fetch(`/api/rooms?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/rafts?${params.toString()}`, { cache: "no-store" }),
        ]);
        if (roomsRes.ok) {
          const roomsData = (await roomsRes.json()) as Array<{
            id: string;
            number: string;
            roomType?: { basePrice?: number };
          }>;
          setRoomMeta((current) => {
            const next = { ...current };
            for (const room of roomsData) {
              next[room.id] = {
                id: room.id,
                label: room.number,
                rate: Number(room.roomType?.basePrice ?? next[room.id]?.rate ?? 0),
                isExtra: next[room.id]?.isExtra ?? true,
              };
            }
            return next;
          });
        }
        if (raftsRes.ok) {
          const raftsData = (await raftsRes.json()) as Array<{
            id: string;
            name: string;
            basePrice: number;
          }>;
          setRaftMeta((current) => {
            const next = { ...current };
            for (const raft of raftsData) {
              next[raft.id] = {
                id: raft.id,
                label: raft.name,
                rate: Number(raft.basePrice),
                isExtra: next[raft.id]?.isExtra ?? true,
              };
            }
            return next;
          });
        }
      } catch {
        /* keep initial meta */
      }
    };
    void loadCatalog();
  }, [open, initialRooms, initialRafts, isGroup, checkIn, checkOut, bookingId]);

  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);
  const raftIds = useMemo(() => rafts.map((raft) => raft.id), [rafts]);

  const setRoomIds = (ids: string[]) => {
    setRooms((current) => {
      const currentMap = new Map(current.map((item) => [item.id, item]));
      return ids.map((id) => {
        const existing = currentMap.get(id);
        if (existing) return existing;
        const known = roomMeta[id];
        return {
          id,
          isExtra: isGroup ? (known?.isExtra ?? true) : true,
        };
      });
    });
  };

  const setRaftIds = (ids: string[]) => {
    setRafts((current) => {
      const currentMap = new Map(current.map((item) => [item.id, item]));
      return ids.map((id) => {
        const existing = currentMap.get(id);
        if (existing) return existing;
        const known = raftMeta[id];
        return {
          id,
          isExtra: isGroup ? (known?.isExtra ?? true) : true,
        };
      });
    });
  };

  const setRoomExtra = (id: string, isExtra: boolean) => {
    setRooms((current) =>
      current.map((item) => (item.id === id ? { ...item, isExtra } : item)),
    );
  };

  const setRaftExtra = (id: string, isExtra: boolean) => {
    setRafts((current) =>
      current.map((item) => (item.id === id ? { ...item, isExtra } : item)),
    );
  };

  const submit = async () => {
    if (!rooms.length && !rafts.length) {
      setError("ต้องมีห้องหรือแพอย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/resources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: rooms.map((room) => ({
            id: room.id,
            isExtra: isGroup ? room.isExtra : true,
          })),
          rafts: rafts.map((raft) => ({
            id: raft.id,
            isExtra: isGroup ? raft.isExtra : true,
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "บันทึกการเปลี่ยนแปลงไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="จัดการห้องและแพ"
      size="lg"
      fullScreenOnMobile
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <X size={17} />
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || (!rooms.length && !rafts.length)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          เลือก/ยกเลิกห้องและแพได้ตามต้องการ ต้องเหลืออย่างน้อย 1 รายการ
          {isGroup
            ? " และกำหนดได้ว่าแต่ละรายการรวมในราคาเหมาหรือคิดเพิ่ม"
            : ""}
        </p>
        <ZoneRoomSelect
          selectedRoomIds={roomIds}
          onChange={setRoomIds}
          checkIn={checkIn}
          checkOut={checkOut}
          excludeBookingId={bookingId}
        />
        {isGroup && rooms.length > 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">
              การคิดเงินห้องที่เลือก
            </h4>
            <ul className="space-y-2">
              {rooms.map((room) => {
                const meta = roomMeta[room.id];
                return (
                  <li
                    key={room.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">
                        ห้อง {meta?.label ?? room.id.slice(0, 8)}
                      </p>
                      {meta ? (
                        <p className="text-xs text-muted-foreground">
                          ฿{meta.rate.toLocaleString()} / คืน
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          รายการใหม่ — ตั้งค่าการคิดเงินด้านขวา
                        </p>
                      )}
                    </div>
                    <PricingToggle
                      value={room.isExtra}
                      onChange={(isExtra) => setRoomExtra(room.id, isExtra)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        <RaftSelect
          selectedRaftIds={raftIds}
          onChange={setRaftIds}
          checkIn={checkIn}
          checkOut={checkOut}
          excludeBookingId={bookingId}
        />
        {isGroup && rafts.length > 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">
              การคิดเงินแพที่เลือก
            </h4>
            <ul className="space-y-2">
              {rafts.map((raft) => {
                const meta = raftMeta[raft.id];
                return (
                  <li
                    key={raft.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">
                        {meta?.label ?? `แพ ${raft.id.slice(0, 8)}`}
                      </p>
                      {meta ? (
                        <p className="text-xs text-muted-foreground">
                          ฿{meta.rate.toLocaleString()} / คืน
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          รายการใหม่ — ตั้งค่าการคิดเงินด้านขวา
                        </p>
                      )}
                    </div>
                    <PricingToggle
                      value={raft.isExtra}
                      onChange={(isExtra) => setRaftExtra(raft.id, isExtra)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
