import type { PrismaClient } from "@/generated/prisma/client";

import { buildSnapshotFromTemplate } from "@/lib/hr/scheduled-shifts";
import { displayEmployeeName } from "@/lib/hr/employees";
import { parseDateKey } from "@/lib/hr/schedules";
import {
  PAYROLL_PERIOD_NAME,
  SCHEDULE_PERIOD_NAME,
  SEED_SOURCE,
  seedNote,
  seedMarkerPrefix,
  type SeedCliArgs,
} from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import {
  EMP1_JULY_PLAN,
  EMP1_REPLACED_DAY,
  EMP2_JULY_PLAN,
  EMP2_REPLACEMENT_DAY_11,
  EXTRA_EMPLOYEE_PLANS,
  dateKeyForJulyDay,
  scenarioNeedsLeave,
  scenarioSkipsShift,
  type DayScenarioKind,
} from "@/lib/hr/seed/attendance-payroll-july-2026-scenarios";
import {
  buildClockPlan,
  metricsFromClockPlan,
  seedGeoNearResort,
} from "@/lib/hr/seed/attendance-payroll-july-2026-times";

type SeedStats = {
  employees: string[];
  templates: string[];
  schedulePeriodId: string | null;
  scheduledShifts: number;
  attendanceRecords: number;
  leaveRequests: number;
  payrollPeriodId: string | null;
  payrollAdjustments: number;
  otSuggested: number;
  replacements: number;
  doubleShiftDays: number;
};

type EmployeeRow = {
  id: string;
  employeeCode: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  defaultShiftTemplateId: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  lateGraceMinutes: number;
};

function workDateFromDay(day: number): Date {
  const key = dateKeyForJulyDay(day);
  const parsed = parseDateKey(key);
  if (!parsed) throw new Error(`Invalid date key ${key}`);
  return parsed;
}

async function loadContext(prisma: PrismaClient) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, hrStatus: { in: ["ACTIVE", "PROBATION"] } },
    orderBy: [{ employeeCode: "asc" }, { createdAt: "asc" }],
    take: 5,
    select: {
      id: true,
      employeeCode: true,
      name: true,
      firstName: true,
      lastName: true,
      nickname: true,
      email: true,
      defaultShiftTemplateId: true,
    },
  });
  if (employees.length < 2) {
    throw new Error("ต้องมีพนักงาน Active อย่างน้อย 2 คน");
  }

  const templates = await prisma.shiftTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      startMinutes: true,
      endMinutes: true,
      breakMinutes: true,
      lateGraceMinutes: true,
    },
  });
  if (!templates.length) {
    throw new Error("ไม่พบ ShiftTemplate ที่ Active");
  }

  const setting = await prisma.hrAttendanceSetting.findUnique({
    where: { id: "default" },
  });
  if (!setting) {
    throw new Error(
      "ไม่พบ hr_attendance_settings — ตั้งค่าพิกัดรีสอร์ตก่อนรัน Seed",
    );
  }

  const actor =
    employees.find((item) => item.employeeCode?.startsWith("EMP")) ??
    employees[0]!;

  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isPaid: true },
  });
  const paidLeave =
    leaveTypes.find((item) => item.isPaid) ?? leaveTypes[0] ?? null;
  const unpaidLeave =
    leaveTypes.find((item) => !item.isPaid) ??
    leaveTypes.find((item) => item.isPaid) ??
    null;
  if (!paidLeave || !unpaidLeave) {
    throw new Error("ต้องมี LeaveType อย่างน้อย 1 ประเภท");
  }

  return {
    employees,
    templates,
    setting,
    actorId: actor.id,
    paidLeaveTypeId: paidLeave.id,
    unpaidLeaveTypeId: unpaidLeave.id,
  };
}

function pickTemplate(
  employee: EmployeeRow,
  templates: TemplateRow[],
  slot: number,
): TemplateRow {
  if (employee.defaultShiftTemplateId) {
    const own = templates.find(
      (item) => item.id === employee.defaultShiftTemplateId,
    );
    if (own) return own;
  }
  return templates[slot % templates.length]!;
}

function afternoonTemplate(
  templates: TemplateRow[],
  primary: TemplateRow,
): TemplateRow {
  const alt = templates.find((item) => item.id !== primary.id);
  if (!alt) return primary;
  return alt;
}

