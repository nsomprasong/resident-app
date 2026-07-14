"use client";

import { LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AuditLogListItem } from "@/lib/system/audit-logs";

type ListResponse = {
  items: AuditLogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    actions: string[];
    entityTypes: string[];
  };
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatMetadata(value: AuditLogListItem["metadata"]) {
  if (value === null || value === undefined) return "-";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function AuditLogViewer() {
  const [items, setItems] = useState<AuditLogListItem[]>([]);
  const [filters, setFilters] = useState<{ actions: string[]; entityTypes: string[] }>({
    actions: [],
    entityTypes: [],
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "30",
      });
      if (q.trim()) params.set("q", q.trim());
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/system/audit-logs?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดไม่สำเร็จ");
      }
      const data = (await response.json()) as ListResponse;
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setFilters(data.filters);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, q, action, entityType, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-muted-foreground">ค้นหา</span>
            <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
                placeholder="การกระทำ / ประเภท / ผู้ทำ"
                className="w-full bg-transparent outline-none"
              />
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">การกระทำ</span>
            <select
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {filters.actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภทข้อมูล</span>
            <select
              value={entityType}
              onChange={(event) => {
                setPage(1);
                setEntityType(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {filters.entityTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">จากวันที่</span>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw size={16} />
              รีเฟรช
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">เวลา</th>
                <th className="px-4 py-3 font-medium">ผู้ทำ</th>
                <th className="px-4 py-3 font-medium">การกระทำ</th>
                <th className="px-4 py-3 font-medium">ข้อมูล</th>
                <th className="px-4 py-3 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      กำลังโหลด...
                    </span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    ไม่พบบันทึกตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const expanded = expandedId === item.id;
                  return (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {item.actor.employeeName ?? "ระบบ / ไม่ระบุ"}
                        </p>
                        {item.actor.authUserId ? (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {item.actor.authUserId.slice(0, 8)}…
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.action}</td>
                      <td className="px-4 py-3">
                        <p>{item.entityType}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {item.entityId ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                          className="text-left text-sm text-primary hover:underline"
                        >
                          {expanded ? "ซ่อน" : "ดู metadata"}
                        </button>
                        {expanded ? (
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
                            {formatMetadata(item.metadata)}
                          </pre>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">ทั้งหมด {total} รายการ</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="px-2 py-1.5">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
