"use client";

import {
  AlertTriangle,
  Download,
  FileStack,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import DateSelector from "@/components/ui/DateSelector";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  DOCUMENT_EXPIRY_WARNING_DAYS,
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  EMPLOYEE_DOCUMENT_TYPES,
} from "@/lib/hr/documents";
import { displayEmployeeName } from "@/lib/hr/employees";
import { formatThaiDate } from "@/lib/format/date";

type DocumentItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  documentType: string;
  documentTypeLabel: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  expiryStatus: "OK" | "EXPIRING_SOON" | "EXPIRED" | "NONE";
};

type EmployeeOption = { id: string; name: string };

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function HrDocumentsBoard() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [alerts, setAlerts] = useState<DocumentItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [documentType, setDocumentType] = useState("CONTRACT");
  const [title, setTitle] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (filterEmployeeId) query.set("employeeId", filterEmployeeId);
      if (showExpiringOnly) {
        query.set("expiringWithinDays", String(DOCUMENT_EXPIRY_WARNING_DAYS));
      }
      const [docsRes, empRes] = await Promise.all([
        fetch(`/api/hr/documents?${query.toString()}`, { cache: "no-store" }),
        fetch("/api/hr/employees?pageSize=100", { cache: "no-store" }),
      ]);
      if (!docsRes.ok) {
        const body = (await docsRes.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดเอกสารไม่สำเร็จ");
      }
      const docsData = (await docsRes.json()) as {
        items: DocumentItem[];
        alerts: DocumentItem[];
      };
      setItems(docsData.items);
      setAlerts(docsData.alerts);
      if (empRes.ok) {
        const empData = (await empRes.json()) as {
          items: Array<{
            id: string;
            name: string;
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            email?: string | null;
            employeeCode?: string | null;
          }>;
        };
        setEmployees(
          empData.items.map((item) => ({
            id: item.id,
            name: displayEmployeeName(item),
          })),
        );
        setEmployeeId((prev) => prev || empData.items[0]?.id || "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, showExpiringOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload() {
    if (!file || !employeeId || !title) {
      setError("กรุณาเลือกพนักงาน ชื่อเอกสาร และไฟล์");
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("employeeId", employeeId);
      form.set("documentType", documentType);
      form.set("title", title);
      if (issuedAt) form.set("issuedAt", issuedAt);
      if (expiresAt) form.set("expiresAt", expiresAt);
      if (notes) form.set("notes", notes);
      form.set("file", file);
      const response = await fetch("/api/hr/documents", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "อัปโหลดไม่สำเร็จ");
      }
      setMessage("อัปโหลดเอกสารแล้ว");
      setFile(null);
      setTitle("");
      setNotes("");
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "อัปโหลดไม่สำเร็จ",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id: string) {
    setError("");
    const response = await fetch(`/api/hr/documents/${id}/download`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      signedUrl?: string;
      fileName?: string;
    } | null;
    if (!response.ok || !payload?.signedUrl) {
      setError(payload?.message ?? "ดาวน์โหลดไม่สำเร็จ");
      return;
    }
    window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: "ยืนยันลบเอกสารนี้?",
        description: "การลบไม่สามารถย้อนกลับได้",
        confirmLabel: "ลบเอกสาร",
        tone: "danger",
      }))
    ) {
      return;
    }
    setError("");
    const response = await fetch(`/api/hr/documents?id=${id}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.message ?? "ลบไม่สำเร็จ");
      return;
    }
    setMessage("ลบเอกสารแล้ว");
    await load();
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </p>
      ) : null}

      {alerts.length > 0 && !showExpiringOnly ? (
        <section className="rounded-3xl border border-warning/40 bg-warning/10 p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle size={18} />
            เอกสารหมดอายุ/ใกล้หมดอายุ ({alerts.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.slice(0, 6).map((item) => (
              <li key={item.id}>
                {item.employeeName} · {item.title} · หมดอายุ{" "}
                {item.expiresAt ? formatThaiDate(item.expiresAt) : "-"} (
                {item.expiryStatus})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Upload size={18} />
          อัปโหลดเอกสาร
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">พนักงาน</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภท</span>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              {EMPLOYEE_DOCUMENT_TYPES.map((code) => (
                <option key={code} value={code}>
                  {EMPLOYEE_DOCUMENT_TYPE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ชื่อเอกสาร</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">วันที่ออก</span>
            <DateSelector date={issuedAt} setDate={setIssuedAt} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">วันหมดอายุ</span>
            <DateSelector
              date={expiresAt}
              setDate={setExpiresAt}
              min={issuedAt || undefined}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ไฟล์</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm file:mr-3"
            />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-muted-foreground">หมายเหตุ</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => void handleUpload()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <FileStack size={16} />
          {uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          เก็บใน bucket ส่วนตัว ไม่เปิดสาธารณะ · สูงสุด 10 MB · PDF/รูป/DOC
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">กรองพนักงาน</span>
            <select
              value={filterEmployeeId}
              onChange={(event) => setFilterEmployeeId(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExpiringOnly}
              onChange={(event) => setShowExpiringOnly(event.target.checked)}
            />
            แสดงเฉพาะหมดอายุ/ใกล้หมดอายุ ({DOCUMENT_EXPIRY_WARNING_DAYS} วัน)
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">เอกสาร</th>
                <th className="px-4 py-3">หมดอายุ</th>
                <th className="px-4 py-3">ไฟล์</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    กำลังโหลด...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    ยังไม่มีเอกสาร
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.employeeCode ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.documentTypeLabel}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>
                        {item.expiresAt
                          ? formatThaiDate(item.expiresAt)
                          : "-"}
                      </p>
                      <p
                        className={`text-xs ${
                          item.expiryStatus === "EXPIRED"
                            ? "text-destructive"
                            : item.expiryStatus === "EXPIRING_SOON"
                              ? "text-warning"
                              : "text-muted-foreground"
                        }`}
                      >
                        {item.expiryStatus}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.fileName}
                      <br />
                      {formatBytes(item.sizeBytes)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="ดู/ดาวน์โหลด"
                          onClick={() => void handleDownload(item.id)}
                          className="rounded-lg border border-border p-2 hover:bg-muted"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          title="ลบ"
                          onClick={() => void handleDelete(item.id)}
                          className="rounded-lg border border-border p-2 hover:bg-muted"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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
