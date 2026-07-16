"use client";

import { Archive, Pencil, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import DateSelector from "@/components/ui/DateSelector";
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

type RoleOption = {
  id: string;
  code: string;
  displayName: string;
  isActive: boolean;
};

type ShiftTemplateOption = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type FormState = {
  firstName: string;
  lastName: string;
  nickname: string;
  nationalId: string;
  birthDate: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  username: string;
  email: string;
  phone: string;
  employmentType: "DAILY" | "MONTHLY";
  hrStatus: string;
  roleId: string;
  defaultShiftTemplateId: string;
  hiredAt: string;
  branchName: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  promptPay: string;
  otHourlyRate: string;
  dailyRate: string;
  monthlySalary: string;
  compensationEffectiveFrom: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  nickname: "",
  nationalId: "",
  birthDate: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
  username: "",
  email: "",
  phone: "",
  employmentType: "MONTHLY",
  hrStatus: "ACTIVE",
  roleId: "",
  defaultShiftTemplateId: "",
  hiredAt: "",
  branchName: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  promptPay: "",
  otHourlyRate: "",
  dailyRate: "",
  monthlySalary: "",
  compensationEffectiveFrom: "",
};

const fieldClassName =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-ring/20";

function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
      {hint ? (
        <span className="ml-1 font-normal text-muted-foreground">({hint})</span>
      ) : null}
    </span>
  );
}

