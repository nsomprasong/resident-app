export const SEED_BATCH_KEY = "attendance-payroll-2026-07-01-to-2026-07-16";

export const SEED_DATE_FROM = "2026-07-01";
export const SEED_DATE_TO = "2026-07-16";

export const SEED_SOURCE = "SEED";

export const SCHEDULE_PERIOD_NAME =
  "รอบทดสอบ 1–16 กรกฎาคม 2569";

export const PAYROLL_PERIOD_NAME =
  "รอบจ่ายทดสอบ 1–16 กรกฎาคม 2569";

export function seedNote(scenarioKey: string, extra?: string): string {
  const base = `[SEED:${SEED_BATCH_KEY}] ${scenarioKey}`;
  return extra ? `${base} ${extra}` : base;
}

export function seedMarkerPrefix(): string {
  return `[SEED:${SEED_BATCH_KEY}]`;
}

export function isSeedMarkedText(value: string | null | undefined): boolean {
  return Boolean(value?.includes(`[SEED:${SEED_BATCH_KEY}]`));
}

export type SeedCliArgs = {
  dryRun: boolean;
  calculatePayroll: boolean;
};

export function parseSeedCliArgs(argv: readonly string[]): SeedCliArgs {
  return {
    dryRun: argv.includes("--dry-run"),
    calculatePayroll: argv.includes("--calculate"),
  };
}

/** Block production unless explicitly opted in. */
export function assertSeedEnvironment(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_ALLOW_PRODUCTION !== "true"
  ) {
    throw new Error(
      "Seed ถูกบล็อกใน production — ตั้ง SEED_ALLOW_PRODUCTION=true เฉพาะเมื่อตั้งใจจริง",
    );
  }
}
