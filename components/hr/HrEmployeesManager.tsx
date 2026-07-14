"use client";

import { Archive, Pencil, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  employeeHrStatuses,
  employeeHrStatusLabels,
  employmentTypeLabels,
  employmentTypes,
  type HrEmployeeRecord,
} from "@/lib/hr/employees";

type ListResponse = {
  items: HrEmployeeRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type FormState = {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string;
  employmentType: "DAILY" | "MONTHLY";
  hrStatus: string;
  notes: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  nickname: "",
  email: "",
  phone: "",
  employmentType: "MONTHLY",
  hrStatus: "ACTIVE",
  notes: "",
};

export function HrEmployeesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [items, setItems] = useState<HrEmployeeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [hrStatus, setHrStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const canCreate = permissions.includes("hr.employee.create");
  const canUpdate = permissions.includes("hr.employee.update");
  const canArchive = permissions.includes("hr.employee.archive");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (q.trim()) params.set("q", q.trim());
      if (employmentType) params.set("employmentType", employmentType);
      if (hrStatus) params.set("hrStatus", hrStatus);
      const response = await fetch(`/api/hr/employees?${params}`, {
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
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, q, employmentType, hrStatus]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          employee: { permissions: string[] };
        };
        setPermissions(data.employee.permissions);
      } catch {
        // ignore
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(item: HrEmployeeRecord) {
    setEditingId(item.id);
    setForm({
      firstName: item.firstName ?? item.name,
      lastName: item.lastName ?? "",
      nickname: item.nickname ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      employmentType: item.employmentType,
      hrStatus: item.hrStatus,
      notes: item.notes ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        nickname: form.nickname || null,
        email: form.email || null,
        phone: form.phone || null,
        employmentType: form.employmentType,
        hrStatus: form.hrStatus,
        notes: form.notes || null,
      };
      const response = await fetch(
        editingId ? `/api/hr/employees/${editingId}` : "/api/hr/employees",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "บันทึกไม่สำเร็จ");
      }
      setModalOpen(false);
      await load();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveEmployee(item: HrEmployeeRecord) {
    if (!canArchive) return;
    if (
      !(await confirm({
        title: `เก็บถาวรพนักงาน ${item.name}?`,
        description: "พนักงานจะถูกเก็บถาวรและไม่แสดงในรายการใช้งานปกติ",
        confirmLabel: "เก็บถาวร",
        tone: "danger",
      }))
    ) {
      return;
    }
    const response = await fetch(`/api/hr/employees/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hrStatus: "ARCHIVED" }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "เก็บถาวรไม่สำเร็จ");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ค้นหา</span>
            <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
                placeholder="ชื่อ / รหัส / เบอร์"
                className="w-full bg-transparent outline-none"
              />
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภทจ้าง</span>
            <select
              value={employmentType}
              onChange={(event) => {
                setPage(1);
                setEmploymentType(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {employmentTypes.map((type) => (
                <option key={type} value={type}>
                  {employmentTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">สถานะ</span>
            <select
              value={hrStatus}
              onChange={(event) => {
                setPage(1);
                setHrStatus(event.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {employeeHrStatuses.map((status) => (
                <option key={status} value={status}>
                  {employeeHrStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} />
            เพิ่มพนักงาน
          </button>
        ) : null}
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
                <th className="px-4 py-3 font-medium">รหัส</th>
                <th className="px-4 py-3 font-medium">ชื่อ</th>
                <th className="px-4 py-3 font-medium">ประเภท</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">ติดต่อ</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    ไม่พบพนักงานตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{item.employeeCode ?? "-"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.nickname ? (
                        <p className="text-xs text-muted-foreground">
                          ชื่อเล่น {item.nickname}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{item.employmentTypeLabel}</td>
                    <td className="px-4 py-3">{item.hrStatusLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p>{item.phone ?? "-"}</p>
                      <p className="text-xs">{item.email ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-lg border border-border p-2 hover:bg-muted"
                            aria-label="แก้ไข"
                          >
                            <Pencil size={16} />
                          </button>
                        ) : null}
                        {canArchive && item.hrStatus !== "ARCHIVED" ? (
                          <button
                            type="button"
                            onClick={() => void archiveEmployee(item)}
                            className="rounded-lg border border-border p-2 hover:bg-muted"
                            aria-label="เก็บถาวร"
                          >
                            <Archive size={16} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">ทั้งหมด {total} รายการ</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
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
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-xl font-semibold">
              {editingId ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-1">
                <span className="mb-1 block text-muted-foreground">ชื่อ</span>
                <input
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">นามสกุล</span>
                <input
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">ชื่อเล่น</span>
                <input
                  value={form.nickname}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nickname: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">เบอร์โทร</span>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">
                  อีเมล (ถ้ามีบัญชี)
                </span>
                <input
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">ประเภทจ้าง</span>
                <select
                  value={form.employmentType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employmentType: event.target.value as "DAILY" | "MONTHLY",
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  {employmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {employmentTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">สถานะ</span>
                <select
                  value={form.hrStatus}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      hrStatus: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  {employeeHrStatuses.map((status) => (
                    <option key={status} value={status}>
                      {employeeHrStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">หมายเหตุ</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-destructive">{formError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
