import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User as AuthUser } from "@supabase/supabase-js";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./_core/supabase", () => ({ getSupabaseAdmin: () => ({ from }) }));
import * as db from "./db";

const owner = "00000000-0000-4000-8000-000000000001";

function query(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const builder: Record<string, any> = {};
  for (const method of ["select", "eq", "order", "insert", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: unknown) => void, reject?: (error: unknown) => void) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

beforeEach(() => from.mockReset());

describe("Supabase database ownership", () => {
  it("upserts verified identity without trusting role or plan metadata", async () => {
    const row = { id: 1, auth_user_id: owner, role: "user", language: "fr" };
    const q = query(row);
    from.mockReturnValue(q);
    const result = await db.upsertUser({ id: owner, email: "user@example.com", user_metadata: { name: "Name", role: "admin", plan: "premium" } } as unknown as AuthUser);
    expect(from).toHaveBeenCalledWith("app_users");
    const values = q.upsert.mock.calls[0][0];
    expect(values).toMatchObject({ auth_user_id: owner, name: "Name", email: "user@example.com", login_method: "email" });
    for (const field of ["role", "plan", "language", "theme"]) expect(values).not.toHaveProperty(field);
    expect(q.upsert.mock.calls[0][1]).toEqual({ onConflict: "auth_user_id" });
    expect(result).toEqual({ id: 1, authUserId: owner, role: "user", language: "fr" });
  });
  it("filters every app data table by authenticated UUID and preserves date-only values", async () => {
    const tables = new Map([
      ["app_users", query({ id: 1, auth_user_id: owner })],
      ["vehicles", query([{ id: 2, auth_user_id: owner, fuel_type: "diesel", updated_at: "2026-10-09T00:00:00Z" }])],
      ["maintenance", query([{ id: 3, vehicle_id: 2, service_date: "2026-10-08", invoice_url: null }])],
      ["expenses", query([{ expense_date: "2026-10-07" }])],
      ["fuel_logs", query([{ fuel_date: "2026-10-06", price_per_liter: 6500 }])],
      ["documents", query([{ expires_on: null, file_url: "https://example.com/doc" }])],
    ]);
    from.mockImplementation((table: string) => tables.get(table));
    const result = await db.getAppData(owner);
    expect(from.mock.calls.map(call => call[0])).toEqual(["app_users", "vehicles", "maintenance", "expenses", "fuel_logs", "documents"]);
    for (const q of tables.values()) expect(q.eq).toHaveBeenCalledWith("auth_user_id", owner);
    expect(result.vehicles[0]).toMatchObject({ fuelType: "diesel", authUserId: owner });
    expect(result.maintenance[0]).toMatchObject({ vehicleId: 2, serviceDate: "2026-10-08", invoiceUrl: null });
    expect(result.fuel[0]).toMatchObject({ fuelDate: "2026-10-06", pricePerLiter: 6500 });
    expect(result.documents[0]).toMatchObject({ expiresOn: null, fileUrl: "https://example.com/doc" });
  });
  it("limits profile updates to settings and the trusted UUID", async () => {
    const q = query({ id: 1, auth_user_id: owner, profile_link: null });
    from.mockReturnValue(q);
    await db.updateUserSettings(owner, { language: "fr", theme: "dark", profileLink: null, role: "admin" } as any);
    expect(q.update.mock.calls[0][0]).toMatchObject({ language: "fr", theme: "dark", profile_link: null });
    expect(q.update.mock.calls[0][0]).not.toHaveProperty("role");
    expect(q.eq).toHaveBeenCalledWith("auth_user_id", owner);
  });
  it("uses the trusted owner on vehicle creation even if extra ownership fields are passed", async () => {
    const q = query({ id: 42 });
    from.mockReturnValue(q);
    expect(await db.createVehicle(owner, { brand: "Renault", model: "Clio", year: 2020, fuelType: "diesel", mileage: 0, auth_user_id: "attacker", authUserId: "attacker" } as any)).toBe(42);
    expect(q.insert.mock.calls[0][0]).toEqual({ auth_user_id: owner, brand: "Renault", model: "Clio", year: 2020, fuel_type: "diesel", mileage: 0, plate_number: null });
  });
  it("filters vehicle updates by both vehicle ID and owner", async () => {
    const verification = query({ id: 2 });
    const update = query({ id: 2 });
    from.mockReturnValueOnce(verification).mockReturnValueOnce(update);
    await db.updateVehicle(owner, 2, { mileage: 100, plateNumber: null, auth_user_id: "attacker" } as any);
    for (const q of [verification, update]) {
      expect(q.eq).toHaveBeenCalledWith("auth_user_id", owner);
      expect(q.eq).toHaveBeenCalledWith("id", 2);
    }
    expect(update.update.mock.calls[0][0]).toMatchObject({ mileage: 100, plate_number: null });
    expect(update.update.mock.calls[0][0]).not.toHaveProperty("auth_user_id");
  });
  const childWrites = [
    ["maintenance", () => db.createMaintenance(owner, { vehicleId: 2, title: "Oil", serviceDate: "2026-10-08", mileage: 100, cost: 500 })],
    ["expenses", () => db.createExpense(owner, { vehicleId: 2, title: "Parts", category: "parts", amount: 100, expenseDate: "2026-10-08" })],
    ["fuel_logs", () => db.createFuel(owner, { vehicleId: 2, amount: 100, liters: 2, pricePerLiter: 5000, mileage: 100, fuelDate: "2026-10-08" })],
    ["documents", () => db.createDocument(owner, { vehicleId: 2, title: "Insurance" })],
  ] as const;
  it.each(childWrites)("verifies vehicle ownership before inserting %s", async (table, write) => {
    const verification = query({ id: 2 });
    const insert = query();
    from.mockReturnValueOnce(verification).mockReturnValueOnce(insert);
    await write();
    expect(from.mock.calls.map(call => call[0])).toEqual(["vehicles", table]);
    expect(verification.eq).toHaveBeenCalledWith("auth_user_id", owner);
    expect(verification.eq).toHaveBeenCalledWith("id", 2);
    expect(insert.insert.mock.calls[0][0]).toMatchObject({ auth_user_id: owner, vehicle_id: 2 });
  });
  it.each(childWrites)("blocks a cross-account vehicle reference for %s", async (_table, write) => {
    const verification = query(null);
    from.mockReturnValue(verification);
    await expect(write()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(from).toHaveBeenCalledTimes(1);
    expect(verification.insert).not.toHaveBeenCalled();
  });
  it("returns a generic database error without leaking upstream details", async () => {
    from.mockReturnValue(query(null, { message: "private SQL details", code: "test" }));
    await expect(db.getUserByAuthId(owner)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Database operation failed." });
  });
});
