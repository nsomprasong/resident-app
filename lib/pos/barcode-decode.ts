import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

import { getBarcodeDetectorCtor } from "@/lib/browser/safe-apis";

const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
];

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("เปิดรูปไม่สำเร็จ"));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawVariants(image: HTMLImageElement): HTMLCanvasElement[] {
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const baseCtx = base.getContext("2d", { willReadFrequently: true });
  if (!baseCtx) return [];
  baseCtx.drawImage(image, 0, 0, width, height);

  const boosted = document.createElement("canvas");
  boosted.width = width;
  boosted.height = height;
  const boostedCtx = boosted.getContext("2d", { willReadFrequently: true });
  if (!boostedCtx) return [base];
  boostedCtx.filter = "contrast(1.45) grayscale(1) brightness(1.08)";
  boostedCtx.drawImage(base, 0, 0);

  const inverted = document.createElement("canvas");
  inverted.width = width;
  inverted.height = height;
  const invertedCtx = inverted.getContext("2d", { willReadFrequently: true });
  if (!invertedCtx) return [base, boosted];
  invertedCtx.drawImage(boosted, 0, 0);
  const pixels = invertedCtx.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  invertedCtx.putImageData(pixels, 0, 0);

  // Center crop often helps when barcode is small in frame
  const crop = document.createElement("canvas");
  const cropW = Math.floor(width * 0.85);
  const cropH = Math.floor(height * 0.45);
  crop.width = cropW;
  crop.height = cropH;
  const cropCtx = crop.getContext("2d", { willReadFrequently: true });
  if (!cropCtx) return [base, boosted, inverted];
  cropCtx.filter = "contrast(1.45) grayscale(1)";
  cropCtx.drawImage(
    base,
    Math.floor((width - cropW) / 2),
    Math.floor((height - cropH) / 2),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH,
  );

  return [crop, boosted, base, inverted];
}

function decodeWithZxing(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 1) {
    luminance[j] =
      (imageData.data[i] * 77 +
        imageData.data[i + 1] * 150 +
        imageData.data[i + 2] * 29) >>
      8;
  }

  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
  hints.set(DecodeHintType.PURE_BARCODE, false);

  const reader = new MultiFormatReader();
  reader.setHints(hints);
  try {
    const source = new RGBLuminanceSource(luminance, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result = reader.decode(bitmap);
    const text = result.getText()?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    reader.reset();
  }
}

async function decodeWithBarcodeDetector(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const Detector = getBarcodeDetectorCtor();
  if (!Detector) return null;
  try {
    const detector = new Detector({
      formats: [
        "ean_13",
        "ean_8",
        "code_128",
        "code_39",
        "upc_a",
        "upc_e",
        "qr_code",
        "itf",
        "codabar",
      ],
    });
    const codes = await detector.detect(canvas);
    const value = codes[0]?.rawValue?.trim();
    return value || null;
  } catch {
    return null;
  }
}

async function decodeWithHtml5Qrcode(
  canvas: HTMLCanvasElement,
  regionId: string,
): Promise<string | null> {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
    "html5-qrcode"
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.95),
  );
  if (!blob) return null;
  const file = new File([blob], "barcode.jpg", { type: "image/jpeg" });
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
  try {
    const value = await scanner.scanFile(file, false);
    return value.trim() || null;
  } catch {
    return null;
  } finally {
    try {
      scanner.clear();
    } catch {
      // ignore
    }
  }
}

/** Decode barcode from a photo using multiple engines and image variants. */
export async function decodeBarcodeFromImageFile(
  file: File,
  regionId: string,
): Promise<string> {
  const image = await loadImage(file);
  const variants = drawVariants(image);
  if (!variants.length) {
    throw new Error("ประมวลผลรูปไม่สำเร็จ");
  }

  for (const canvas of variants) {
    const native = await decodeWithBarcodeDetector(canvas);
    if (native) return native;
    const zxing = decodeWithZxing(canvas);
    if (zxing) return zxing;
  }

  for (const canvas of variants) {
    const html5 = await decodeWithHtml5Qrcode(canvas, regionId);
    if (html5) return html5;
  }

  throw new Error(
    "ไม่พบบาร์โค้ดในรูป ลองถ่ายใกล้ขึ้น ให้บาร์โค้ดอยู่กลางภาพ แสงพอ และไม่เบลอ",
  );
}