async function ensureSchedulePeriod(
  prisma: PrismaClient,
  actorId: string,
  dryRun: boolean,
): Promise<string | null> {
  const existing = await prisma.schedulePeriod.findFirst({
    where: {
      OR: [
        { name: SCHEDULE_PERIOD_NAME },
        {
          AND: [
            { startDate: workDateFromDay(1) },
            { endDate: workDateFromDay(16) },
          ],
        },
      ],
    },
  });
  if (existing) return existing.id;
  if (dryRun) return null;
  const created = await prisma.schedulePeriod.create({
    data: {
      name: SCHEDULE_PERIOD_NAME,
      startDate: workDateFromDay(1),
      endDate: workDateFromDay(16),
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: actorId,
      updatedById: actorId,
    },
  });
  return created.id;
}

function shiftPlanFromRow(
  row: {
    plannedStart: Date;
    plannedEnd: Date;
    lateGraceMinutes?: number;
  } | null,
  template: TemplateRow,
  workDate: Date,
): {
  plannedStart: Date;
  plannedEnd: Date;
  lateGraceMinutes: number;
} | null {
  if (row) {
    return {
      plannedStart: row.plannedStart,
      plannedEnd: row.plannedEnd,
      lateGraceMinutes: row.lateGraceMinutes ?? template.lateGraceMinutes,
    };
  }
  const snapshot = buildSnapshotFromTemplate(
    template.startMinutes,
    template.endMinutes,
    workDate,
    template.breakMinutes,
  );
  if (!snapshot) return null;
  return {
    plannedStart: snapshot.plannedStart,
    plannedEnd: snapshot.plannedEnd,
    lateGraceMinutes: template.lateGraceMinutes,
  };
}

async function createReplacementShift(input: {
  prisma: PrismaClient;
  dryRun: boolean;
  periodId: string;
  worker: EmployeeRow;
  owner: EmployeeRow;
  ownerScenarioKey: string;
  workerScenarioKey: string;
  template: TemplateRow;
  workDate: Date;
  day: number;
  actorId: string;
  settingLat: number;
  settingLng: number;
}) {
  const owner = await findSeedShift(
    input.prisma,
    input.owner.id,
    input.workDate,
    input.ownerScenarioKey,
  );
  const repl = await createShiftIfNeeded({
    prisma: input.prisma,
    dryRun: input.dryRun,
    periodId: input.periodId,
    employeeId: input.worker.id,
    template: input.template,
    workDate: input.workDate,
    day: input.day,
    scenarioKey: input.workerScenarioKey,
    assignmentType: "REPLACEMENT",
    replacedEmployeeId: input.owner.id,
    sourceScheduledShiftId: owner?.id ?? null,
    actorId: input.actorId,
  });
  const timing = shiftPlanFromRow(repl.row, input.template, input.workDate);
  if (timing && (repl.row || input.dryRun)) {
    const att = await upsertAttendance({
      prisma: input.prisma,
      dryRun: input.dryRun,
      employeeId: input.worker.id,
      workDate: input.workDate,
      scheduledShiftId: repl.id,
      scenarioKey: input.workerScenarioKey,
      kind: "WORK_NORMAL",
      plannedStart: timing.plannedStart,
      plannedEnd: timing.plannedEnd,
      lateGraceMinutes: timing.lateGraceMinutes,
      day: input.day,
      settingLat: input.settingLat,
      settingLng: input.settingLng,
    });
    return { repl, att };
  }
  return { repl, att: null };
}

