"use client";

import {
  AlertTriangle,
  CheckSquare,
  Eraser,
  LoaderCircle,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DATA_RESET_CONFIRM_PHRASE,
  dataResetCategoryLabel,
  masterResetTargetLabels,
  masterResetTargets,
  serviceResetTargetLabels,
  serviceResetTargets,
  supermarketResetTargetLabels,
  supermarketResetTargets,
  type DataResetCategory,
  type DataResetCounts,
  type DataResetTarget,
  type MasterResetTarget,
  type ServiceResetTarget,
  type SupermarketResetTarget,
} from "@/lib/system/data-reset";

type CatalogItem = { id: string; label: string };

type ResetPayload = {
  confirmPhrase: string;
  service: CatalogItem[];
  master: CatalogItem[];
  supermarket: CatalogItem[];
  counts: DataResetCounts;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function CategoryPanel({
  title,
  description,
  category,
  items,
  counts,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onSubmit,
  busy,
  confirm,
  onConfirmChange,
}: {
  title: string;
  description: string;
  category: DataResetCategory;
  items: CatalogItem[];
  counts: DataResetCounts;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSubmit: (mode: "selected" | "all") => void;
  busy: boolean;
  confirm: string;
  onConfirmChange: (value: string) => void;
}) {
  const selectedCount = selected.size;
  const confirmReady = confirm.trim() === DATA_RESET_CONFIRM_PHRASE;

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-warning/15 text-warning">
          <AlertTriangle size={22} />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <CheckSquare size={16} />
          เลือกทั้งหมด
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <Square size={16} />
          ล้างการเลือก
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const checked = selected.has(item.id);
          const count = counts[item.id as DataResetTarget] ?? 0;
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={busy}
                  onChange={() => onToggle(item.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    ปัจจุบัน {formatCount(count)} รายการ
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-foreground">
          พิมพ์ <span className="font-semibold">{DATA_RESET_CONFIRM_PHRASE}</span>{" "}
          เพื่อยืนยันการลบถาวร
        </p>
        <input
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          disabled={busy}
          placeholder={DATA_RESET_CONFIRM_PHRASE}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy || !confirmReady || selectedCount === 0}
            onClick={() => onSubmit("selected")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Eraser size={16} />}
            ลบรายการที่เลือก ({formatCount(selectedCount)})
          </button>
          <button
            type="button"
            disabled={busy || !confirmReady}
            onClick={() => onSubmit("all")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive bg-surface px-4 py-2.5 text-sm font-medium text-destructive disabled:opacity-50"
          >
            ลบทั้งหมดในหมวดนี้
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          หมวด {dataResetCategoryLabel(category)} · การลบไม่สามารถย้อนกลับได้
        </p>
      </div>
    </section>
  );
}

export default function DataResetManager() {
  const [payload, setPayload] = useState<ResetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCategory, setBusyCategory] = useState<DataResetCategory | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serviceSelected, setServiceSelected] = useState<Set<string>>(
    new Set(),
  );
  const [masterSelected, setMasterSelected] = useState<Set<string>>(new Set());
  const [supermarketSelected, setSupermarketSelected] = useState<Set<string>>(
    new Set(),
  );
  const [serviceConfirm, setServiceConfirm] = useState("");
  const [masterConfirm, setMasterConfirm] = useState("");
  const [supermarketConfirm, setSupermarketConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/system/data-reset", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      }
      const data = (await response.json()) as ResetPayload;
      setPayload(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const serviceItems = useMemo(
    () =>
      payload?.service ??
      serviceResetTargets.map((id) => ({
        id,
        label: serviceResetTargetLabels[id as ServiceResetTarget],
      })),
    [payload],
  );
  const masterItems = useMemo(
    () =>
      payload?.master ??
      masterResetTargets.map((id) => ({
        id,
        label: masterResetTargetLabels[id as MasterResetTarget],
      })),
    [payload],
  );
  const supermarketItems = useMemo(
    () =>
      payload?.supermarket ??
      supermarketResetTargets.map((id) => ({
        id,
        label: supermarketResetTargetLabels[id as SupermarketResetTarget],
      })),
    [payload],
  );

  const emptyCounts = useMemo(() => {
    const counts = {} as DataResetCounts;
    for (const id of [
      ...serviceResetTargets,
      ...masterResetTargets,
      ...supermarketResetTargets,
    ]) {
      counts[id] = 0;
    }
    return counts;
  }, []);

  function selectedFor(category: DataResetCategory) {
    if (category === "service") return serviceSelected;
    if (category === "master") return masterSelected;
    return supermarketSelected;
  }

  function confirmFor(category: DataResetCategory) {
    if (category === "service") return serviceConfirm;
    if (category === "master") return masterConfirm;
    return supermarketConfirm;
  }

  function clearSelection(category: DataResetCategory) {
    if (category === "service") {
      setServiceSelected(new Set());
      setServiceConfirm("");
      return;
    }
    if (category === "master") {
      setMasterSelected(new Set());
      setMasterConfirm("");
      return;
    }
    setSupermarketSelected(new Set());
    setSupermarketConfirm("");
  }

  async function runReset(
    category: DataResetCategory,
    mode: "selected" | "all",
  ) {
    const selected = selectedFor(category);
    const confirm = confirmFor(category);
    setBusyCategory(category);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/system/data-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          targets: mode === "all" ? "all" : [...selected],
          confirm,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        deleted?: Partial<Record<string, number>>;
        counts?: DataResetCounts;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "ล้างข้อมูลไม่สำเร็จ");
      }
      if (body?.counts && payload) {
        setPayload({ ...payload, counts: body.counts });
      } else {
        await load();
      }
      clearSelection(category);
      const deletedTotal = Object.values(body?.deleted ?? {}).reduce(
        (sum: number, value) => sum + (value ?? 0),
        0,
      );
      setMessage(
        `ลบสำเร็จ ${formatCount(deletedTotal)} รายการในหมวด${dataResetCategoryLabel(category)}`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "ล้างข้อมูลไม่สำเร็จ",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  function toggle(category: DataResetCategory, id: string) {
    const setter =
      category === "service"
        ? setServiceSelected
        : category === "master"
          ? setMasterSelected
          : setSupermarketSelected;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && !payload) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        <LoaderCircle size={18} className="animate-spin" />
        กำลังโหลดสรุปข้อมูล...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </p>
      ) : null}

      <CategoryPanel
        title="1. ข้อมูลการเข้ารับบริการ"
        description="ลบประวัติการจอง ลูกค้า กรุ๊ป ข้อมูลการทำงาน HR (ลงเวลา/ลา/สาย) หรือพนักงาน — คง support/ผู้ทำรายการ และไม่แตะหมุดหรือประเภทลา"
        category="service"
        items={serviceItems}
        counts={payload?.counts ?? emptyCounts}
        selected={serviceSelected}
        onToggle={(id) => toggle("service", id)}
        onSelectAll={() =>
          setServiceSelected(new Set(serviceItems.map((item) => item.id)))
        }
        onClear={() => setServiceSelected(new Set())}
        onSubmit={(mode) => void runReset("service", mode)}
        busy={busyCategory === "service"}
        confirm={serviceConfirm}
        onConfirmChange={setServiceConfirm}
      />

      <CategoryPanel
        title="2. ข้อมูลหลัก"
        description="ลบโครงสร้างที่พัก สินค้า ช่องทางรับชำระ และแคตตาล็อก — ควรลบข้อมูลบริการที่เกี่ยวข้องก่อน"
        category="master"
        items={masterItems}
        counts={payload?.counts ?? emptyCounts}
        selected={masterSelected}
        onToggle={(id) => toggle("master", id)}
        onSelectAll={() =>
          setMasterSelected(new Set(masterItems.map((item) => item.id)))
        }
        onClear={() => setMasterSelected(new Set())}
        onSubmit={(mode) => void runReset("master", mode)}
        busy={busyCategory === "master"}
        confirm={masterConfirm}
        onConfirmChange={setMasterConfirm}
      />

      <CategoryPanel
        title="3. ซูเปอร์มาร์เก็ต"
        description="ลบข้อมูลขาย สินค้า และหมวดหมู่ของ POS — ลบข้อมูลขายก่อน หากจะลบสินค้าหรือหมวดหมู่"
        category="supermarket"
        items={supermarketItems}
        counts={payload?.counts ?? emptyCounts}
        selected={supermarketSelected}
        onToggle={(id) => toggle("supermarket", id)}
        onSelectAll={() =>
          setSupermarketSelected(
            new Set(supermarketItems.map((item) => item.id)),
          )
        }
        onClear={() => setSupermarketSelected(new Set())}
        onSubmit={(mode) => void runReset("supermarket", mode)}
        busy={busyCategory === "supermarket"}
        confirm={supermarketConfirm}
        onConfirmChange={setSupermarketConfirm}
      />
    </div>
  );
}
