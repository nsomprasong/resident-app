const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Wall-clock on workDate in Asia/Bangkok → UTC Date for storage. */
export function bangkokDateTimeFromParts(
  workDateKey: string,
  timeHHmm: string,
): Date | null {
  if (!DATE_KEY.test(workDateKey)) return null;
  const match = TIME_KEY.exec(timeHHmm.trim());
  if (!match) return null;
  const [y, m, d] = workDateKey.split("-").map(Number);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return new Date(Date.UTC(y, m - 1, d, hours - 7, minutes));
}

/** ISO instant → HH:mm in Asia/Bangkok for &lt;input type="time"&gt;. */
export function isoToBangkokTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function canDirectEditAttendanceTime(permissions: readonly string[]): boolean {
  return (
    permissions.includes("hr.attendance.approve") ||
    permissions.includes("hr.attendance.manage")
  );
}