async function processSimpleEmployeeDays(input: {
  prisma: PrismaClient;
  dryRun: boolean;
  periodId: string | null;
  employee: EmployeeRow;
  template: TemplateRow;
  plan: Record<number, DayScenarioKind>;
  empTag: string;
  actorId: string;
  lat: number;
  lng: number;
  stats: SeedStats;
  paidLeaveTypeId: string;
  unpaidLeaveTypeId: string;
}) {
  for (let day = 1; day <= 16; day += 1) {
    const workDate = workDateFromDay(day);
    const kind = input.plan[day];
    if (!kind) continue;

    if (kind === "ABSENT") {
      const shift = await createShiftIfNeeded({
        prisma: input.prisma,
        dryRun: input.dryRun,
        periodId: input.periodId ?? "dry",
        employeeId: input.employee.id,
        template: input.template,
        workDate,
        day,
        scenarioKey: `${input.empTag}-D${day}`,
        status: "ABSENT",
        actorId: input.actorId,
      });
      if (shift.created) input.stats.scheduledShifts += 1;
      continue;
    }

    if (scenarioNeedsLeave(kind)) {
      const leave = await upsertLeave({
        prisma: input.prisma,
        dryRun: input.dryRun,
        employeeId: input.employee.id,
        leaveTypeId:
          kind === "PAID_LEAVE"
            ? input.paidLeaveTypeId
            : input.unpaidLeaveTypeId,
        workDate,
        actorId: input.actorId,
        scenarioKey: `${input.empTag}-D${day}-LEAVE`,
      });
      if (leave.created) input.stats.leaveRequests += 1;
      const shift = await createShiftIfNeeded({
        prisma: input.prisma,
        dryRun: input.dryRun,
        periodId: input.periodId ?? "dry",
        employeeId: input.employee.id,
        template: input.template,
        workDate,
        day,
        scenarioKey: `${input.empTag}-D${day}`,
        status: "LEAVE",
        actorId: input.actorId,
      });
      if (shift.created) input.stats.scheduledShifts += 1;
      continue;
    }

    if (scenarioSkipsShift(kind)) continue;

    const shift = await createShiftIfNeeded({
      prisma: input.prisma,
      dryRun: input.dryRun,
      periodId: input.periodId ?? "dry",
      employeeId: input.employee.id,
      template: input.template,
      workDate,
      day,
      scenarioKey: `${input.empTag}-D${day}`,
      actorId: input.actorId,
    });
    if (shift.created) input.stats.scheduledShifts += 1;
    const plan = shiftPlanFromRow(shift.row, input.template, workDate);
    if (plan && (shift.row || input.dryRun)) {
      const att = await upsertAttendance({
        prisma: input.prisma,
        dryRun: input.dryRun,
        employeeId: input.employee.id,
        workDate,
        scheduledShiftId: shift.id,
        scenarioKey: `${input.empTag}-D${day}`,
        kind,
        plannedStart: plan.plannedStart,
        plannedEnd: plan.plannedEnd,
        lateGraceMinutes: plan.lateGraceMinutes,
        day,
        settingLat: input.lat,
        settingLng: input.lng,
      });
      if (att.created) input.stats.attendanceRecords += 1;
      if (att.otSuggested) input.stats.otSuggested += 1;
    }
  }
}

async function findSeedShift(
  prisma: PrismaClient,
  employeeId: string,
  workDate: Date,
  scenarioKey: string,
) {
  return prisma.scheduledShift.findFirst({
    where: {
      employeeId,
      workDate,
      note: { startsWith: seedNote(scenarioKey) },
    },
  });
}

async function createShiftIfNeeded(input: {
  prisma: PrismaClient;
  dryRun: boolean;
  periodId: string;
  employeeId: string;
  template: TemplateRow;
  workDate: Date;
  day: number;
  scenarioKey: string;
  assignmentType?: "NORMAL" | "REPLACEMENT" | "DOUBLE_SHIFT";
  replacedEmployeeId?: string | null;
  sourceScheduledShiftId?: string | null;
  status?: "SCHEDULED" | "REPLACED" | "LEAVE" | "ABSENT";
  noteExtra?: string;
  actorId: string;
}) {
  const existingSeed = await findSeedShift(
    input.prisma,
    input.employeeId,
    input.workDate,
    input.scenarioKey,
  );
  if (existingSeed) return { id: existingSeed.id, created: false, row: existingSeed };

  const foreign = await input.prisma.scheduledShift.findFirst({
    where: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      status: { in: ["SCHEDULED", "COMPLETED", "ABSENT", "LEAVE"] },
      NOT: { note: { startsWith: seedMarkerPrefix() } },
    },
  });
  if (foreign) {
    return { id: foreign.id, created: false, reusedForeign: true, row: foreign };
  }

  const snapshot = buildSnapshotFromTemplate(
    input.template.startMinutes,
    input.template.endMinutes,
    input.workDate,
    input.template.breakMinutes,
  );
  if (!snapshot) throw new Error("snapshot failed");

  if (input.dryRun) {
    return { id: null, created: true, dryRun: true as const, row: null };
  }

  const row = await input.prisma.scheduledShift.create({
    data: {
      schedulePeriodId: input.periodId,
      employeeId: input.employeeId,
      shiftTemplateId: input.template.id,
      workDate: input.workDate,
      plannedStart: snapshot.plannedStart,
      plannedEnd: snapshot.plannedEnd,
      breakMinutes: snapshot.breakMinutes,
      lateGraceMinutes: input.template.lateGraceMinutes,
      assignmentType: input.assignmentType ?? "NORMAL",
      status: input.status ?? "SCHEDULED",
      replacedEmployeeId: input.replacedEmployeeId ?? null,
      sourceScheduledShiftId: input.sourceScheduledShiftId ?? null,
      note: seedNote(input.scenarioKey, input.noteExtra),
      createdById: input.actorId,
      updatedById: input.actorId,
    },
  });
  return { id: row.id, created: true, row };
}

