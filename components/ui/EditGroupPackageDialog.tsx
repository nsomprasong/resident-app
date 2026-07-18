"use client";

import { useEffect, useState } from "react";

import DateSelector from "@/components/ui/DateSelector";
import Modal from "@/components/ui/Modal";
import NumberInput from "@/components/ui/NumberInput";
import RaftSelect from "@/components/ui/RaftSelect";
import ZoneRoomSelect from "@/components/ui/ZoneRoomSelect";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";

const nextDate = (date: string) => {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const nightsBetween = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
};

type ConflictRoom = { id: string; number: string };
type ConflictRaft = { id: string; name: string };
type KeepableRoom = ConflictRoom & { isExtra: boolean };
type KeepableRaft = ConflictRaft & { isExtra: boolean };

export default function EditGroupPackageDialog({
  open,
  setOpen,
  bookingId,
  mode,
  initialCheckIn,
  initialCheckOut,
  initialGuestCount,
  initialPricePerPerson,
  initialRooms,
  initialRafts,
  onSaved,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  bookingId: string;
  mode: "group" | "solo";
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuestCount: number;
  initialPricePerPerson: number;
  initialRooms: Array<{ id: string; isExtra: boolean }>;
  initialRafts: Array<{ id: string; isExtra: boolean }>;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"form" | "resources">("form");
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guestCount, setGuestCount] = useState(initialGuestCount);
  const [pricePerPerson, setPricePerPerson] = useState(initialPricePerPerson);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedRaftIds, setSelectedRaftIds] = useState<string[]>([]);
  const [roomExtraById, setRoomExtraById] = useState<Record<string, boolean>>(
    {},
  );
  const [raftExtraById, setRaftExtraById] = useState<Record<string, boolean>>(
    {},
  );
  const [conflictRooms, setConflictRooms] = useState<ConflictRoom[]>([]);
  const [conflictRafts, setConflictRafts] = useState<ConflictRaft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
    setGuestCount(initialGuestCount);
    setPricePerPerson(initialPricePerPerson);
    setSelectedRoomIds(initialRooms.map((room) => room.id));
    setSelectedRaftIds(initialRafts.map((raft) => raft.id));
    setRoomExtraById(
      Object.fromEntries(initialRooms.map((room) => [room.id, room.isExtra])),
    );
    setRaftExtraById(
      Object.fromEntries(initialRafts.map((raft) => [raft.id, raft.isExtra])),
    );
    setConflictRooms([]);
    setConflictRafts([]);
    setError("");
    setSaving(false);
  }, [
    open,
    initialCheckIn,
    initialCheckOut,
    initialGuestCount,
    initialPricePerPerson,
    initialRooms,
    initialRafts,
  ]);

  const nights = nightsBetween(checkIn, checkOut);
  const previousNights = nightsBetween(initialCheckIn, initialCheckOut);
  const packageTotal = guestCount * pricePerPerson;
  const datesChanged =
    checkIn !== initialCheckIn || checkOut !== initialCheckOut;

  const changeCheckIn = (value: string) => {
    setCheckIn(value);
    if (!checkOut || checkOut <= value) {
      setCheckOut(nextDate(value));
    }
  };

  const buildBody = (includeResources: boolean) => {
    const body: Record<string, unknown> = { checkIn, checkOut };
    if (mode === "group") {
      body.guestCount = guestCount;
      body.pricePerPerson = pricePerPerson;
    }
    if (includeResources) {
      body.rooms = selectedRoomIds.map((id) => ({
        id,
        isExtra:
          mode === "group" ? (roomExtraById[id] ?? false) : true,
      }));
      body.rafts = selectedRaftIds.map((id) => ({
        id,
        isExtra:
          mode === "group" ? (raftExtraById[id] ?? false) : true,
      }));
    }
    return body;
  };

  const enterResourceStep = (payload: {
    conflicts: { rooms: ConflictRoom[]; rafts: ConflictRaft[] };
    keepable: { rooms: KeepableRoom[]; rafts: KeepableRaft[] };
  }) => {
    setConflictRooms(payload.conflicts.rooms);
    setConflictRafts(payload.conflicts.rafts);
    setSelectedRoomIds(payload.keepable.rooms.map((room) => room.id));
    setSelectedRaftIds(payload.keepable.rafts.map((raft) => raft.id));
    setRoomExtraById((current) => {
      const next = { ...current };
      for (const room of payload.keepable.rooms) {
        next[room.id] = room.isExtra;
      }
      return next;
    });
    setRaftExtraById((current) => {
      const next = { ...current };
      for (const raft of payload.keepable.rafts) {
        next[raft.id] = raft.isExtra;
      }
      return next;
    });
    setStep("resources");
    setError(
      [
        payload.conflicts.rooms.length
          ? `ห้องไม่ว่าง: ${payload.conflicts.rooms.map((room) => room.number).join(", ")}`
          : "",
        payload.conflicts.rafts.length
          ? `แพไม่ว่าง: ${payload.conflicts.rafts.map((raft) => raft.name).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  };

  const save = async (includeResources: boolean) => {
    if (includeResources && !selectedRoomIds.length && !selectedRaftIds.length) {
      setError("ต้องเลือกห้องหรือแพอย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/package`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(includeResources)),
      });
      const result = (await response.json()) as {
        message?: string;
        code?: string;
        conflicts?: { rooms: ConflictRoom[]; rafts: ConflictRaft[] };
        keepable?: { rooms: KeepableRoom[]; rafts: KeepableRaft[] };
      };
      if (
        response.status === 409 &&
        result.code === "RESOURCE_CONFLICT" &&
        result.conflicts &&
        result.keepable
      ) {
        enterResourceStep({
          conflicts: result.conflicts,
          keepable: result.keepable,
        });
        return;
      }
      if (!response.ok) throw new Error(result.message);
      setOpen(false);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const canSaveForm =
    Boolean(checkIn) &&
    Boolean(checkOut) &&
    checkOut > checkIn &&
    (mode === "solo" || (guestCount >= 1 && pricePerPerson >= 0));

  const onSelectRooms = (ids: string[]) => {
    setSelectedRoomIds(ids);
    setRoomExtraById((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (next[id] === undefined) {
          next[id] = mode === "group" ? false : true;
        }
      }
      return next;
    });
  };

  const onSelectRafts = (ids: string[]) => {
    setSelectedRaftIds(ids);
    setRaftExtraById((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (next[id] === undefined) {
          next[id] = mode === "group" ? false : true;
        }
      }
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) setOpen(false);
      }}
      title={
        step === "resources" ? "เลือกห้อง/แพใหม่" : "แก้ไขการเข้าพัก"
      }
      size={step === "resources" ? "lg" : "md"}
      fullScreenOnMobile={step === "resources"}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {step === "resources" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setStep("form");
                setError("");
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm text-foreground"
            >
              ย้อนกลับ
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm text-foreground"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="button"
            disabled={
              saving ||
              (step === "form"
                ? !canSaveForm
                : !selectedRoomIds.length && !selectedRaftIds.length)
            }
            onClick={() => void save(step === "resources")}
            className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving
              ? "กำลังบันทึก..."
              : step === "resources"
                ? "บันทึกพร้อมห้อง/แพใหม่"
                : "บันทึก"}
          </button>
        </div>
      }
    >
      {step === "form" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ปรับวันเข้าพัก
            {mode === "group" ? " จำนวนคน และราคาเหมา" : ""}
            — เมื่อเปลี่ยนวัน ระบบจะตรวจห้อง/แพว่าง
            และปรับยอดคิดเพิ่มตามจำนวนคืนให้อัตโนมัติ
            หากไม่ว่างจะให้เลือกห้อง/แพใหม่
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-xs text-muted-foreground">
              <span className="mb-1 block">วันเช็กอิน</span>
              <DateSelector
                required
                date={checkIn}
                setDate={changeCheckIn}
                className="w-full"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="mb-1 block">วันเช็กเอาต์</span>
              <DateSelector
                required
                date={checkOut}
                min={nextDate(checkIn)}
                setDate={setCheckOut}
                className="w-full"
              />
            </div>
          </div>

          <p className="text-sm text-foreground">
            {nights} คืน
            {datesChanged && nights !== previousNights
              ? ` (เดิม ${previousNights} คืน)`
              : ""}
          </p>

          {mode === "group" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  จำนวนคน
                  <NumberInput
                    required
                    min={1}
                    emptyValue={1}
                    value={guestCount}
                    onChange={setGuestCount}
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  ราคาต่อหัว
                  <NumberInput
                    required
                    min={0}
                    emptyValue={0}
                    value={pricePerPerson}
                    onChange={setPricePerPerson}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-sm text-foreground">
                เหมา {guestCount.toLocaleString()} คน × ฿
                {pricePerPerson.toLocaleString()} = ฿
                {packageTotal.toLocaleString()}
              </p>
            </>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
            <p className="font-medium">ห้อง/แพเดิมไม่ว่างในช่วงวันใหม่</p>
            {error ? (
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              ช่วงใหม่ {checkIn} → {checkOut} · ระบบคงรายการที่ยังว่างไว้แล้ว
              กรุณาเลือกทดแทนรายการที่ชน
            </p>
          </div>

          {(conflictRooms.length > 0 || conflictRafts.length > 0) &&
          selectedRoomIds.length === 0 &&
          selectedRaftIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่ได้เลือกห้อง/แพ — เลือกอย่างน้อย 1 รายการเพื่อบันทึก
            </p>
          ) : null}

          <ZoneRoomSelect
            selectedRoomIds={selectedRoomIds}
            onChange={onSelectRooms}
            checkIn={checkIn}
            checkOut={checkOut}
            excludeBookingId={bookingId}
          />
          <RaftSelect
            selectedRaftIds={selectedRaftIds}
            onChange={onSelectRafts}
            checkIn={checkIn}
            checkOut={checkOut}
            excludeBookingId={bookingId}
          />
        </div>
      )}
    </Modal>
  );
}
