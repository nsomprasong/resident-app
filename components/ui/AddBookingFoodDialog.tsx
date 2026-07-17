"use client";

import {
  DoorOpen,
  RotateCcw,
  Save,
  UsersRound,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import BookingFoodSelect, { type BookingFoodItem } from "./BookingFoodSelect";
import Modal from "./Modal";
import type {
  FoodSetRecord,
  TourGroupFoodSetRecord,
} from "@/lib/settings/food-sets";

type BookingRoom = {
  id: string;
  number: string;
};

type GroupStep = "pick" | "edit";

export default function AddBookingFoodDialog({
  open,
  setOpen,
  bookingId,
  mode,
  tourGroupId = null,
  rooms = [],
  onAdded,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  bookingId: string;
  mode: "group" | "solo";
  tourGroupId?: string | null;
  rooms?: BookingRoom[];
  onAdded: () => void;
}) {
  const isGroup = mode === "group";
  const [items, setItems] = useState<BookingFoodItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [error, setError] = useState("");
  /** null = group bill; room id = charge to that room */
  const [chargeRoomId, setChargeRoomId] = useState<string | null>(null);
  const [step, setStep] = useState<GroupStep>("pick");
  const [foodSets, setFoodSets] = useState<FoodSetRecord[]>([]);
  const [groupFoodSet, setGroupFoodSet] = useState<TourGroupFoodSetRecord | null>(
    null,
  );
  const [selectedSetName, setSelectedSetName] = useState("");
  const [sourceFoodSetId, setSourceFoodSetId] = useState<string | null>(null);
  const [loadingSets, setLoadingSets] = useState(false);

  const soloRoomId = rooms[0]?.id ?? null;

  const loadGroupSets = useCallback(async () => {
    if (!isGroup || !tourGroupId) return;
    setLoadingSets(true);
    try {
      const [setsRes, groupRes] = await Promise.all([
        fetch("/api/food-sets", { cache: "no-store" }),
        fetch(`/api/tour-groups/${tourGroupId}/food-set`, { cache: "no-store" }),
      ]);
      if (setsRes.ok) {
        setFoodSets((await setsRes.json()) as FoodSetRecord[]);
      }
      if (groupRes.ok) {
        setGroupFoodSet(
          (await groupRes.json()) as TourGroupFoodSetRecord | null,
        );
      }
    } finally {
      setLoadingSets(false);
    }
  }, [isGroup, tourGroupId]);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setError("");
    setChargeRoomId(isGroup ? null : soloRoomId);
    setStep(isGroup ? "pick" : "edit");
    setSelectedSetName("");
    setSourceFoodSetId(null);
    if (isGroup) {
      void loadGroupSets();
    }
  }, [open, isGroup, soloRoomId, loadGroupSets]);

  const applyMasterSet = (foodSet: FoodSetRecord) => {
    setItems(
      foodSet.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        isExtra: false,
        requireOptions: item.requireOptions,
        note: undefined,
      })),
    );
    setSelectedSetName(foodSet.name);
    setSourceFoodSetId(foodSet.id);
    setStep("edit");
    setError("");
  };

  const applyGroupCustomization = () => {
    if (!groupFoodSet) return;
    setItems(
      groupFoodSet.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        isExtra: item.isExtra,
        requireOptions: item.requireOptions,
        note: item.optionNote ?? undefined,
      })),
    );
    setSelectedSetName(groupFoodSet.name);
    setSourceFoodSetId(groupFoodSet.sourceFoodSetId);
    setStep("edit");
    setError("");
  };

  const restartSetPick = () => {
    setItems([]);
    setSelectedSetName("");
    setSourceFoodSetId(null);
    setStep("pick");
    setError("");
  };

  const persistGroupCustomization = async () => {
    if (!tourGroupId || !items.length) {
      throw new Error("ไม่พบกรุ๊ปหรือรายการอาหาร");
    }
    const response = await fetch(`/api/tour-groups/${tourGroupId}/food-set`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedSetName || "ชุดของกรุ๊ป",
        sourceFoodSetId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          isExtra: item.isExtra ?? false,
          optionNote: item.note ?? null,
        })),
      }),
    });
    const data = (await response.json()) as TourGroupFoodSetRecord & {
      message?: string;
    };
    if (!response.ok) {
      throw new Error(data.message ?? "บันทึกชุดของกรุ๊ปไม่สำเร็จ");
    }
    setGroupFoodSet(data);
  };

  const saveGroupCustomization = async () => {
    setSavingSet(true);
    setError("");
    try {
      await persistGroupCustomization();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "บันทึกชุดของกรุ๊ปไม่สำเร็จ",
      );
    } finally {
      setSavingSet(false);
    }
  };

  const missingRequiredOptions = () => {
    // Validated in BookingFoodSelect via requireOptions flag from set;
    // products with options and requireOptions!==false without note block submit.
    return items.some((item) => {
      if (item.requireOptions !== true) return false;
      return !item.note?.trim();
    });
  };

  const submit = async () => {
    if (!items.length) return;
    if (
      isGroup &&
      chargeRoomId &&
      !rooms.some((room) => room.id === chargeRoomId)
    ) {
      setError("ห้องที่เลือกไม่ถูกต้อง");
      return;
    }
    if (missingRequiredOptions()) {
      setError("กรุณาเลือกตัวเลือกวัตถุดิบที่บังคับ (เช่น ไก่/หมู หรือชนิดเส้น)");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isGroup && tourGroupId) {
        await persistGroupCustomization();
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          roomId: isGroup ? chargeRoomId : chargeRoomId,
          note:
            isGroup && selectedSetName ? `ชุด: ${selectedSetName}` : undefined,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            isExtra: isGroup ? (item.isExtra ?? true) : true,
            ...(item.note?.trim() ? { note: item.note.trim() } : {}),
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setItems([]);
      setOpen(false);
      onAdded();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เพิ่มรายการอาหารไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={isGroup ? "จัดการรายการอาหาร" : "เพิ่มรายการอาหาร"}
      size="lg"
      fullScreenOnMobile
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          {isGroup && step === "edit" ? (
            <>
              <button
                type="button"
                onClick={restartSetPick}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                <RotateCcw size={17} />
                เริ่มใหม่เลือกชุด
              </button>
              {tourGroupId ? (
                <button
                  type="button"
                  onClick={() => void saveGroupCustomization()}
                  disabled={savingSet || !items.length}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  <Save size={17} />
                  {savingSet ? "กำลังบันทึก..." : "บันทึกชุดของกรุ๊ป"}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <X size={17} />
              ยกเลิก
            </button>
          )}
          {(!isGroup || step === "edit") && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !items.length}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} />
              {saving ? "กำลังเพิ่ม..." : "เพิ่มในรายการจอง"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isGroup
            ? step === "pick"
              ? "เลือกชุดอาหารมาตรฐาน หรือใช้ชุดที่ปรับไว้ของกรุ๊ปนี้เท่านั้น"
              : "ปรับรายการได้เฉพาะกรุ๊ปนี้ — ชุดหลักไม่เปลี่ยน จากนั้นส่งเข้าครัว"
            : "เลือกอาหารที่ต้องการเพิ่ม โดยคิดตามราคาจริง"}
        </p>

        {isGroup && step === "pick" ? (
          <div className="space-y-3">
            {loadingSets ? (
              <p className="text-sm text-muted-foreground">กำลังโหลดชุดอาหาร...</p>
            ) : null}
            {groupFoodSet ? (
              <button
                type="button"
                onClick={applyGroupCustomization}
                className="flex w-full items-start gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-left transition hover:border-success"
              >
                <UtensilsCrossed size={18} className="mt-0.5 shrink-0 text-success" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    ใช้ชุดที่ปรับของกรุ๊ปนี้
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {groupFoodSet.name} · {groupFoodSet.items.length} รายการ
                  </span>
                </span>
              </button>
            ) : null}
            {foodSets.length === 0 && !loadingSets ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                ยังไม่มีชุดอาหารในระบบ — ไปตั้งค่าที่ Settings → ชุดอาหาร
                หรือเลือกทีละรายการด้านล่าง
                <button
                  type="button"
                  className="mt-3 block w-full text-primary underline"
                  onClick={() => {
                    setStep("edit");
                    setSelectedSetName("สั่งทีละรายการ");
                  }}
                >
                  สั่งทีละรายการแทน
                </button>
              </p>
            ) : (
              <ul className="space-y-2">
                {foodSets.map((foodSet) => (
                  <li key={foodSet.id}>
                    <button
                      type="button"
                      onClick={() => applyMasterSet(foodSet)}
                      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition hover:border-primary/40"
                    >
                      <UtensilsCrossed
                        size={18}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {foodSet.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {foodSet.itemCount} รายการ
                          {foodSet.description
                            ? ` · ${foodSet.description}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {foodSets.length > 0 ? (
              <button
                type="button"
                className="text-sm text-primary underline"
                onClick={() => {
                  setStep("edit");
                  setSelectedSetName("สั่งทีละรายการ");
                  setSourceFoodSetId(null);
                  setItems([]);
                }}
              >
                สั่งทีละรายการแทน
              </button>
            ) : null}
          </div>
        ) : null}

        {(!isGroup || step === "edit") && (
          <>
            {isGroup && selectedSetName ? (
              <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-foreground">
                กำลังสั่ง: <span className="font-medium">{selectedSetName}</span>
              </p>
            ) : null}

            {isGroup ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  สั่งให้ใคร / ลงบิลไหน
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setChargeRoomId(null)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      chargeRoomId === null
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    <UsersRound size={18} className="shrink-0" />
                    <span>
                      <span className="block text-sm font-medium">ลงบิลกรุ๊ป</span>
                      <span className="block text-xs opacity-80">
                        รวมในบิลกลุ่มทัวร์
                      </span>
                    </span>
                  </button>
                  {rooms.map((room) => (
                    <button
                      type="button"
                      key={room.id}
                      onClick={() => setChargeRoomId(room.id)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        chargeRoomId === room.id
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border bg-background text-foreground hover:border-primary/40"
                      }`}
                    >
                      <DoorOpen size={18} className="shrink-0" />
                      <span>
                        <span className="block text-sm font-medium">
                          ห้อง {room.number}
                        </span>
                        <span className="block text-xs opacity-80">
                          สั่งแยกห้องนี้
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <BookingFoodSelect
              items={items}
              onChange={setItems}
              included={false}
              allowPackagePricing={isGroup}
              defaultIsExtra
            />
          </>
        )}

        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