export function HrEmployeesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { permissions } = useEmployeePermissions();
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
  const [editingMeta, setEditingMeta] = useState<{
    hasAuth: boolean;
    isActive: boolean;
    mustResetPassword: boolean;
    email: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [shiftTemplateOptions, setShiftTemplateOptions] = useState<
    ShiftTemplateOption[]
  >([]);
  const [businessPayDay, setBusinessPayDay] = useState<number>(25);

  const canCreate = permissions.includes("hr.employee.create");
  const canUpdate = permissions.includes("hr.employee.update");
  const canArchive = permissions.includes("hr.employee.archive");

  useEffect(() => {
    // Roles list is ADMIN-only (see /api/roles); fail closed and simply hide
    // the role select for actors without access instead of surfacing an error.
    fetch("/api/roles", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: RoleOption[]) => setRoleOptions(Array.isArray(data) ? data : []))
      .catch(() => setRoleOptions([]));

    fetch("/api/hr/shift-templates", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ShiftTemplateOption[]) =>
        setShiftTemplateOptions(Array.isArray(data) ? data : []),
      )
      .catch(() => setShiftTemplateOptions([]));

    fetch("/api/hr/payroll/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: { parsed?: { payDayOfMonth?: number } } | null) => {
          const day = data?.parsed?.payDayOfMonth;
          if (typeof day === "number" && day >= 1 && day <= 31) {
            setBusinessPayDay(day);
          }
        },
      )
      .catch(() => undefined);
  }, []);

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
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setEditingMeta(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(item: HrEmployeeRecord) {
    setEditingId(item.id);
    setEditingMeta({
      hasAuth: item.hasAuth,
      isActive: item.isActive,
      mustResetPassword: item.mustResetPassword,
      email: item.email,
    });
    setForm({
      firstName: item.firstName ?? item.name,
      lastName: item.lastName ?? "",
      nickname: item.nickname ?? "",
      nationalId: item.nationalId ?? "",
      birthDate: item.birthDate ?? "",
      address: item.address ?? "",
      emergencyContactName: item.emergencyContactName ?? "",
      emergencyContactPhone: item.emergencyContactPhone ?? "",
      notes: item.notes ?? "",
      username: item.username ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      employmentType: item.employmentType,
      hrStatus: item.hrStatus,
      roleId: item.roleId ?? "",
      defaultShiftTemplateId: item.defaultShiftTemplateId ?? "",
      hiredAt: item.hiredAt ?? "",
      branchName: item.branchName ?? "",
      bankName: item.bankName ?? "",
      bankAccountName: item.bankAccountName ?? "",
      bankAccountNumber: item.bankAccountNumber ?? "",
      promptPay: item.promptPay ?? "",
      otHourlyRate: item.otHourlyRate !== null ? String(item.otHourlyRate) : "",
      dailyRate: "",
      monthlySalary: "",
      compensationEffectiveFrom: "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        nickname: form.nickname.trim() || null,
        nationalId: form.nationalId.trim() || null,
        birthDate: form.birthDate || null,
        address: form.address.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        notes: form.notes.trim() || null,
        username: form.username.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        employmentType: form.employmentType,
        hrStatus: form.hrStatus,
        roleId: form.roleId || null,
        defaultShiftTemplateId: form.defaultShiftTemplateId || null,
        hiredAt: form.hiredAt || null,
        branchName: form.branchName.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        promptPay: form.promptPay.trim() || null,
        otHourlyRate: form.otHourlyRate ? Number(form.otHourlyRate) : null,
        // Payday is business-level (payroll settings), not per employee.
        payDayOfMonth: null,
      };
      if (!editingId) {
        payload.username = form.username.trim();
        payload.phone = form.phone.trim();
        if (form.dailyRate) payload.dailyRate = Number(form.dailyRate);
        if (form.monthlySalary) payload.monthlySalary = Number(form.monthlySalary);
        if (form.compensationEffectiveFrom) {
          payload.compensationEffectiveFrom = form.compensationEffectiveFrom;
        }
      }
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl shadow-foreground/10">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {editingId ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงาน"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                กรอกรายละเอียดให้ครบเพื่อใช้เป็นข้อมูลส่วนตัวและการจ้างงาน
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
              <section className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  1. ข้อมูลส่วนตัว
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <FieldLabel>ชื่อ</FieldLabel>
                    <input
                      required
                      value={form.firstName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel>นามสกุล</FieldLabel>
                    <input
                      value={form.lastName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">ชื่อเล่น</FieldLabel>
                    <input
                      value={form.nickname}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nickname: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">เลขบัตรประชาชน</FieldLabel>
                    <input
                      value={form.nationalId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nationalId: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="xxxxxxxxxxxxx"
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">วันเกิด</FieldLabel>
                    <DateSelector
                      date={form.birthDate}
                      setDate={(birthDate) =>
                        setForm((current) => ({ ...current, birthDate }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <FieldLabel hint="ไม่บังคับ">ที่อยู่</FieldLabel>
                    <textarea
                      value={form.address}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      rows={2}
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">ผู้ติดต่อฉุกเฉิน</FieldLabel>
                    <input
                      value={form.emergencyContactName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          emergencyContactName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">เบอร์ผู้ติดต่อฉุกเฉิน</FieldLabel>
                    <input
                      value={form.emergencyContactPhone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          emergencyContactPhone: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="08xxxxxxxx"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <FieldLabel hint="ไม่บังคับ">หมายเหตุ</FieldLabel>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={2}
                      className={fieldClassName}
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    2. ข้อมูลเข้าสู่ระบบ
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ใช้ Username หรือเบอร์โทรเข้าสู่ระบบ อีเมลเป็นข้อมูลติดต่อเท่านั้น
                    {!editingId
                      ? " — ครั้งแรกให้ใส่ Username/เบอร์โทรแล้วตั้งรหัสผ่านเอง"
                      : ""}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <FieldLabel>{`Username${editingId ? "" : " *"}`}</FieldLabel>
                    <input
                      required={!editingId}
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="เช่น somchai.w"
                    />
                  </label>
                  <label>
                    <FieldLabel>{`เบอร์โทรศัพท์${editingId ? "" : " *"}`}</FieldLabel>
                    <input
                      required={!editingId}
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="08xxxxxxxx"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <FieldLabel hint="ไม่บังคับ">อีเมล</FieldLabel>
                    <input
                      type="email"
                      value={form.email}
                      readOnly={Boolean(editingMeta?.email)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className={`${fieldClassName} ${
                        editingMeta?.email
                          ? "bg-muted text-muted-foreground"
                          : ""
                      }`}
                    />
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {editingMeta?.email
                        ? "บัญชีเดิมนี้ยังใช้ Email สำหรับเข้าสู่ระบบ"
                        : "ใช้เป็นข้อมูลติดต่อเท่านั้น ไม่ใช่ตัว login หลักของพนักงานใหม่"}
                    </span>
                  </label>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  3. สิทธิ์และสถานะ
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleOptions.length > 0 ? (
                    <label>
                      <FieldLabel>บทบาทเข้าใช้ระบบ</FieldLabel>
                      <select
                        value={form.roleId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            roleId: event.target.value,
                          }))
                        }
                        className={fieldClassName}
                      >
                        <option value="">ไม่กำหนด</option>
                        {roleOptions
                          .filter((role) => role.isActive)
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.displayName}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <FieldLabel>สถานะพนักงาน</FieldLabel>
                    <select
                      value={form.hrStatus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hrStatus: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    >
                      {employeeHrStatuses.map((status) => (
                        <option key={status} value={status}>
                          {employeeHrStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editingMeta ? (
                    <div className="sm:col-span-2 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        สถานะบัญชีเข้าสู่ระบบ
                      </p>
                      <p className="mt-1 leading-relaxed">
                        {[
                          editingMeta.hasAuth ? "มี Auth" : "ยังไม่ผูก Auth",
                          editingMeta.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
                          editingMeta.mustResetPassword
                            ? "รอตั้งรหัสผ่านใหม่"
                            : null,
                          editingMeta.email
                            ? "Login ด้วย Email (บัญชีเดิม)"
                            : "Login ด้วย Username/เบอร์โทร",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  4. ข้อมูลการจ้างงาน
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <FieldLabel>ประเภทจ้าง</FieldLabel>
                    <select
                      value={form.employmentType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employmentType: event.target.value as
                            | "DAILY"
                            | "MONTHLY",
                        }))
                      }
                      className={fieldClassName}
                    >
                      {employmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {employmentTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <FieldLabel>กะประจำ</FieldLabel>
                    <select
                      value={form.defaultShiftTemplateId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          defaultShiftTemplateId: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="">ไม่กำหนด</option>
                      {shiftTemplateOptions
                        .filter((template) => template.isActive)
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.startTime}–
                            {template.endTime})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">วันที่เริ่มงาน</FieldLabel>
                    <DateSelector
                      date={form.hiredAt}
                      setDate={(hiredAt) =>
                        setForm((current) => ({ ...current, hiredAt }))
                      }
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">สาขา/จุดบริการ</FieldLabel>
                    <input
                      value={form.branchName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          branchName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <div className="sm:col-span-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3.5 py-3 text-sm">
                    <p className="font-medium text-foreground">
                      วันจ่ายเงินเดือนของกิจการ
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      วันที่ {businessPayDay} ของทุกเดือน — ใช้ค่ากลางของกิจการ
                      (ตั้งค่าได้ที่หน้าค่าจ้าง) ไม่กำหนดรายคน
                    </p>
                  </div>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">อัตรา OT ต่อชั่วโมง</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.otHourlyRate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          otHourlyRate: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  {!editingId ? (
                    <>
                      <label>
                        <FieldLabel>
                          {form.employmentType === "DAILY"
                            ? "ค่าจ้างต่อวัน"
                            : "เงินเดือน"}
                        </FieldLabel>
                        {form.employmentType === "DAILY" ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.dailyRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                dailyRate: event.target.value,
                              }))
                            }
                            className={fieldClassName}
                          />
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.monthlySalary}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                monthlySalary: event.target.value,
                              }))
                            }
                            className={fieldClassName}
                          />
                        )}
                      </label>
                      <label className="sm:col-span-2">
                        <FieldLabel>มีผลตั้งแต่วันที่</FieldLabel>
                        <DateSelector
                          date={form.compensationEffectiveFrom}
                          setDate={(compensationEffectiveFrom) =>
                            setForm((current) => ({
                              ...current,
                              compensationEffectiveFrom,
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  5. บัญชีรับเงิน
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <FieldLabel hint="ไม่บังคับ">ธนาคาร</FieldLabel>
                    <input
                      value={form.bankName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bankName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">ชื่อบัญชี</FieldLabel>
                    <input
                      value={form.bankAccountName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bankAccountName: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">เลขบัญชี</FieldLabel>
                    <input
                      value={form.bankAccountNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bankAccountNumber: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                  <label>
                    <FieldLabel hint="ไม่บังคับ">พร้อมเพย์</FieldLabel>
                    <input
                      value={form.promptPay}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          promptPay: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="border-t border-border bg-surface px-5 py-4 sm:px-6">
              {formError ? (
                <p className="mb-3 text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
