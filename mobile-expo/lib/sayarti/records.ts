import {
  initialDocuments,
  initialExpenses,
  initialFuel,
  initialMaintenance,
  initialServicePlans,
  type DocumentItem,
  type ExpenseItem,
  type FuelItem,
  type MaintenanceItem,
  type ServicePlanItem,
} from "./demo-data";

export const reminderIntervals = [1, 3, 7, 30] as const;
export type ReminderDays = (typeof reminderIntervals)[number];
export type RecordKind =
  | "maintenance"
  | "expense"
  | "fuel"
  | "document"
  | "servicePlan";

export type ScheduledReminder = {
  key: string;
  kind: RecordKind;
  recordId: string;
  title: string;
  scheduledAt: string;
  notificationId?: string;
  triggeredAt?: string;
};

export type RecordsSnapshot = {
  maintenanceRecords: MaintenanceItem[];
  expenses: ExpenseItem[];
  fuelRecords: FuelItem[];
  documentsList: DocumentItem[];
  servicePlans: ServicePlanItem[];
  reminders: ScheduledReminder[];
};

const recordKinds: readonly RecordKind[] = [
  "maintenance",
  "expense",
  "fuel",
  "document",
  "servicePlan",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const withStableIds = <T extends { id?: unknown }>(
  value: unknown,
  fallback: T[],
  prefix: string,
  isValid: (item: Record<string, unknown>) => boolean,
): Array<T & { id: string }> => {
  if (!Array.isArray(value)) {
    return fallback.map((item, index) => ({ ...item, id: String(item.id ?? `${prefix}-${index + 1}`) }));
  }
  return value.filter(isObject).filter(isValid).map((item, index) => ({
    ...item,
    id: isString(item.id) && item.id.trim() ? item.id : `${prefix}-migrated-${index + 1}`,
  })) as Array<T & { id: string }>;
};

export const makeRecordId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const makeReminderKey = (kind: RecordKind, recordId: string): string =>
  `${kind}:${recordId}`;

export const parseRecordDate = (value: string): Date | null => {
  const trimmed = value.trim();
  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
      ? date
      : null;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
      ? date
      : null;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

export const isInCalendarMonth = (
  value: string,
  referenceDate: Date,
): boolean => {
  const date = parseRecordDate(value);
  return !!date &&
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth();
};

export const isInCalendarYear = (
  value: string,
  referenceDate: Date,
): boolean => {
  const date = parseRecordDate(value);
  return !!date && date.getFullYear() === referenceDate.getFullYear();
};

export const getDueReminders = (
  reminders: ScheduledReminder[],
  now = Date.now(),
): ScheduledReminder[] =>
  reminders.filter(
    (reminder) =>
      !reminder.triggeredAt && Date.parse(reminder.scheduledAt) <= now,
  );

export const reminderDateAfter = (days: number, now = Date.now()): string => {
  if (!reminderIntervals.includes(days as ReminderDays)) {
    throw new RangeError("Unsupported reminder interval");
  }
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
};

export const parseRecordsSnapshot = (raw: string | null): RecordsSnapshot => {
  const defaults: RecordsSnapshot = {
    maintenanceRecords: initialMaintenance,
    expenses: initialExpenses,
    fuelRecords: initialFuel,
    documentsList: initialDocuments,
    servicePlans: initialServicePlans,
    reminders: [],
  };
  if (!raw) return defaults;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!isObject(parsed)) return defaults;

  const maintenanceRecords = withStableIds<MaintenanceItem>(
    parsed.maintenanceRecords,
    initialMaintenance,
    "maintenance",
    (item) =>
      isString(item.title) &&
      isString(item.mileage) &&
      isString(item.date) &&
      isFiniteNumber(item.cost),
  );
  const expenses = withStableIds<ExpenseItem>(
    parsed.expenses,
    initialExpenses,
    "expense",
    (item) =>
      isString(item.title) &&
      isString(item.category) &&
      isFiniteNumber(item.amount) &&
      isString(item.date),
  );
  const fuelRecords = withStableIds<FuelItem>(
    parsed.fuelRecords,
    initialFuel,
    "fuel",
    (item) =>
      isFiniteNumber(item.amount) &&
      isFiniteNumber(item.liters) &&
      isFiniteNumber(item.pricePerLiter) &&
      isFiniteNumber(item.mileage) &&
      isString(item.date),
  );
  const documentsList = withStableIds<DocumentItem>(
    parsed.documentsList,
    initialDocuments,
    "document",
    (item) =>
      isString(item.title) &&
      isString(item.expiry) &&
      (item.status === "valid" || item.status === "soon" || item.status === "stored"),
  );
  const servicePlans = withStableIds<ServicePlanItem>(
    parsed.servicePlans,
    initialServicePlans,
    "service-plan",
    (item) => isString(item.title) && isFiniteNumber(item.remainingKm),
  );
  const reminders = Array.isArray(parsed.reminders)
    ? parsed.reminders.filter(isObject).filter((item) =>
        isString(item.key) &&
        recordKinds.includes(item.kind as RecordKind) &&
        isString(item.recordId) &&
        isString(item.title) &&
        isString(item.scheduledAt) &&
        Number.isFinite(Date.parse(item.scheduledAt)),
      ) as unknown as ScheduledReminder[]
    : [];

  return {
    maintenanceRecords,
    expenses,
    fuelRecords,
    documentsList,
    servicePlans,
    reminders,
  };
};

export const removeSnapshotRecord = (
  snapshot: RecordsSnapshot,
  kind: RecordKind,
  recordId: string,
): RecordsSnapshot => ({
  maintenanceRecords:
    kind === "maintenance"
      ? snapshot.maintenanceRecords.filter((item) => item.id !== recordId)
      : snapshot.maintenanceRecords,
  expenses:
    kind === "expense"
      ? snapshot.expenses.filter((item) => item.id !== recordId)
      : snapshot.expenses.filter(
          (item) => !(item.linkedKind === kind && item.linkedId === recordId),
        ),
  fuelRecords:
    kind === "fuel"
      ? snapshot.fuelRecords.filter((item) => item.id !== recordId)
      : snapshot.fuelRecords,
  documentsList:
    kind === "document"
      ? snapshot.documentsList.filter((item) => item.id !== recordId)
      : snapshot.documentsList,
  servicePlans:
    kind === "servicePlan"
      ? snapshot.servicePlans.filter((item) => item.id !== recordId)
      : snapshot.servicePlans,
  reminders: snapshot.reminders.filter(
    (reminder) => reminder.key !== makeReminderKey(kind, recordId),
  ),
});
