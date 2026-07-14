"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  Umbrella,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { describeGeolocationFailure } from "@/lib/hr/geo";

type TodayInfo = {
  workDate: string;
  schedule: {
    id: string;
    shiftName: string;
    startsAt: string;
    endsAt: string;
    isDayOff: boolean;
  } | null;
  attendance: {
    id: string;
    workDate: string;
    shiftName: string | null;
    clockIn: string | null;
    clockOut: string | null;
    workedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    otMinutes: number;
    otApprovedMinutes: number;
    status: string;
  } | null;
  allowClockWithoutSchedule: boolean;
};

type MyWorkData = {
  today: TodayInfo;
  settings: { radiusMeters: number; maxAccuracyMeters: number; timezone: string };
  distancePreviewMeters: number | null;
  history: TodayInfo["attendance"][];
  leaveRequests: LeaveRequestRow[];
};

type LeaveRequestRow = {
  id: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  duration: string;
  durationLabel: string;
  daysRequested: number;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

type LeaveType = { id: string; code: string; name: string; isActive: boolean };

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    weekday: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMinutesAsHours(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours} ชม. ${mins} นาที`;
}

const leaveStatusLabels: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิกแล้ว",
};

type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; latitude: number; longitude: number; accuracyMeters: number }
  | { status: "error"; message: string };

function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new Error(describeGeolocationFailure(new Error("insecure"))));
      return;
    }
    if (!("geolocation" in navigator)) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับการขอตำแหน่ง GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(describeGeolocationFailure(error))),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  });
}

export function MyWorkBoard() {
  const [data, setData] = useState<MyWorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [clocking, setClocking] = useState(false);
  const [clockMessage, setClockMessage] = useState("");
  const [clockError, setClockError] = useState("");

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/my-work", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      }
      const json = (await response.json()) as MyWorkData;
      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/hr/leave-types", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((types: LeaveType[]) => setLeaveTypes(types.filter((type) => type.isActive)))
      .catch(() => setLeaveTypes([]));
  }, []);

  async function handleClock(type: "CHECK_IN" | "CHECK_OUT") {
    setClocking(true);
    setClockError("");
    setClockMessage("");
    setGeo({ status: "locating" });
    try {
      const position = await requestPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracyMeters = position.coords.accuracy;
      setGeo({ status: "ready", latitude, longitude, accuracyMeters });

      const response = await fetch("/api/hr/my-work/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, latitude, longitude, accuracyMeters }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        distanceMeters?: number;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "ลงเวลาไม่สำเร็จ");
      }
      setClockMessage(
        type === "CHECK_IN"
          ? `ลงเวลาเข้างานสำเร็จ (ห่างจากหมุด ${body?.distanceMeters ?? 0} ม.)`
          : `ลงเวลาออกงานสำเร็จ (ห่างจากหมุด ${body?.distanceMeters ?? 0} ม.)`,
      );
      await load();
    } catch (clockErr) {
      const message =
        clockErr instanceof Error ? clockErr.message : "ลงเวลาไม่สำเร็จ กรุณาลองใหม่";
      setClockError(message);
      setGeo({ status: "error", message });
    } finally {
      setClocking(false);
    }
  }

  function openLeaveForm() {
    const today = data?.today.workDate ?? "";
    setLeaveForm({
      leaveTypeId: leaveTypes[0]?.id ?? "",
      startDate: today,
      endDate: today,
      reason: "",
    });
    setLeaveError("");
    setLeaveMessage("");
    setLeaveOpen(true);
  }

  async function submitLeave() {
    setLeaveSubmitting(true);
    setLeaveError("");
    try {
      const response = await fetch("/api/hr/my-work/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId: leaveForm.leaveTypeId,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          duration: "FULL_DAY",
          reason: leaveForm.reason || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "ส่งคำขอลาไม่สำเร็จ");
      }
      setLeaveOpen(false);
      setLeaveMessage("ส่งคำขอลาสำเร็จ รออนุมัติ");
      await load();
    } catch (submitError) {
      setLeaveError(
        submitError instanceof Error ? submitError.message : "ส่งคำขอลาไม่สำเร็จ",
      );
    } finally {
      setLeaveSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-8 text-center text-muted-foreground shadow-sm">
        กำลังโหลด...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        {error || "ไม่พบข้อมูล"}
      </div>
    );
  }

  const { today } = data;
  const attendance = today.attendance;
  const hasCheckedIn = Boolean(attendance?.clockIn);
  const hasCheckedOut = Boolean(attendance?.clockOut);
  const canClockIn = !today.schedule?.isDayOff && !hasCheckedIn;
  const canClockOut = !today.schedule?.isDayOff && hasCheckedIn && !hasCheckedOut;
  const noScheduleBlock = !today.schedule && !today.allowClockWithoutSchedule;

  return (
    <div className="space-y-5">
      {/* Today card */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays size={16} />
          {formatDate(today.workDate)}
        </div>

        {today.schedule ? (
          <div className="mt-2">
            <p className="text-lg font-semibold text-foreground">
              {today.schedule.isDayOff ? "วันหยุด" : today.schedule.shiftName}
            </p>
            {!today.schedule.isDayOff ? (
              <p className="text-sm text-muted-foreground">
                {formatTime(today.schedule.startsAt)} – {formatTime(today.schedule.endsAt)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีตารางกะของวันนี้</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">เข้างาน</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatTime(attendance?.clockIn ?? null)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">ออกงาน</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatTime(attendance?.clockOut ?? null)}
            </p>
          </div>
        </div>

        {today.schedule?.isDayOff ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-secondary/10 px-3 py-2 text-sm text-secondary-foreground">
            <CheckCircle2 size={16} /> วันนี้เป็นวันหยุดตามตารางงาน ไม่ต้องลงเวลา
          </p>
        ) : noScheduleBlock ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle size={16} /> ยังไม่มีตารางกะวันนี้ ติดต่อผู้ดูแลก่อนลงเวลา
          </p>
        ) : hasCheckedOut ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">
            <CheckCircle2 size={16} /> ลงเวลาครบสำหรับวันนี้แล้ว
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canClockIn || clocking || noScheduleBlock}
            onClick={() => void handleClock("CHECK_IN")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition disabled:opacity-40"
          >
            <LogIn size={18} />
            {clocking ? "กำลังลงเวลา..." : "เข้างาน"}
          </button>
          <button
            type="button"
            disabled={!canClockOut || clocking || noScheduleBlock}
            onClick={() => void handleClock("CHECK_OUT")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition disabled:opacity-40"
          >
            <LogOut size={18} />
            {clocking ? "กำลังลงเวลา..." : "ออกงาน"}
          </button>
        </div>

        {geo.status === "locating" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={14} className="animate-pulse" /> กำลังขอตำแหน่ง GPS...
          </p>
        ) : geo.status === "ready" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={14} /> ความแม่นยำ ±{Math.round(geo.accuracyMeters)} ม.
            {data.settings.maxAccuracyMeters
              ? ` (ยอมรับไม่เกิน ${data.settings.maxAccuracyMeters} ม.)`
              : ""}
          </p>
        ) : null}

        {clockMessage ? (
          <p className="mt-3 rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">
            {clockMessage}
          </p>
        ) : null}
        {clockError ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle size={16} className="shrink-0" /> {clockError}
          </p>
        ) : null}
      </div>

      {/* Leave */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Umbrella size={18} />
            <h2 className="text-base font-semibold">แจ้งลา</h2>
          </div>
          <button
            type="button"
            onClick={openLeaveForm}
            className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            ยื่นคำขอลา
          </button>
        </div>

        {leaveMessage ? (
          <p className="mt-3 rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">
            {leaveMessage}
          </p>
        ) : null}

        <div className="mt-3 space-y-2">
          {data.leaveRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีคำขอลา</p>
          ) : (
            data.leaveRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {request.leaveTypeName} · {request.daysRequested} วัน
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.startDate} – {request.endDate}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    request.status === "APPROVED"
                      ? "bg-primary/15 text-primary"
                      : request.status === "REJECTED"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {leaveStatusLabels[request.status] ?? request.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Clock3 size={18} />
          <h2 className="text-base font-semibold">ประวัติของฉัน (14 วันล่าสุด)</h2>
        </div>
        <div className="mt-3 space-y-2">
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีประวัติลงเวลา</p>
          ) : (
            data.history.map((record) =>
              record ? (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{formatDate(record.workDate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(record.clockIn)} – {formatTime(record.clockOut)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatMinutesAsHours(record.workedMinutes)}
                  </p>
                </div>
              ) : null,
            )
          )}
        </div>
      </div>

      {leaveOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-lg font-semibold">ยื่นคำขอลา</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">ประเภทการลา</span>
                <select
                  value={leaveForm.leaveTypeId}
                  onChange={(event) =>
                    setLeaveForm((current) => ({
                      ...current,
                      leaveTypeId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">วันที่เริ่ม</span>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(event) =>
                      setLeaveForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                        endDate:
                          current.endDate < event.target.value
                            ? event.target.value
                            : current.endDate,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">วันที่สิ้นสุด</span>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    min={leaveForm.startDate}
                    onChange={(event) =>
                      setLeaveForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">เหตุผล</span>
                <textarea
                  value={leaveForm.reason}
                  onChange={(event) =>
                    setLeaveForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            </div>
            {leaveError ? (
              <p className="mt-3 text-sm text-destructive">{leaveError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={leaveSubmitting || !leaveForm.leaveTypeId}
                onClick={() => void submitLeave()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {leaveSubmitting ? "กำลังส่ง..." : "ส่งคำขอ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
