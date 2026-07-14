"use client";

import { Camera, ImagePlus, ScanBarcode, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { decodeBarcodeFromImageFile } from "@/lib/pos/barcode-decode";

type BarcodeScannerProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const fileRegionId = `file-${useId().replace(/:/g, "")}`;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(
    "ถ่ายรูปบาร์โค้ดให้ชัด แล้วระบบจะอ่านให้อัตโนมัติ",
  );
  const [decoding, setDecoding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleImage(file: File | null | undefined) {
    if (!file) return;
    setDecoding(true);
    setError("");
    setStatus("กำลังอ่านบาร์โค้ดจากรูป...");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);

    try {
      const value = await decodeBarcodeFromImageFile(file, fileRegionId);
      onDetected(value);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "อ่านบาร์โค้ดจากรูปไม่สำเร็จ",
      );
      setStatus("ลองถ่ายใหม่ ให้บาร์โค้ดใหญ่และชัดขึ้น");
    } finally {
      setDecoding(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <ScanBarcode size={18} />
            สแกนบาร์โค้ดจากรูป
          </p>
          <button
            type="button"
            onClick={() => {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              onClose();
            }}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div id={fileRegionId} className="hidden" />

          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="รูปที่จะอ่านบาร์โค้ด"
              className="max-h-56 w-full rounded-2xl border border-border object-contain bg-black"
            />
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
              ถ่ายให้บาร์โค้ดอยู่กลางภาพ
              <br />
              ใกล้พอที่จะอ่านตัวเลขใต้แท่งได้
            </div>
          )}

          <p className="text-sm text-muted-foreground">{status}</p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={decoding}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Camera size={16} />
              ถ่ายรูปสแกน
            </button>
            <button
              type="button"
              disabled={decoding}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm disabled:opacity-50"
            >
              <ImagePlus size={16} />
              เลือกจากรูป
            </button>
          </div>

          {decoding ? (
            <p className="text-sm text-muted-foreground">กำลังอ่านบาร์โค้ด...</p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>ถ่ายแนวนอน ให้แท่งบาร์โค้ดเต็มกรอบ</li>
              <li>หลีกเลี่ยงแสงสะท้อนและภาพเบลอ</li>
              <li>ถ้ายังไม่ได้ ลองพิมพ์ตัวเลขใต้บาร์โค้ดในช่องเอง</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
