import { getPromptPayQr } from "@/lib/payments/promptpay-actions";

type RouteContext = {
  params: Promise<{ bookingId: string; paymentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const ids = await context.params;
  return getPromptPayQr(ids);
}
