"use client";

import { KeyRound, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { groupPermissionsByMenu } from "@/lib/auth/permission-menu-groups";
import { resolvePermissionThaiLabel } from "@/lib/auth/permission-labels";
import type {
  PermissionRecord,
  RolePermissionMapping,
} from "@/lib/settings/role-permissions-shared";
import type { RoleRecord } from "@/lib/settings/roles-shared";

type FormState = {
  code: string;
  displayName: string;
};

const emptyForm: FormState = {
  code: "",
  displayName: "",
};

type ApiErrorBody = {
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

type CurrentEmployee = {
  permissions: string[];
};

export function RolesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [canManage, setCanManage] = useState(false);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [items, setItems] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [permissionRole, setPermissionRole] = useState<RoleRecord | null>(null);
  const [catalog, setCatalog] = useState<PermissionRecord[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [permissionSaving, setPermissionSaving] = useState(false);
  const permissionGroups = useMemo(
    () => groupPermissionsByMenu(catalog),
    [catalog],
  );

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
        setCanManage(
          data.employee.permissions.includes("authorization.manage"),
        );
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
      const response = await fetch("/api/roles", { cache: "no-store" });
      const body = (await response.json()) as RoleRecord[] | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลด roles ไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลด roles ไม่สำเร็จ");
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

  const openEdit = (item: RoleRecord) => {
    setEditingId(item.id);
    setForm({
      code: item.code,
      displayName: item.displayName,
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const openPermissions = async (role: RoleRecord) => {
    setPermissionRole(role);
    setPermissionError("");
    setPermissionLoading(true);
    try {
      const [catalogResponse, mappingResponse] = await Promise.all([
        fetch("/api/permissions", { cache: "no-store" }),
        fetch(`/api/roles/${role.id}/permissions`, { cache: "no-store" }),
      ]);

      const catalogBody = (await catalogResponse.json()) as
        | PermissionRecord[]
        | ApiErrorBody;
      const mappingBody = (await mappingResponse.json()) as
        | RolePermissionMapping
        | ApiErrorBody;

      if (!catalogResponse.ok || !Array.isArray(catalogBody)) {
        throw new Error(
          !Array.isArray(catalogBody) && catalogBody.message
            ? catalogBody.message
            : "โหลด catalog ไม่สำเร็จ",
        );
      }
      if (!mappingResponse.ok || !("permissionCodes" in mappingBody)) {
        throw new Error(
          "message" in mappingBody && mappingBody.message
            ? mappingBody.message
            : "โหลดสิทธิ์ของ role ไม่สำเร็จ",
        );
      }

      setCatalog(catalogBody);
      setSelectedCodes(new Set(mappingBody.permissionCodes));
    } catch (reason) {
      setCatalog([]);
      setSelectedCodes(new Set());
      setPermissionError(
        reason instanceof Error ? reason.message : "โหลดสิทธิ์ไม่สำเร็จ",
      );
    } finally {
      setPermissionLoading(false);
    }
  };

  const closePermissions = () => {
    if (permissionSaving) return;
    setPermissionRole(null);
    setPermissionError("");
  };

  const togglePermission = (code: string) => {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!permissionRole) return;
    setPermissionSaving(true);
    setPermissionError("");
    try {
      const response = await fetch(
        `/api/roles/${permissionRole.id}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissionCodes: Array.from(selectedCodes),
          }),
        },
      );
      const body = (await response.json()) as
        | RolePermissionMapping
        | ApiErrorBody;
      if (!response.ok) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "บันทึกสิทธิ์ไม่สำเร็จ",
        );
      }
      setPermissionRole(null);
    } catch (reason) {
      setPermissionError(
        reason instanceof Error ? reason.message : "บันทึกสิทธิ์ไม่สำเร็จ",
      );
    } finally {
      setPermissionSaving(false);
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = editingId
        ? { displayName: form.displayName.trim() }
        : {
            code: form.code.trim(),
            displayName: form.displayName.trim(),
          };

      const response = await fetch(
        editingId ? `/api/roles/${editingId}` : "/api/roles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as RoleRecord | ApiErrorBody;
      if (!response.ok) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "บันทึก role ไม่สำเร็จ",
        );
      }

      setModalOpen(false);
      await loadItems();
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "บันทึก role ไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: RoleRecord) => {
    const nextActive = !item.isActive;
    if (
      !nextActive &&
      item.employeeCount > 0 &&
      !(await confirm({
        title: `ปิดใช้งาน Role ${item.code}?`,
        description: `มีพนักงาน ${item.employeeCount} คนที่ถูก map อยู่ พนักงานเหล่านี้จะเข้าใช้งานไม่ได้จนกว่าจะเปลี่ยน role`,
        confirmLabel: "ปิดใช้งาน",
        tone: "danger",
      }))
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/roles/${item.id}`, {
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

  if (!identityLoaded) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์จัดการ roles...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Roles</p>
        <p className="mt-2 text-sm text-muted-foreground">
          การสร้าง/แก้ไขบทบาทและชุดสิทธิ์ต้องใช้สิทธิ์ authorization.manage
          (แก้ไขชุดสิทธิ์ของบทบาท) — การกำหนดบทบาทให้พนักงานใช้ที่เมนูพนักงาน
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      {confirmDialog}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Roles</p>
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
        <p className="text-sm text-muted-foreground">กำลังโหลด roles...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มี role</p>
      ) : null}

      <div className="space-y-2">
        {items.map((role) => (
          <div
            key={role.id}
            className={`rounded-2xl border p-3 text-sm ${
              role.isActive
                ? "border-border bg-background"
                : "border-border bg-muted opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">
                  {role.displayName}
                </span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {role.code}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {role.employeeCount} คน
                </span>
                {!role.isActive ? (
                  <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    ปิดใช้งาน
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(role)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                onClick={() => void openPermissions(role)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <KeyRound size={14} />
                สิทธิ์
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(role)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {role.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="role-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไข role" : "เพิ่ม role"}
            </h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => void submitForm(e)}
            >
              <label className="block text-sm">
                รหัส role (code)
                <input
                  required={!editingId}
                  disabled={Boolean(editingId)}
                  value={form.code}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="เช่น SUPERVISOR"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono uppercase disabled:bg-background"
                />
              </label>
              <label className="block text-sm">
                ชื่อที่แสดง
                <input
                  required
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      displayName: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              {!editingId ? (
                <p className="text-xs text-muted-foreground">
                  หลังสร้างแล้ว กดปุ่ม &quot;สิทธิ์&quot; เพื่อผูก permissions ให้ role
                </p>
              ) : null}
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

      {permissionRole ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-permissions-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="role-permissions-title"
              className="text-lg font-semibold text-foreground"
            >
              สิทธิ์ของ {permissionRole.displayName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              จัดกลุ่มตามเมนูจริง — จัดการก่อน ดูข้อมูลทีหลัง
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {permissionRole.code}
            </p>

            {permissionLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">กำลังโหลดสิทธิ์...</p>
            ) : (
              <div className="mt-4 max-h-[55vh] space-y-5 overflow-y-auto pr-1">
                {permissionGroups.map((group, index) => {
                  const showSection =
                    index === 0 ||
                    permissionGroups[index - 1]?.sectionTitle !==
                      group.sectionTitle;
                  return (
                    <section key={group.id} className="space-y-2">
                      {showSection ? (
                        <h4 className="sticky top-0 z-10 bg-surface py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                          {group.sectionTitle}
                        </h4>
                      ) : null}
                      <div className="rounded-2xl border border-border bg-background/60 p-3">
                        <p className="mb-2 text-sm font-medium text-foreground">
                          {group.title}
                        </p>
                        <div className="space-y-2">
                          {group.items.map((permission) => {
                            const checked = selectedCodes.has(permission.code);
                            return (
                              <label
                                key={`${group.id}:${permission.id}`}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-surface-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    togglePermission(permission.code)
                                  }
                                  className="mt-1"
                                />
                                <span>
                                  <span className="block text-sm font-medium text-foreground">
                                    {resolvePermissionThaiLabel(
                                      permission.code,
                                    ) ??
                                      permission.description ??
                                      permission.code}
                                  </span>
                                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                                    {permission.code}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  );
                })}
                {!catalog.length ? (
                  <p className="text-sm text-muted-foreground">ไม่พบ permissions ในระบบ</p>
                ) : null}
              </div>
            )}

            {permissionError ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {permissionError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={permissionSaving}
                onClick={closePermissions}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={permissionSaving || permissionLoading}
                onClick={() => void savePermissions()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {permissionSaving ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