async function upsertLeave(input: {
  prisma: PrismaClient;
  dryRun: boolean;
  employeeId: string;
  leaveTypeId: string;
  workDate: Date;
  actorId: string;
  scenarioKey: string;
}) {
  const existing = await input.prisma.leaveRequest.findFirst({
    where: {
      employeeId: input.employeeId,
      startDate: input.workDate,
      endDate: input.workDate,
      reason: { startsWith: seedMarkerPrefix() },
    },
  });
  if (existing) return { id: existing.id, created: false };
  if (input.dryRun) return { id: null, created: true };
  const row = await input.prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.workDate,
      endDate: input.workDate,
      duration: "FULL_DAY",
      daysRequested: 1,
      reason: seedNote(input.scenarioKey, "leave"),
      status: "APPROVED",
      requestedById: input.actorId,
      reviewedById: input.actorId,
      reviewedAt: new Date(),
    },
  });
  return { id: row.id, created: true };
}

async function upsertAttendance(input: {
  prisma: PrismaClient;
  dryRun: boolean;
  employeeId: string;
  workDate: Date;
  scheduledShiftId: string | null;
  scenarioKey: string;
  kind: DayScenarioKind;
  plannedStart: Date;
  plannedEnd: Date;
  lateGraceMinutes: number;
  day: number;
  settingLat: number;
  settingLng: number;
  offSchedule?: boolean;
}) {
  const existing = await input.prisma.attendanceRecord.findFirst({
    where: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      source: SEED_SOURCE,
      notes: { startsWith: seedNote(input.scenarioKey) },
    },
  });
  if (existing) return { id: existing.id, created: false };

  if (
    scenarioSkipsShift(input.kind) &&
    input.kind !== "REPLACED_OWNER" &&
    !input.offSchedule
  ) {
    if (input.kind === "ABSENT" || input.kind === "PAID_LEAVE" || input.kind === "UNPAID_LEAVE") {
      return { id: null, created: false, skipped: true };
    }
  }

  const plan = buildClockPlan({
    kind: input.kind,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    lateGraceMinutes: input.lateGraceMinutes,
    day: input.day,
  });

  const metrics = metricsFromClockPlan({
    plan,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    lateGraceMinutes: input.lateGraceMinutes,
  });

  if (input.dryRun) {
    return {
      id: null,
      created: true,
      dryRun: true as const,
      otSuggested: plan.otSuggestedOnly,
    };
  }

  const record = await input.prisma.attendanceRecord.create({
    data: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      scheduledShiftId: input.offSchedule ? null : input.scheduledShiftId,
      source: SEED_SOURCE,
      clockIn: plan.clockIn,
      clockOut: plan.clockOut,
      scheduledStart: input.offSchedule ? null : input.plannedStart,
      scheduledEnd: input.offSchedule ? null : input.plannedEnd,
      workedMinutes: metrics.workedMinutes,
      breakMinutes: metrics.breakMinutes,
      lateMinutes: metrics.lateMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
      otMinutes: metrics.otMinutes,
      otApprovedMinutes: plan.otSuggestedOnly ? 0 : plan.otApprovedMinutes,
      status: metrics.status,
      notes: seedNote(input.scenarioKey, input.kind),
    },
  });

  if (plan.clockIn) {
    const geo = seedGeoNearResort(
      input.settingLat,
      input.settingLng,
      input.day,
    );
    await input.prisma.attendanceEvent.create({
      data: {
        employeeId: input.employeeId,
        attendanceRecordId: record.id,
        type: "CHECK_IN",
        occurredAt: plan.clockIn,
        latitude: geo.latitude,
        longitude: geo.longitude,
        distanceMeters: 12,
      },
    });
  }
  if (plan.clockOut) {
    const geo = seedGeoNearResort(
      input.settingLat,
      input.settingLng,
      input.day + 1,
    );
    await input.prisma.attendanceEvent.create({
      data: {
        employeeId: input.employeeId,
        attendanceRecordId: record.id,
        type: "CHECK_OUT",
        occurredAt: plan.clockOut,
        latitude: geo.latitude,
        longitude: geo.longitude,
        distanceMeters: 15,
      },
    });
  }

  if (plan.otSuggestedOnly && metrics.otMinutes > 0) {
    const existsAdj = await input.prisma.attendanceAdjustment.findFirst({
      where: {
        attendanceRecordId: record.id,
        reason: { startsWith: seedMarkerPrefix() },
      },
    });
    if (!existsAdj) {
      await input.prisma.attendanceAdjustment.create({
        data: {
          attendanceRecordId: record.id,
          type: "OT_REQUEST",
          status: "PENDING",
          reason: seedNote(input.scenarioKey, "OT รอตรวจ"),
          proposedOtMinutes: metrics.otMinutes,
          requestedById: input.employeeId,
        },
      });
    }
  }

  return { id: record.id, created: true, otSuggested: plan.otSuggestedOnly };
}

