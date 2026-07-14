const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in meters (Haversine formula). */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const a =
    sinDLat * sinDLat +
    Math.cos(rLat1) * Math.cos(rLat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export type CoordinateValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Validate latitude/longitude are finite numbers within valid ranges. */
export function validateCoordinates(
  latitude: unknown,
  longitude: unknown,
): CoordinateValidationResult {
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) {
    return { ok: false, message: "ละติจูดไม่ถูกต้อง" };
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return { ok: false, message: "ลองจิจูดไม่ถูกต้อง" };
  }
  if (latitude < -90 || latitude > 90) {
    return { ok: false, message: "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90" };
  }
  if (longitude < -180 || longitude > 180) {
    return { ok: false, message: "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180" };
  }
  return { ok: true };
}

/** Map browser GeolocationPositionError (and secure-context checks) to Thai UX copy. */
export function describeGeolocationFailure(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "เบราว์เซอร์อนุญาต GPS เฉพาะบน HTTPS หรือ localhost — เปิดผ่าน https:// หรือ http://localhost แล้วลองใหม่";
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number"
  ) {
    const code = (error as { code: number }).code;
    if (code === 1) {
      return "ไม่ได้สิทธิ์เข้าถึงตำแหน่ง — กดไอคอนกุญแจ/ข้อมูลไซต์ในแถบที่อยู่ แล้วอนุญาต Location แล้วลองใหม่";
    }
    if (code === 2) {
      return "อ่านตำแหน่งไม่ได้ชั่วคราว — เปิด GPS ของอุปกรณ์แล้วลองใหม่";
    }
    if (code === 3) {
      return "หมดเวลารอตำแหน่ง GPS — ลองใหม่เมื่อสัญญาณดีขึ้น";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง";
}
