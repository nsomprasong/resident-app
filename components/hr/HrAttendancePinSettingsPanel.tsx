"use client";

import { MapPin, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { requestGeolocationPosition } from "@/lib/browser/safe-apis";
import { describeGeolocationFailure } from "@/lib/hr/geo";

type AttendanceSettings = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  timezone: string;
  allowClockWithoutSchedule: boolean;
  updatedAt: string;
};

export function HrAttendancePinSettingsPanel() {
  const { can } = useEmployeePermissions();
  const canEdit = can("hr.settings.manage");
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/attendance-settings", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดการตั้งค่าไม่สำเร็จ");
      }
      const data = (await response.json()) as AttendanceSettings;
      setSettings(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดการตั้งค่าไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function useCurrentLocation() {
    if (!canEdit) return;
    setLocating(true);
    setError("");
    try {
      const position = await requestGeolocationPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              latitude: position.latitude,
              longitude: position.longitude,
            }
          : prev,
      );
    } catch (geoError) {
      setError(describeGeolocationFailure(geoError));
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!settings || !canEdit) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/hr/attendance-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: settings.latitude,
          longitude: settings.longitude,
          radiusMeters: settings.radiusMeters,
          maxAccuracyMeters: settings.maxAccuracyMeters,
          timezone: settings.timezone,
          allowClockWithoutSchedule: settings.allowClockWithoutSchedule,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AttendanceSettings & { message?: string })
        | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "บันทึกการตั้งค่าไม่สำเร็จ");
      }
      if (payload) setSettings(payload);
      setMessage("บันทึกการตั้งค่าหมุดแล้ว");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "บันทึกการตั้งค่าไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <p className="text-sm text-muted-foreground">กำลังโหลดการตั้งค่าหมุด...</p>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2 read-only:opacity-80";

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          ดูค่าปัจจุบันได้ — แก้ไขต้องมีสิทธิ์ hr.settings.manage
        </p>
      ) : null}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ละติจูด (Latitude)</span>
          <input
            type="number"
            step="0.000001"
            readOnly={!canEdit}
            value={settings.latitude}
            onChange={(event) =>
              setSettings({ ...settings, latitude: Number(event.target.value) })
            }
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ลองจิจูด (Longitude)</span>
          <input
            type="number"
            step="0.000001"
            readOnly={!canEdit}
            value={settings.longitude}
            onChange={(event) =>
              setSettings({ ...settings, longitude: Number(event.target.value) })
            }
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">รัศมีที่อนุญาต (เมตร)</span>
          <input
            type="number"
            readOnly={!canEdit}
            value={settings.radiusMeters}
            onChange={(event) =>
              setSettings({ ...settings, radiusMeters: Number(event.target.value) })
            }
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">
            ความแม่นยำ GPS สูงสุดที่ยอมรับ (เมตร)
          </span>
          <input
            type="number"
            readOnly={!canEdit}
            value={settings.maxAccuracyMeters}
            onChange={(event) =>
              setSettings({
                ...settings,
                maxAccuracyMeters: Number(event.target.value),
              })
            }
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">เขตเวลา</span>
          <input
            type="text"
            readOnly={!canEdit}
            value={settings.timezone}
            onChange={(event) =>
              setSettings({ ...settings, timezone: event.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:mt-6">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={settings.allowClockWithoutSchedule}
            onChange={(event) =>
              setSettings({
                ...settings,
                allowClockWithoutSchedule: event.target.checked,
              })
            }
            className="h-4 w-4 rounded border-border"
          />
          <span>อนุญาตให้ลงเวลาได้แม้ไม่มีตารางงานวันนี้</span>
        </label>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            <MapPin size={16} />
            {locating ? "กำลังอ่านตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
