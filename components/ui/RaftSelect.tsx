"use client";

import { CircleCheck, ShipWheel } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Raft {
  id: string;
  number: string;
  name: string;
  capacity: number;
  basePrice: number;
  booked: boolean;
}

export default function RaftSelect({
  selectedRaftIds,
  onChange,
  checkIn,
  checkOut,
  excludeBookingId,
}: {
  selectedRaftIds: string[];
  onChange: (ids: string[]) => void;
  checkIn: string;
  checkOut: string;
  excludeBookingId?: string;
}) {
  const [rafts, setRafts] = useState<Raft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          checkIn,
          checkOut,
        });
        if (excludeBookingId) params.set("excludeBookingId", excludeBookingId);
        const response = await fetch(`/api/rafts?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as Raft[] | { message: string };
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(
            "message" in data ? data.message : "โหลดแพไม่สำเร็จ",
          );
        }
        setRafts(data);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "โหลดแพไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [checkIn, checkOut, excludeBookingId]);

  const nights = useMemo(() => {
    const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
    const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
    return Math.max(1, Math.round((end - start) / 86_400_000));
  }, [checkIn, checkOut]);

  const selectedRafts = rafts.filter((raft) =>
    selectedRaftIds.includes(raft.id),
  );
  const raftTotal =
    selectedRafts.reduce((sum, raft) => sum + raft.basePrice, 0) * nights;

  const toggle = (id: string) =>
    onChange(
      selectedRaftIds.includes(id)
        ? selectedRaftIds.filter((raftId) => raftId !== id)
        : [...selectedRaftIds, id],
    );

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShipWheel size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">แพ</h3>
          <p className="text-xs text-muted-foreground">
            เลือกแพว่างตามช่วงวันที่จอง
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบแพว่าง...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-2">
            {rafts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                ไม่พบแพในช่วงวันที่เลือก
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {rafts.map((raft) => {
                  const selected = selectedRaftIds.includes(raft.id);
                  const blocked = raft.booked && !selected;
                  return (
                    <button
                      type="button"
                      key={raft.id}
                      disabled={blocked}
                      onClick={() => toggle(raft.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                        blocked
                          ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive"
                          : selected
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-border bg-surface hover:border-primary/40"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {selected ? (
                          <CircleCheck size={22} className="shrink-0" />
                        ) : (
                          <ShipWheel size={22} className="shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {raft.name}
                          </span>
                          <span className="text-xs">
                            {raft.capacity} คน · ฿
                            {raft.basePrice.toLocaleString()}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs">
                        {blocked ? "ไม่ว่าง" : selected ? "เลือกแล้ว" : "ว่าง"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-background px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground">
              เลือกแล้ว{" "}
              <span className="font-medium text-foreground">
                {selectedRaftIds.length}
              </span>{" "}
              แพ
              {selectedRafts.length > 0 ? (
                <span className="ml-2 text-xs">
                  ({selectedRafts.map((raft) => raft.name).join(", ")})
                </span>
              ) : null}
            </p>
            <p className="font-medium text-foreground">
              รวมแพ ฿{raftTotal.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({nights} คืน)
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
