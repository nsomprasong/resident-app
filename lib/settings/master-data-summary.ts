type ActiveRecord = {
  isActive?: boolean;
  status?: string;
};

export function countActiveRecords<T extends ActiveRecord>(
  records: readonly T[],
  activeStatuses: readonly string[] = ["AVAILABLE"],
) {
  return records.reduce(
    (summary, record) => {
      const active =
        record.isActive ?? (record.status ? activeStatuses.includes(record.status) : true);

      if (active) {
        return { ...summary, active: summary.active + 1 };
      }

      return { ...summary, inactive: summary.inactive + 1 };
    },
    { active: 0, inactive: 0 },
  );
}
