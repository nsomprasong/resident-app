"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import DateSelector from "@/components/ui/DateSelector";
import {
  HR_REPORT_TYPE_LABELS,
  HR_REPORT_TYPES,
  type HrReportType,
} from "@/lib/hr/reports";

type Department = { id: string; name: string };

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthStartKey() {
  return `${todayKey().slice(0, 8)}01`;
}

export function HrReportsBoard() {
  const [type, setType] = useState<HrReportType>("employees");
  const [from, setFrom] = useState(monthStartKey);
  const [to, setTo] = useState(todayKey);
  const [departmentId, setDepartmentId] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [hrStatus, setHrStatus] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Array<string | number>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        type,
        from,
        to,
      });
      if (departmentId) query.set("departmentId", departmentId);
      if (employmentType) query.set("employmentType", employmentType);
      if (hrStatus) query.set("hrStatus", hrStatus);
      const response = await fetch(`/api/hr/reports?${query.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดรายงานไม่สำเร็จ");
      }
      const data = (await response.json()) as {
        headers: string[];
        rows: Array<Array<string | number>>;
        departments?: Department[];
      };
      setHeaders(data.headers);
      setRows(data.rows);
      if (data.departments) setDepartments(data.departments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
      setHeaders([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type, from, to, departmentId, employmentType, hrStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = (() => {
    const query = new URLSearchParams({
      type,
      from,
      to,
      format: "csv",
    });
    if (departmentId) query.set("departmentId", departmentId);
    if (employmentType) query.set("employmentType", employmentType);
    if (hrStatus) query.set("hrStatus", hrStatus);
    return `/api/hr/reports?${query.toString()}`;
  })();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภทรายงาน</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as HrReportType)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              {HR_REPORT_TYPES.map((code) => (
                <option key={code} value={code}>
                  {HR_REPORT_TYPE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">จากวันที่</span>
            <DateSelector date={from} setDate={setFrom} max={to} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <DateSelector date={to} setDate={setTo} min={from} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">แผนก</span>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภทจ้าง</span>
            <select
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              <option value="DAILY">รายวัน</option>
              <option value="MONTHLY">รายเดือน</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">สถานะ</span>
            <select
              value={hrStatus}
              onChange={(event) => setHrStatus(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PROBATION">PROBATION</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="RESIGNED">RESIGNED</option>
              <option value="TERMINATED">TERMINATED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            <Download size={16} />
            Export CSV
          </a>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3 font-semibold">
          {HR_REPORT_TYPE_LABELS[type]} ({rows.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={Math.max(headers.length, 1)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(headers.length, 1)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    ไม่พบข้อมูลตามตัวกรอง
                  </td>
                </tr>
              ) : (
                rows.slice(0, 200).map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