export async function runJuly2026AttendancePayrollSeed(
  prisma: PrismaClient,
  args: SeedCliArgs,
): Promise<SeedStats> {
  const ctx = await loadContext(prisma);
  const stats: SeedStats = {
    employees: ctx.employees.map(
      (item) =>
        `${item.employeeCode ?? "—"} · ${displayEmployeeName(item)}`,
    ),
    templates: ctx.templates.map((item) => item.name),
    schedulePeriodId: null,
    scheduledShifts: 0,
    attendanceRecords: 0,
    leaveRequests: 0,
    payrollPeriodId: null,
    payrollAdjustments: 0,
    otSuggested: 0,
    replacements: 0,
    doubleShiftDays: 0,
  };

  console.log("พนักงานที่จะใช้:");
  for (const line of stats.employees) console.log(`  - ${line}`);
  console.log("กะที่จะใช้:", stats.templates.join(", "));

  const periodId = await ensureSchedulePeriod(
    prisma,
    ctx.actorId,
    args.dryRun,
  );
  stats.schedulePeriodId = periodId;

  const emp1 = ctx.employees[0]!;
  const emp2 = ctx.employees[1]!;
  const tpl1 = pickTemplate(emp1, ctx.templates, 0);
  const tpl2 = pickTemplate(emp2, ctx.templates, 1);
  const tplAfternoon = afternoonTemplate(ctx.templates, tpl2);

  const lat = Number(ctx.setting.latitude);
  const lng = Number(ctx.setting.longitude);

  for (let day = 1; day <= 16; day += 1) {
    const workDate = workDateFromDay(day);
    const kind1 = EMP1_JULY_PLAN[day];
    const kind2 = EMP2_JULY_PLAN[day];
    if (!kind1 || !kind2) continue;

    // --- Employee 1 ---
    if (kind1 === "ABSENT") {
      const shift = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp1.id,
        template: tpl1,
        workDate,
        day,
        scenarioKey: `E1-D${day}`,
        status: "ABSENT",
        actorId: ctx.actorId,
      });
      if (shift.created) stats.scheduledShifts += 1;
    } else if (kind1 === "REPLACED_OWNER" && day === EMP1_REPLACED_DAY && periodId) {
        const ownerShift = await createShiftIfNeeded({
          prisma,
          dryRun: args.dryRun,
          periodId,
          employeeId: emp1.id,
          template: tpl1,
          workDate,
          day,
          scenarioKey: `E1-D${day}-OWNER`,
          status: "REPLACED",
          actorId: ctx.actorId,
        });
        if (ownerShift.created) stats.scheduledShifts += 1;
        if (!args.dryRun && ownerShift.id) {
          await prisma.scheduledShift.update({
            where: { id: ownerShift.id },
            data: { status: "REPLACED" },
          });
        }
    } else if (!scenarioSkipsShift(kind1)) {
      const shift = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp1.id,
        template: tpl1,
        workDate,
        day,
        scenarioKey: `E1-D${day}`,
        actorId: ctx.actorId,
      });
      if (shift.created) stats.scheduledShifts += 1;
      const plan1 = shiftPlanFromRow(shift.row, tpl1, workDate);
      if (plan1 && (shift.row || args.dryRun) && !scenarioNeedsLeave(kind1)) {
        const att = await upsertAttendance({
          prisma,
          dryRun: args.dryRun,
          employeeId: emp1.id,
          workDate,
          scheduledShiftId: shift.id,
          scenarioKey: `E1-D${day}`,
          kind: kind1,
          plannedStart: plan1.plannedStart,
          plannedEnd: plan1.plannedEnd,
          lateGraceMinutes: plan1.lateGraceMinutes,
          day,
          settingLat: lat,
          settingLng: lng,
        });
        if (att.created) stats.attendanceRecords += 1;
      }
    }
    if (scenarioNeedsLeave(kind1)) {
      const leave = await upsertLeave({
        prisma,
        dryRun: args.dryRun,
        employeeId: emp1.id,
        leaveTypeId:
          kind1 === "PAID_LEAVE"
            ? ctx.paidLeaveTypeId
            : ctx.unpaidLeaveTypeId,
        workDate,
        actorId: ctx.actorId,
        scenarioKey: `E1-D${day}-LEAVE`,
      });
      if (leave.created) stats.leaveRequests += 1;
      const shift = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp1.id,
        template: tpl1,
        workDate,
        day,
        scenarioKey: `E1-D${day}`,
        status: "LEAVE",
        actorId: ctx.actorId,
      });
      if (shift.created) stats.scheduledShifts += 1;
    }

    // --- Employee 2 ---
    if (kind2 === "REPLACEMENT_WORKER") {
      if (day === EMP1_REPLACED_DAY) {
        const { repl, att } = await createReplacementShift({
          prisma,
          dryRun: args.dryRun,
          periodId: periodId ?? "dry",
          worker: emp2,
          owner: emp1,
          ownerScenarioKey: `E1-D${day}-OWNER`,
          workerScenarioKey: `E2-D${day}-REPL`,
          template: tpl2,
          workDate,
          day,
          actorId: ctx.actorId,
          settingLat: lat,
          settingLng: lng,
        });
        if (repl.created) stats.scheduledShifts += 1;
        if (att?.created) stats.attendanceRecords += 1;
        stats.replacements += 1;
        continue;
      }
      if (day === EMP2_REPLACEMENT_DAY_11) {
        const { repl, att } = await createReplacementShift({
          prisma,
          dryRun: args.dryRun,
          periodId: periodId ?? "dry",
          worker: emp2,
          owner: emp1,
          ownerScenarioKey: `E1-D${day}`,
          workerScenarioKey: `E2-D${day}-REPL`,
          template: tpl2,
          workDate,
          day,
          actorId: ctx.actorId,
          settingLat: lat,
          settingLng: lng,
        });
        if (repl.created) stats.scheduledShifts += 1;
        if (att?.created) stats.attendanceRecords += 1;
        stats.replacements += 1;
        continue;
      }
    }

    if (kind2 === "DOUBLE_SHIFT_A") {
      const morning = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp2.id,
        template: tpl2,
        workDate,
        day,
        scenarioKey: `E2-D${day}-AM`,
        actorId: ctx.actorId,
      });
      const afternoonSnap = buildSnapshotFromTemplate(
        tplAfternoon.startMinutes,
        tplAfternoon.endMinutes,
        workDate,
        tplAfternoon.breakMinutes,
      );
      if (morning.created) stats.scheduledShifts += 1;
      let afternoonId: string | null = null;
      if (!args.dryRun && periodId && afternoonSnap) {
        const existingPm = await findSeedShift(
          prisma,
          emp2.id,
          workDate,
          `E2-D${day}-PM`,
        );
        if (existingPm) afternoonId = existingPm.id;
        else {
          const pm = await prisma.scheduledShift.create({
            data: {
              schedulePeriodId: periodId,
              employeeId: emp2.id,
              shiftTemplateId: tplAfternoon.id,
              workDate,
              plannedStart: afternoonSnap.plannedStart,
              plannedEnd: afternoonSnap.plannedEnd,
              breakMinutes: afternoonSnap.breakMinutes,
              lateGraceMinutes: tplAfternoon.lateGraceMinutes,
              assignmentType: "DOUBLE_SHIFT",
              note: seedNote(`E2-D${day}-PM`, "DOUBLE"),
              createdById: ctx.actorId,
              updatedById: ctx.actorId,
            },
          });
          afternoonId = pm.id;
          stats.scheduledShifts += 1;
        }
      } else if (args.dryRun) {
        stats.scheduledShifts += 1;
      }
      stats.doubleShiftDays += 1;
      const morningPlan = shiftPlanFromRow(morning.row, tpl2, workDate);
      if (morningPlan && (morning.row || args.dryRun)) {
        for (const [shiftId, scenarioKey, tplRow] of [
          [morning.id, `E2-D${day}-AM`, tpl2] as const,
          [afternoonId, `E2-D${day}-PM`, tplAfternoon] as const,
        ]) {
          if (!shiftId && !args.dryRun) continue;
          let row = morning.row;
          if (shiftId !== morning.id && shiftId) {
            row = await prisma.scheduledShift.findUnique({
              where: { id: shiftId },
            });
          }
          const plan =
            shiftId === morning.id
              ? morningPlan
              : shiftPlanFromRow(row, tplRow, workDate);
          if (!plan) continue;
          const att = await upsertAttendance({
            prisma,
            dryRun: args.dryRun,
            employeeId: emp2.id,
            workDate,
            scheduledShiftId: shiftId,
            scenarioKey,
            kind: "WORK_NORMAL",
            plannedStart: plan.plannedStart,
            plannedEnd: plan.plannedEnd,
            lateGraceMinutes: plan.lateGraceMinutes,
            day,
            settingLat: lat,
            settingLng: lng,
          });
          if (att.created) stats.attendanceRecords += 1;
        }
      }
      continue;
    }

    if (kind2 === "OFF_SCHEDULE") {
      const offPlan = shiftPlanFromRow(null, tpl2, workDate);
      if (!offPlan) continue;
      const att = await upsertAttendance({
        prisma,
        dryRun: args.dryRun,
        employeeId: emp2.id,
        workDate,
        scheduledShiftId: null,
        scenarioKey: `E2-D${day}-OFF`,
        kind: kind2,
        plannedStart: offPlan.plannedStart,
        plannedEnd: offPlan.plannedEnd,
        lateGraceMinutes: offPlan.lateGraceMinutes,
        day,
        settingLat: lat,
        settingLng: lng,
        offSchedule: true,
      });
      if (att.created) stats.attendanceRecords += 1;
      continue;
    }

    if (!scenarioSkipsShift(kind2)) {
      const shift = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp2.id,
        template: tpl2,
        workDate,
        day,
        scenarioKey: `E2-D${day}`,
        assignmentType:
          kind2 === "REPLACEMENT_WORKER" ? "REPLACEMENT" : "NORMAL",
        actorId: ctx.actorId,
      });
      if (shift.created) stats.scheduledShifts += 1;
      const plan2 = shiftPlanFromRow(shift.row, tpl2, workDate);
      if (plan2 && (shift.row || args.dryRun) && !scenarioNeedsLeave(kind2)) {
        const att = await upsertAttendance({
          prisma,
          dryRun: args.dryRun,
          employeeId: emp2.id,
          workDate,
          scheduledShiftId: shift.id,
          scenarioKey: `E2-D${day}`,
          kind: kind2,
          plannedStart: plan2.plannedStart,
          plannedEnd: plan2.plannedEnd,
          lateGraceMinutes: plan2.lateGraceMinutes,
          day,
          settingLat: lat,
          settingLng: lng,
        });
        if (att.created) stats.attendanceRecords += 1;
        if (att.otSuggested) stats.otSuggested += 1;
      }
    }
    if (scenarioNeedsLeave(kind2)) {
      const leave = await upsertLeave({
        prisma,
        dryRun: args.dryRun,
        employeeId: emp2.id,
        leaveTypeId:
          kind2 === "PAID_LEAVE"
            ? ctx.paidLeaveTypeId
            : ctx.unpaidLeaveTypeId,
        workDate,
        actorId: ctx.actorId,
        scenarioKey: `E2-D${day}-LEAVE`,
      });
      if (leave.created) stats.leaveRequests += 1;
      const leaveShift = await createShiftIfNeeded({
        prisma,
        dryRun: args.dryRun,
        periodId: periodId ?? "dry",
        employeeId: emp2.id,
        template: tpl2,
        workDate,
        day,
        scenarioKey: `E2-D${day}`,
        status: "LEAVE",
        actorId: ctx.actorId,
      });
      if (leaveShift.created) stats.scheduledShifts += 1;
    }
  }

  for (let empIndex = 2; empIndex < ctx.employees.length; empIndex += 1) {
    const plan = EXTRA_EMPLOYEE_PLANS[empIndex];
    if (!plan) continue;
    const emp = ctx.employees[empIndex]!;
    const tpl = pickTemplate(emp, ctx.templates, empIndex);
    await processSimpleEmployeeDays({
      prisma,
      dryRun: args.dryRun,
      periodId,
      employee: emp,
      template: tpl,
      plan,
      empTag: `E${empIndex + 1}`,
      actorId: ctx.actorId,
      lat,
      lng,
      stats,
      paidLeaveTypeId: ctx.paidLeaveTypeId,
      unpaidLeaveTypeId: ctx.unpaidLeaveTypeId,
    });
  }

  // Payroll period + adjustments
  let payrollPeriodId: string | null = null;
  const existingPayroll = await prisma.payrollPeriod.findFirst({
    where: { notes: { startsWith: seedMarkerPrefix() } },
  });
  if (existingPayroll) payrollPeriodId = existingPayroll.id;
  else if (!args.dryRun) {
    const created = await prisma.payrollPeriod.create({
      data: {
        name: PAYROLL_PERIOD_NAME,
        periodType: "CUSTOM",
        periodStart: workDateFromDay(1),
        periodEnd: workDateFromDay(16),
        status: "DRAFT",
        notes: seedNote("payroll-period"),
      },
    });
    payrollPeriodId = created.id;
  }
  stats.payrollPeriodId = payrollPeriodId;

  if (payrollPeriodId && !args.dryRun) {
    const adjSpecs = [
      {
        employeeId: emp2.id,
        type: "BONUS" as const,
        amount: 300,
        reason: seedNote("adj-bonus", "ค่าทำงานแทนพิเศษ (ทดสอบ)"),
      },
      {
        employeeId: emp1.id,
        type: "DEDUCTION" as const,
        amount: 100,
        reason: seedNote("adj-deduct", "รายการทดสอบการปรับยอด"),
      },
    ];
    for (const spec of adjSpecs) {
      const exists = await prisma.payrollAdjustment.findFirst({
        where: { periodId: payrollPeriodId, reason: spec.reason },
      });
      if (exists) continue;
      await prisma.payrollAdjustment.create({
        data: {
          periodId: payrollPeriodId,
          employeeId: spec.employeeId,
          type: spec.type,
          amount: spec.amount,
          reason: spec.reason,
          createdById: ctx.actorId,
        },
      });
      stats.payrollAdjustments += 1;
    }
  }

  if (args.calculatePayroll && payrollPeriodId && !args.dryRun) {
    console.log(
      "หมายเหตุ: ใช้ --calculate แล้ว — กรุณากดคำนวณใน UI หรือ POST /api/hr/payroll/periods (mode=calculate) สำหรับรอบนี้",
    );
    console.log(`  periodId=${payrollPeriodId}`);
  }

  return stats;
}

