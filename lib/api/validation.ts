import { NextResponse } from "next/server";

export type ValidationIssue = {
  path: string;
  message: string;
};

export function apiErrorResponse(
  message: string,
  status: number,
  code?: string,
  issues?: ValidationIssue[],
) {
  return NextResponse.json(
    {
      message,
      ...(code ? { code } : {}),
      ...(issues?.length ? { issues } : {}),
    },
    { status },
  );
}

export function validationErrorResponse(
  message: string,
  issues: ValidationIssue[],
) {
  return apiErrorResponse(message, 400, "VALIDATION_ERROR", issues);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return {
        ok: false as const,
        response: validationErrorResponse("รูปแบบข้อมูลไม่ถูกต้อง", [
          { path: "body", message: "Request body must be an object" },
        ]),
      };
    }

    return { ok: true as const, body };
  } catch {
    return {
      ok: false as const,
      response: validationErrorResponse("รูปแบบ JSON ไม่ถูกต้อง", [
        { path: "body", message: "Request body must be valid JSON" },
      ]),
    };
  }
}
