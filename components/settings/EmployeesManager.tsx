"use client";

import { KeyRound, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { EmployeeRecord } from "@/lib/settings/employees-shared";
import type { RoleRecord } from "@/lib/settings/roles-shared";

type FormState = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  roleId: string;
};

const emptyForm: FormState = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirm: "",
  roleId: "",
};

type ApiErrorBody = {
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

export function EmployeesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { loaded: identityLoaded, can } = useEmployeePermissions();
  const canManage = can("employee.manage");
  const [items, setItems] = useState<EmployeeRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
      username: item.username ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      password: "",
      passwordConfirm: "",
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
      const payload = editingId
        ? {
            name: form.name.trim(),
            username: form.username.trim() || null,
            phone: form.phone.trim() || null,
            roleId: form.roleId.trim() || null,
            // email omitted on edit for phone accounts; legacy email remains untouched
            ...(form.email.trim() && !form.username.trim()
              ? { email: form.email.trim() }
              : {}),
          }
        : {
            name: form.name.trim(),
            username: form.username.trim(),
            phone: form.phone.trim(),
            password: form.password,
            passwordConfirm: form.passwordConfirm,
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

  const toggleActive = async (item: EmployeeRecord) => {
    const nextActive = !item.isActive;
    if (nextActive && !item.roleId) {
      setError("ต้องกำหนด Role ก่อนเปิดใช้งานบัญชี");
      return;
    }
    if (
      !nextActive &&
      !(await confirm({
        title: `ปิดใช้งาน ${item.name}?`,
        description:
          "บัญชีนี้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง (Auth mapping ยังคงอยู่)",
        confirmLabel: "ปิดใช้งาน",
        tone: "danger",
      }))
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
    if (!item.email && !item.phone) {
      setError("พนักงานยังไม่มีอีเมลหรือเบอร์โทรสำหรับรีเซ็ตรหัสผ่าน");
      return;
    }
    if (
      !(await confirm({
        title: `รีเซ็ตรหัสผ่านของ ${item.name}?`,
        description: item.email
          ? "ครั้งถัดไปที่ใส่อีเมลแล้วกดเข้าสู่ระบบ จะถูกพาไปตั้งรหัสผ่านใหม่โดยไม่ต้องใส่รหัสเดิม"
          : "ระบบจะสร้างรหัสผ่านชั่วคราวให้ส่งต่อพนักงาน (ยังไม่รองรับ SMS OTP)",
        confirmLabel: "รีเซ็ตรหัสผ่าน",
        tone: "warning",
      }))
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
      const body = (await response.json()) as ApiErrorBody & {
        temporaryPassword?: string;
      };
      if (!response.ok) {
        throw new Error(body.message ?? "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }
      if (body.temporaryPassword) {
        window.alert(
          `รหัสผ่านชั่วคราว (แสดงครั้งเดียว):\n${body.temporaryPassword}`,
        );
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
      {confirmDialog}
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
                <p className="font-medium text-foreground">{employee.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    employee.roleDisplayName ?? "ยังไม่มี role",
                    employee.username ? `@${employee.username}` : null,
                    employee.phone || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    employee.authUserId
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                  }`}
                >
                  {employee.authUserId ? "มี Auth" : "ยังไม่ผูก Auth"}
                </span>
                {!employee.isActive ? (
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    รอเปิดใช้งาน / ปิดใช้งาน
                  </span>
                ) : null}
                {employee.mustResetPassword ? (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                    รอตั้งรหัสผ่านใหม่
                  </span>
                ) : null}
                </div>
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
              {!editingId ? (
                <>
                  <label className="block text-sm">
                    Username
                    <input
                      required
                      value={form.username}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          username: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      placeholder="เช่น somchai.w"
                    />
                  </label>
                  <label className="block text-sm">
                    เบอร์โทรศัพท์
                    <input
                      required
                      value={form.phone}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          phone: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      placeholder="08xxxxxxxx"
                    />
                  </label>
                  <label className="block text-sm">
                    รหัสผ่านเริ่มต้น
                    <input
                      required
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          password: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      minLength={8}
                    />
                  </label>
                  <label className="block text-sm">
                    ยืนยันรหัสผ่าน
                    <input
                      required
                      type="password"
                      value={form.passwordConfirm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          passwordConfirm: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      minLength={8}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    Username
                    <input
                      value={form.username}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          username: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      placeholder="เพิ่มภายหลังได้"
                    />
                  </label>
                  <label className="block text-sm">
                    เบอร์โทรศัพท์
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          phone: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      placeholder="08xxxxxxxx"
                    />
                  </label>
                  {form.email ? (
                    <label className="block text-sm">
                      อีเมล
                      <input
                        type="email"
                        value={form.email}
                        readOnly
                        className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-muted-foreground"
                      />
                      <span className="mt-1 block text-xs text-muted-foreground">
                        บัญชีเดิมนี้ยังใช้ Email สำหรับเข้าสู่ระบบ
                      </span>
                    </label>
                  ) : null}
                </>
              )}
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
                {editingId
                  ? "พนักงานเดิมที่ใช้อีเมลยัง Login ด้วยอีเมลได้ตามปกติ — สามารถเพิ่ม Username/เบอร์โทรเป็นข้อมูลเพิ่มได้"
                  : "พนักงานใหม่ใช้ Username + เบอร์โทร + รหัสผ่าน (ไม่ใช้อีเมล) และต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก"}
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
