"use client";

import { useCallback, useEffect, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";

type Setting = { key: string; value: string; labelTh: string | null };

export function HrPayrollSettingsPanel() {
  const { can } = useEmployeePermissions();
  const canEdit = can("hr.settings.manage");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/payroll/settings", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("โหลดสูตรค่าจ้างไม่สำเร็จ");
      }
      const data = (await response.json()) as { items: Setting[] };
      setSettings(data.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSetting(key: string, fallbackValue: string) {
    if (!canEdit) return;
    setMessage("");
    setError("");
    const input = document.getElementById(
      `payroll-setting-${key}`,
    ) as HTMLInputElement | null;
    const response = await fetch("/api/hr/payroll/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        value: input?.value ?? fallbackValue,
      }),
    });
    if (!response.ok) {
      setError("บันทึกตั้งค่าไม่สำเร็จ");
      return;
    }
    setMessage("อัปเดตสูตรแล้ว — มีผลเมื่อคำนวณรอบใหม่");
    await load();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">กำลังโหลดสูตรค่าจ้าง...</p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          ดูค่าปัจจุบันได้ — แก้ไขต้องมีสิทธิ์ hr.settings.manage
        </p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {settings.map((item) => (
          <li
            key={item.key}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-3 sm:flex-row sm:items-center"
          >
            <label
              htmlFor={`payroll-setting-${item.key}`}
              className="min-w-0 flex-1 text-muted-foreground"
            >
              {item.labelTh ?? item.key}
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <input
                defaultValue={item.value}
                id={`payroll-setting-${item.key}`}
                readOnly={!canEdit}
                className="w-28 rounded-xl border border-border bg-surface px-3 py-2 text-right tabular-nums read-only:opacity-80"
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void saveSetting(item.key, item.value)}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  บันทึก
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
