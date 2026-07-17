const generateActiveHrStatuses = ["ACTIVE", "PROBATION"] as const;

export type GenerateFromDefaultsPlan = {
  jobs: Array<{
    employeeId: string;
    shiftTemplateId: string;
    dateKey: string;
  }>;
  skippedNoDefault: number;
  skippedInactive: number;
  skippedExisting: number;
  skippedInactiveTemplate: number;
};

/** Pure planner: Employee.defaultShiftTemplateId → ScheduledShift jobs (no overwrite). */
export function planGenerateFromDefaultShifts(input: {
  dateKeys: string[];
  employees: Array<{
    id: string;
    isActive: boolean;
    hrStatus: string;
    defaultShiftTemplateId: string | null;
  }>;
  activeTemplateIds: ReadonlySet<string>;
  /** `${employeeId}|${dateKey}` for days that already have an active ScheduledShift */
  existingEmployeeDateKeys: ReadonlySet<string>;
}): GenerateFromDefaultsPlan {
  let skippedNoDefault = 0;
  let skippedInactive = 0;
  let skippedExisting = 0;
  let skippedInactiveTemplate = 0;
  const jobs: GenerateFromDefaultsPlan["jobs"] = [];

  for (const employee of input.employees) {
    const statusOk = generateActiveHrStatuses.includes(
      employee.hrStatus as (typeof generateActiveHrStatuses)[number],
    );
    if (!employee.isActive || !statusOk) {
      skippedInactive += 1;
      continue;
    }
    if (!employee.defaultShiftTemplateId) {
      skippedNoDefault += 1;
      continue;
    }
    if (!input.activeTemplateIds.has(employee.defaultShiftTemplateId)) {
      skippedInactiveTemplate += 1;
      continue;
    }

    for (const dateKey of input.dateKeys) {
      const existingKey = `${employee.id}|${dateKey}`;
      if (input.existingEmployeeDateKeys.has(existingKey)) {
        skippedExisting += 1;
        continue;
      }
      jobs.push({
        employeeId: employee.id,
        shiftTemplateId: employee.defaultShiftTemplateId,
        dateKey,
      });
    }
  }

  return {
    jobs,
    skippedNoDefault,
    skippedInactive,
    skippedExisting,
    skippedInactiveTemplate,
  };
}

export { generateActiveHrStatuses };
