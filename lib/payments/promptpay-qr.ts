import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

import type { PromptPayIdTypeValue } from "@/lib/settings/promptpay-account-shared";
import {
  isValidPromptPayIdentifier,
  toPromptPayTarget,
} from "@/lib/settings/promptpay-accounts";

export type PromptPayQrInput = {
  identifier: string;
  idType: PromptPayIdTypeValue;
  amount: number;
};

export function formatPromptPayAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return amount.toFixed(2);
}

export function buildPromptPayPayload(input: PromptPayQrInput): string {
  if (!isValidPromptPayIdentifier(input.identifier, input.idType)) {
    throw new Error("INVALID_IDENTIFIER");
  }
  const amount = Number(formatPromptPayAmount(input.amount));
  const target = toPromptPayTarget(input.identifier, input.idType);
  return generatePayload(target, { amount });
}

export async function buildPromptPayQrDataUrl(
  input: PromptPayQrInput,
): Promise<{ payload: string; dataUrl: string }> {
  const payload = buildPromptPayPayload(input);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#111111", light: "#ffffff" },
  });
  return { payload, dataUrl };
}

export function extractCrcFromPayload(payload: string): string | null {
  const match = payload.match(/6304([0-9A-F]{4})$/i);
  return match?.[1]?.toUpperCase() ?? null;
}
