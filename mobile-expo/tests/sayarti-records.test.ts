import { describe, expect, it } from "vitest";

import { initialExpenses, initialFuel, initialMaintenance } from "../lib/sayarti/demo-data";
import {
  getDueReminders,
  isInCalendarMonth,
  isInCalendarYear,
  makeReminderKey,
  parseRecordDate,
  parseRecordsSnapshot,
  reminderDateAfter,
  removeSnapshotRecord,
} from "../lib/sayarti/records";

describe("Sayarti record storage", () => {
  it("parses Algerian day-first dates and computes monthly and yearly totals", () => {
    const sampleDate = parseRecordDate("06/11/2026");
    expect(sampleDate?.getFullYear()).toBe(2026);
    expect(sampleDate?.getMonth()).toBe(10);
    expect(sampleDate?.getDate()).toBe(6);
    expect(parseRecordDate("31/02/2026")).toBeNull();

    const reference = new Date(2026, 10, 6);
    expect(isInCalendarMonth("04/11/2026", reference)).toBe(true);
    expect(isInCalendarMonth("18/02/2026", reference)).toBe(false);
    expect(isInCalendarYear("18/02/2026", reference)).toBe(true);
    expect(isInCalendarYear("18/02/2025", reference)).toBe(false);

    const currentMonthTotal = initialExpenses
      .filter((item) => isInCalendarMonth(item.date, reference))
      .reduce((sum, item) => sum + item.amount, 0);
    const annualTotal = initialExpenses
      .filter((item) => isInCalendarYear(item.date, reference))
      .reduce((sum, item) => sum + item.amount, 0);
    expect(currentMonthTotal).toBe(8450);
    expect(annualTotal).toBe(87400);
    expect(initialExpenses.find((item) => item.linkedId === initialFuel[0]?.id)?.amount)
      .toBe(initialFuel[0]?.amount);
  });

  it("restores the sample lists when storage is empty or malformed", () => {
    expect(parseRecordsSnapshot(null).maintenanceRecords).toEqual(initialMaintenance);
    expect(parseRecordsSnapshot("not-json").expenses).toEqual(initialExpenses);
  });

  it("preserves intentional empty lists and assigns stable IDs to migrated rows", () => {
    const result = parseRecordsSnapshot(
      JSON.stringify({
        maintenanceRecords: [{ title: "Brake pads", mileage: "180000 km", date: "01/11/2026", cost: 2500 }],
        expenses: [],
        fuelRecords: [],
        documentsList: [],
        servicePlans: [],
        reminders: [],
      }),
    );
    expect(result.maintenanceRecords[0]?.id).toBe("maintenance-migrated-1");
    expect(result.expenses).toEqual([]);
  });

  it("builds supported reminder dates and rejects unknown intervals", () => {
    expect(reminderDateAfter(1, 0)).toBe("1970-01-02T00:00:00.000Z");
    expect(reminderDateAfter(30, 0)).toBe("1970-01-31T00:00:00.000Z");
    expect(() => reminderDateAfter(2, 0)).toThrow(RangeError);
  });

  it("selects only due reminders that have not already been surfaced", () => {
    const dueAt = Date.parse("2026-11-06T11:00:00.000Z");
    const items = [
      {
        key: "fuel:fuel-1",
        kind: "fuel" as const,
        recordId: "fuel-1",
        title: "Fuel",
        scheduledAt: "2026-11-06T10:00:00.000Z",
      },
      {
        key: "document:doc-1",
        kind: "document" as const,
        recordId: "doc-1",
        title: "Insurance",
        scheduledAt: "2026-11-06T09:00:00.000Z",
        triggeredAt: "2026-11-06T09:01:00.000Z",
      },
      {
        key: "maintenance:service-1",
        kind: "maintenance" as const,
        recordId: "service-1",
        title: "Oil change",
        scheduledAt: "2026-11-06T12:00:00.000Z",
      },
    ];
    expect(getDueReminders(items, dueAt).map((item) => item.key)).toEqual([
      "fuel:fuel-1",
    ]);
  });

  it("removes a linked expense and its reminder when a maintenance item is deleted", () => {
    const base = parseRecordsSnapshot(null);
    const snapshot = {
      ...base,
      expenses: [
        { ...base.expenses[0]!, linkedKind: "maintenance" as const, linkedId: "service-oil-2026" },
      ],
      reminders: [
        {
          key: makeReminderKey("maintenance", "service-oil-2026"),
          kind: "maintenance" as const,
          recordId: "service-oil-2026",
          title: "Oil change",
          scheduledAt: "2026-11-07T00:00:00.000Z",
        },
      ],
    };
    const result = removeSnapshotRecord(snapshot, "maintenance", "service-oil-2026");
    expect(result.maintenanceRecords).toHaveLength(0);
    expect(result.expenses).toHaveLength(0);
    expect(result.reminders).toHaveLength(0);
  });

  it("removes a linked fuel expense and reminder when a fill-up is deleted", () => {
    const base = parseRecordsSnapshot(null);
    const snapshot = {
      ...base,
      reminders: [
        {
          key: makeReminderKey("fuel", "fuel-fill-2026"),
          kind: "fuel" as const,
          recordId: "fuel-fill-2026",
          title: "Fuel",
          scheduledAt: "2026-11-07T00:00:00.000Z",
        },
      ],
    };
    const result = removeSnapshotRecord(snapshot, "fuel", "fuel-fill-2026");
    expect(result.fuelRecords).toHaveLength(0);
    expect(result.expenses.some((item) => item.linkedId === "fuel-fill-2026")).toBe(false);
    expect(result.reminders).toHaveLength(0);
  });
});
