export type PromptPayIdTypeValue =
  | "PHONE"
  | "NATIONAL_ID_OR_TAX_ID"
  | "EWALLET";

export type PromptPayAccountRecord = {
  id: string;
  displayName: string;
  idType: PromptPayIdTypeValue;
  identifierMasked: string;
  accountName: string;
  bankName: string | null;
  isActive: boolean;
  isPrimary: boolean;
  notes: string | null;
  paymentCount: number;
};

export type PromptPayAccountDetailRecord = PromptPayAccountRecord & {
  identifier: string;
};

export const promptPayIdTypeOptions = [
  { value: "PHONE" as const, label: "เบอร์โทรศัพท์" },
  { value: "NATIONAL_ID_OR_TAX_ID" as const, label: "บัตรประชาชน / เลขผู้เสียภาษี" },
  { value: "EWALLET" as const, label: "e-Wallet ID" },
];
