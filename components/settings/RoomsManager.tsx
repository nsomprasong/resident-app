"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RoomTypeRecord } from "@/lib/settings/room-types";
import {
  roomStatusOptions,
  type RoomMasterRecord,
} from "@/lib/settings/room-master-shared";
import type { ZoneRecord } from "@/lib/settings/zones";

type FormState = {
  number: string;
  floor: string;
  status: string;
  zoneId: string;
  roomTypeId: string;
};

const emptyForm: FormState = {
  number: "",
  floor: "",
  status: "AVAILABLE",
  zoneId: "",
  roomTypeId: "",
};

type ApiErrorBody = {
  message?: string;
};

function statusLabel(status: string) {
  return roomStatusOptions.find((item) => item.value === status)?.label ?? status;
}

export function RoomsManager() {
  const [items, setItems] = useState<RoomMasterRecord[]>([]);
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const selectableZones = useMemo(
    () => zones.filter((zone) => zone.isActive),
    [zones],
  );
  const selectableRoomTypes = useMemo(
    () => roomTypes.filter((type) => type.isActive),
    [roomTypes],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roomsRes, zonesRes, typesRes] = await Promise.all([
        fetch("/api/rooms/master", { cache: "no-store" }),
        fetch("/api/zones", { cache: "no-store" }),
        fetch("/api/room-types", { cache: "no-store" }),
      ]);

      const roomsBody = (await roomsRes.json()) as RoomMasterRecord[] | ApiErrorBody;
      const zonesBody = (await zonesRes.json()) as ZoneRecord[] | ApiErrorBody;
      const typesBody = (await typesRes.json()) as RoomTypeRecord[] | ApiErrorBody;

      if (!roomsRes.ok || !Array.isArray(roomsBody)) {
        throw new Error("โหลดรายการห้องไม่สำเร็จ");
      }
      if (!zonesRes.ok || !Array.isArray(zonesBody)) {
        throw new Error("โหลดโซนไม่สำเร็จ");
      }
      if (!typesRes.ok || !Array.isArray(typesBody)) {
        throw new Error("โหลดประเภทห้องไม่สำเร็จ");
      }

      setItems(roomsBody);
      setZones(zonesBody);
      setRoomTypes(typesBody);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลห้องไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      zoneId: selectableZones[0]?.id ?? "",
      roomTypeId: selectableRoomTypes[0]?.id ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: RoomMasterRecord) => {
    setEditingId(item.id);
    setForm({
      number: item.number,
      floor: item.floor === null ? "" : String(item.floor),
      status: item.status,
      zoneId: item.zone.id,
      roomTypeId: item.roomType.id,
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const zoneOptions = useMemo(() => {
    if (!editingId) return selectableZones;
    const current = zones.find((zone) => zone.id === form.zoneId);
    if (current && !current.isActive) {
      return [current, ...selectableZones.filter((zone) => zone.id !== current.id)];
    }
    return selectableZones;
  }, [editingId, form.zoneId, selectableZones, zones]);

  const roomTypeOptions = useMemo(() => {
    if (!editingId) return selectableRoomTypes;
    const current = roomTypes.find((type) => type.id === form.roomTypeId);
    if (current && !current.isActive) {
      return [
        current,
        ...selectableRoomTypes.filter((type) => type.id !== current.id),
      ];
    }
    return selectableRoomTypes;
  }, [editingId, form.roomTypeId, roomTypes, selectableRoomTypes]);

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload: Record<string, unknown> = {
        number: form.number.trim(),
        status: form.status,
        zoneId: form.zoneId,
        roomTypeId: form.roomTypeId,
      };
      if (form.floor.trim()) {
        payload.floor = Number.parseInt(form.floor, 10);
      } else {
        payload.floor = null;
      }

      const response = await fetch(
        editingId ? `/api/rooms/${editingId}` : "/api/rooms",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as RoomMasterRecord | ApiErrorBody;
      if (!response.ok) {
        const message =
          !("id" in body) && body.message ? body.message : "บันทึกไม่สำเร็จ";
        setFormError(message);
        return;
      }

      setModalOpen(false);
      await loadItems();
    } catch {
      setFormError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const setMaintenance = async (item: RoomMasterRecord) => {
    if (
      !window.confirm(
        `ตั้งห้อง ${item.number} เป็นสถานะปิดซ่อม (ไม่เปิดให้จองใหม่)?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MAINTENANCE" }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.message ?? "อัปเดตสถานะไม่สำเร็จ");
      }
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตสถานะไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">ห้องพัก</p>
        <button
          type="button"
          onClick={openCreate}
          disabled={!selectableZones.length || !selectableRoomTypes.length}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus size={16} />
          เพิ่ม
        </button>
      </div>

      {!selectableZones.length || !selectableRoomTypes.length ? (
        <p className="mb-2 text-sm text-warning">
          ต้องมีโซนและประเภทห้องที่เปิดใช้งานก่อนเพิ่มห้อง
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดห้อง...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีห้อง</p>
      ) : null}

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {items.map((room) => (
          <div
            key={room.id}
            className="rounded-2xl border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">
                  ห้อง {room.number}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {room.zone.name} · {room.roomType.name}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {statusLabel(room.status)}
                </span>
              </div>
              {room.floor !== null ? (
                <span className="text-muted-foreground">ชั้น {room.floor}</span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(room)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              {room.status !== "MAINTENANCE" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void setMaintenance(room)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  ปิดจากการจอง
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="room-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขห้อง" : "เพิ่มห้อง"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                เลขห้อง
                <input
                  required
                  value={form.number}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, number: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  โซน
                  <select
                    required
                    value={form.zoneId}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, zoneId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  >
                    {zoneOptions.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                        {!zone.isActive ? " (ปิดใช้งาน)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  ประเภทห้อง
                  <select
                    required
                    value={form.roomTypeId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        roomTypeId: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  >
                    {roomTypeOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                        {!type.isActive ? " (ปิดใช้งาน)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  ชั้น (ไม่บังคับ)
                  <input
                    type="number"
                    value={form.floor}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, floor: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  สถานะ
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, status: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  >
                    {roomStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