export async function clearJuly2026AttendancePayrollSeed(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const marker = seedMarkerPrefix();

  const payrollPeriods = await prisma.payrollPeriod.findMany({
    where: { notes: { contains: marker } },
    select: { id: true },
  });
  for (const period of payrollPeriods) {
    const payslips = await prisma.payrollPayslip.count({
      where: { periodId: period.id },
    });
    const entries = await prisma.payrollEntry.count({
      where: { periodId: period.id },
    });
    const adjustments = await prisma.payrollAdjustment.count({
      where: { periodId: period.id },
    });
    counts.payrollPayslips = (counts.payrollPayslips ?? 0) + payslips;
    counts.payrollEntries = (counts.payrollEntries ?? 0) + entries;
    counts.payrollAdjustments =
      (counts.payrollAdjustments ?? 0) + adjustments;
    if (!dryRun) {
      await prisma.payrollPayslip.deleteMany({ where: { periodId: period.id } });
      await prisma.payrollEntry.deleteMany({ where: { periodId: period.id } });
      await prisma.payrollAdjustment.deleteMany({
        where: { periodId: period.id },
      });
      await prisma.payrollPeriod.delete({ where: { id: period.id } });
    }
  }

  const seedRecords = await prisma.attendanceRecord.findMany({
    where: {
      OR: [{ source: SEED_SOURCE }, { notes: { contains: marker } }],
    },
    select: { id: true },
  });
  const recordIds = seedRecords.map((item) => item.id);
  counts.attendanceRecords = recordIds.length;
  if (recordIds.length && !dryRun) {
    await prisma.attendanceEvent.deleteMany({
      where: { attendanceRecordId: { in: recordIds } },
    });
    await prisma.attendanceAdjustment.deleteMany({
      where: { attendanceRecordId: { in: recordIds } },
    });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: recordIds } } });
  }

  const leaves = await prisma.leaveRequest.count({
    where: { reason: { contains: marker } },
  });
  counts.leaveRequests = leaves;
  if (leaves && !dryRun) {
    await prisma.leaveRequest.deleteMany({
      where: { reason: { contains: marker } },
    });
  }

  const shifts = await prisma.scheduledShift.count({
    where: { note: { contains: marker } },
  });
  counts.scheduledShifts = shifts;
  if (shifts && !dryRun) {
    await prisma.scheduleChangeLog.deleteMany({
      where: { scheduledShift: { note: { contains: marker } } },
    });
    await prisma.scheduledShift.deleteMany({
      where: { note: { contains: marker } },
    });
  }

  const periods = await prisma.schedulePeriod.findMany({
    where: { name: SCHEDULE_PERIOD_NAME },
    select: { id: true },
  });
  counts.schedulePeriods = periods.length;
  if (!dryRun) {
    for (const period of periods) {
      const remaining = await prisma.scheduledShift.count({
        where: { schedulePeriodId: period.id },
      });
      if (remaining === 0) {
        await prisma.scheduleChangeLog.deleteMany({
          where: { schedulePeriodId: period.id },
        });
        await prisma.schedulePeriod.delete({ where: { id: period.id } });
      }
    }
  }

  return counts;
}
