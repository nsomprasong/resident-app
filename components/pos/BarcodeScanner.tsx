"use client";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const handledRef = useRef(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onDetected, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    handledRef.current = false;
    setError("");
    setStarting(true);

    async function startScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับกล้อง ต้องเปิดผ่าน HTTPS",
          );
        }

        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) {
          throw new Error("ไม่พบกล้องบนอุปกรณ์นี้");
        }

        const backCamera =
          cameras.find((camera) =>
            /back|rear|environment|หลัง/i.test(camera.label),
          ) ?? cameras[cameras.length - 1];

        await scanner.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(Math.min(viewfinderWidth * 0.85, 320));
              const height = Math.floor(Math.min(viewfinderHeight * 0.35, 160));
              return { width, height };
            },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            const value = decodedText.trim();
            if (!value || handledRef.current) return;
            handledRef.current = true;
            onDetectedRef.current(value);
            onCloseRef.current();
          },
          () => {
            // keep scanning until a code is found
          },
        );
      } catch (reason) {
        if (cancelled) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการเข้าถึงกล้อง";
        setError(
          /NotAllowedError|Permission|denied/i.test(message)
            ? "ไม่ได้รับอนุญาตใช้กล้อง กรุณาอนุญาตในเบราว์เซอร์แล้วลองใหม่"
            : message,
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      void scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            // already cleared
          }
        });
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <Camera size={18} />
            สแกนบาร์โค้ด
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div
            id={regionId}
            className="overflow-hidden rounded-2xl bg-black [&_video]:!w-full"
          />
          {starting ? (
            <p className="text-sm text-muted-foreground">กำลังเปิดกล้อง...</p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              จัดวางบาร์โค้ดให้อยู่ในกรอบ ระบบจะบันทึกอัตโนมัติเมื่ออ่านได้
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
