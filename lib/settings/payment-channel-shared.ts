export const paymentMethodOptions = [
  { value: "CASH", label: "เงินสด" },
  { value: "PROMPTPAY", label: "พร้อมเพย์" },
  { value: "PROMPTPAY_QR", label: "พร้อมเพย์ QR" },
  { value: "TRANSFER", label: "โอน" },
  { value: "CARD", label: "บัตร" },
  { value: "ROOM_CHARGE", label: "ชาร์จเข้าห้อง" },
] as const;

export type PaymentMethodValue =
  (typeof paymentMethodOptions)[number]["value"];

export type PaymentChannelMasterRecord = {
  id: string;
  name: string;
  method: PaymentMethodValue;
  isActive: boolean;
  paymentCount: number;
};
