"use client";

import { KeyRound, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { EmployeeRecord } from "@/lib/settings/employees-shared";
import type { RoleRecord } from "@/lib/settings/roles-shared";

type FormState = {
  name: string;
  email: string;
  phone: string;
  roleId: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
};

type ApiErrorBody = {
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

type CurrentEmployee = {
  permissions: string[];
};

export function EmployeesManager() {
  const [canManage, setCanManage] = useState(false);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [items, setItems] = useState<EmployeeRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadIdentity() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setCanManage(false);
          return;
        }
        const data = (await response.json()) as { employee: CurrentEmployee };
        setCanManage(data.employee.permissions.includes("employee.manage"));
      } catch {
        setCanManage(false);
      } finally {
        if (!controller.signal.aborted) {
          setIdentityLoaded(true);
        }
      }
    }

    void loadIdentity();
    return () => controller.abort();
  }, []);

  const loadItems = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      const [employeesResponse, rolesResponse] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);

      const employeesBody = (await employeesResponse.json()) as
        | EmployeeRecord[]
        | ApiErrorBody;
      if (!employeesResponse.ok || !Array.isArray(employeesBody)) {
        throw new Error(
          !Array.isArray(employeesBody) && employeesBody.message
            ? employeesBody.message
            : "โหลดพนักงานไม่สำเร็จ",
        );
      }
      setItems(employeesBody);

      if (rolesResponse.ok) {
        const rolesBody = (await rolesResponse.json()) as
          | RoleRecord[]
          | ApiErrorBody;
        if (Array.isArray(rolesBody)) {
          setRoles(rolesBody.filter((role) => role.isActive));
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดพนักงานไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: EmployeeRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email ?? "",
      phone: item.phone ?? "",
      roleId: item.roleId ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        roleId: form.roleId.trim() || null,
      };

      const response = await fetch(
        editingId ? `/api/employees/${editingId}` : "/api/employees",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as EmployeeRecord | ApiErrorBody;
      if (!response.ok) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "บันทึกพนักงานไม่สำเร็จ",
        );
      }

      setModalOpen(false);
      await loadItems();
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "บันทึกพนักงานไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const unlinkAuth = async (item: EmployeeRecord) => {
    if (!item.authUserId) return;
    if (
      !window.confirm(
        `ถอดการผูก Auth ของ ${item.name}? บัญชีนี้จะเข้าสู่ระบบไม่ได้จนกว่าจะผูกใหม่`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/employees/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId: null }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.message ?? "ถอดการผูก Auth ไม่สำเร็จ");
      }
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ถอดการผูก Auth ไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: EmployeeRecord) => {
    const nextActive = !item.isActive;
    if (nextActive && !item.roleId) {
      setError("ต้องกำหนด Role ก่อนเปิดใช้งานบัญชี");
      return;
    }
    if (
      !nextActive &&
      !window.confirm(
        `ปิดใช้งาน ${item.name}? บัญชีนี้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง (Auth mapping ยังคงอยู่)`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/employees/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
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

  const resetPassword = async (item: EmployeeRecord) => {
    if (!item.authUserId) {
      setError("พนักงานยังไม่มีบัญชี Auth");
      return;
    }
    if (
      !window.confirm(
        `รีเซ็ตรหัสผ่านของ ${item.name}? ครั้งถัดไปที่เข้าสู่ระบบจะต้องตั้งรหัสผ่านใหม่`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/employees/${item.id}/reset-password`,
        { method: "POST" },
      );
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!identityLoaded) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์จัดการพนักงาน...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Employees</p>
        <p className="mt-2 text-sm text-muted-foreground">
          การจัดการพนักงานต้องใช้สิทธิ์ employee.manage (ผู้ดูแลระบบเท่านั้น)
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Employees</p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          เพิ่ม
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดพนักงาน...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีพนักงาน</p>
      ) : null}

      <div className="space-y-2">
        {items.map((employee) => (
          <div
            key={employee.id}
            className={`rounded-2xl border p-3 text-sm ${
              employee.isActive
                ? "border-border bg-background"
                : "border-border bg-muted opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">{employee.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {employee.roleDisplayName ?? "ยังไม่มี role"}
                </span>
                {employee.email ? (
                  <span className="ml-2 text-muted-foreground">{employee.email}</span>
                ) : null}
                {employee.phone ? (
                  <span className="ml-2 text-muted-foreground">{employee.phone}</span>
                ) : null}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    employee.authUserId
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                  }`}
                >
                  {employee.authUserId ? "มี Auth" : "ยังไม่ผูก Auth"}
                </span>
                {!employee.isActive ? (
                  <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    รอเปิดใช้งาน / ปิดใช้งาน
                  </span>
                ) : null}
                {employee.mustResetPassword ? (
                  <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                    รอตั้งรหัสผ่านใหม่
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(employee)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(employee)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {employee.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
              {employee.authUserId ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void resetPassword(employee)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  <KeyRound size={14} />
                  รีเซ็ตรหัสผ่าน
                </button>
              ) : null}
              {employee.authUserId ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void unlinkAuth(employee)}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  ถอด Auth
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
          aria-labelledby="employee-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="employee-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
            </h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => void submitForm(e)}
            >
              <label className="block text-sm">
                ชื่อ
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                อีเมล (Supabase Auth)
                <input
                  required={!editingId}
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      email: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                เบอร์โทร
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      phone: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Role
                <select
                  value={form.roleId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      roleId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  <option value="">ยังไม่กำหนด</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.displayName} ({role.code})
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                ระบบจะค้นหาหรือสร้าง Supabase Auth user จากอีเมล แล้วบันทึก UUID
                ลง Employee อัตโนมัติ (รหัสผ่านชั่วคราว — ตั้งใหม่ผ่าน Supabase
                recovery)
              </p>
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
