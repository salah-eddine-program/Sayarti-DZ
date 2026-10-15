import type { User as AuthUser } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import type {
  ApiRow, AppUserRow, Database, Document, Expense, FuelLog,
  Maintenance, User, Vehicle,
} from "@shared/types";
import { getSupabaseAdmin } from "./_core/supabase";

export function getDb() {
  return getSupabaseAdmin();
}

function databaseError(error: unknown): never {
  // Do not expose upstream details, credentials, or SQL to clients/log collectors.
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database operation failed.", cause: error });
}

function toApiRow<T extends object>(row: T): ApiRow<T> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()), value,
  ])) as ApiRow<T>;
}

export async function upsertUser(authUser: AuthUser): Promise<User> {
  const now = new Date().toISOString();
  const metadataName = authUser.user_metadata?.name ?? authUser.user_metadata?.full_name;
  const values: Database["public"]["Tables"]["app_users"]["Insert"] = {
    auth_user_id: authUser.id,
    open_id: authUser.id,
    email: authUser.email ?? null,
    name: typeof metadataName === "string" ? metadataName.slice(0, 200) : null,
    login_method: "email",
    last_signed_in: now,
    updated_at: now,
  };
  // Never trust user_metadata for role, plan, or ownership. Settings are preserved.
  const { data, error } = await getDb().from("app_users")
    .upsert(values, { onConflict: "auth_user_id" }).select().single();
  if (error || !data) databaseError(error);
  return toApiRow(data);
}

export async function getUserByAuthId(authUserId: string): Promise<User | undefined> {
  const { data, error } = await getDb().from("app_users")
    .select().eq("auth_user_id", authUserId).maybeSingle();
  if (error) databaseError(error);
  return data ? toApiRow(data) : undefined;
}

export async function updateUserSettings(
  authUserId: string,
  values: { name?: string | null; language?: User["language"]; theme?: User["theme"]; profileLink?: string | null },
) {
  const update: Partial<AppUserRow> = { updated_at: new Date().toISOString() };
  if (values.name !== undefined) update.name = values.name;
  if (values.language !== undefined) update.language = values.language;
  if (values.theme !== undefined) update.theme = values.theme;
  if (values.profileLink !== undefined) update.profile_link = values.profileLink;
  const { data, error } = await getDb().from("app_users")
    .update(update).eq("auth_user_id", authUserId).select().single();
  if (error || !data) databaseError(error);
  return toApiRow(data);
}

export async function getAppData(authUserId: string) {
  const db = getDb();
  const [user, vehicleResult, maintenanceResult, expenseResult, fuelResult, documentResult] = await Promise.all([
    getUserByAuthId(authUserId),
    db.from("vehicles").select().eq("auth_user_id", authUserId).order("updated_at", { ascending: false }),
    db.from("maintenance").select().eq("auth_user_id", authUserId).order("service_date", { ascending: false }),
    db.from("expenses").select().eq("auth_user_id", authUserId).order("expense_date", { ascending: false }),
    db.from("fuel_logs").select().eq("auth_user_id", authUserId).order("fuel_date", { ascending: false }),
    db.from("documents").select().eq("auth_user_id", authUserId).order("expires_on", { ascending: false, nullsFirst: false }),
  ]);
  for (const result of [vehicleResult, maintenanceResult, expenseResult, fuelResult, documentResult]) {
    if (result.error) databaseError(result.error);
  }
  return {
    user,
    vehicles: (vehicleResult.data ?? []).map(toApiRow),
    maintenance: (maintenanceResult.data ?? []).map(toApiRow),
    expenses: (expenseResult.data ?? []).map(toApiRow),
    fuel: (fuelResult.data ?? []).map(toApiRow),
    documents: (documentResult.data ?? []).map(toApiRow),
  };
}

async function verifyVehicle(authUserId: string, vehicleId: number) {
  const { data, error } = await getDb().from("vehicles").select("id")
    .eq("id", vehicleId).eq("auth_user_id", authUserId).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found." });
}

type VehicleInput = Pick<Vehicle, "brand" | "model" | "year" | "fuelType" | "mileage"> & { plateNumber?: string | null };

export async function createVehicle(authUserId: string, value: VehicleInput) {
  const { data, error } = await getDb().from("vehicles").insert({
    auth_user_id: authUserId,
    brand: value.brand, model: value.model, year: value.year,
    fuel_type: value.fuelType, mileage: value.mileage, plate_number: value.plateNumber ?? null,
  }).select("id").single();
  if (error || !data) databaseError(error);
  return data.id;
}

export async function updateVehicle(authUserId: string, vehicleId: number, value: Partial<VehicleInput>) {
  await verifyVehicle(authUserId, vehicleId);
  const update: Database["public"]["Tables"]["vehicles"]["Update"] = { updated_at: new Date().toISOString() };
  if (value.brand !== undefined) update.brand = value.brand;
  if (value.model !== undefined) update.model = value.model;
  if (value.year !== undefined) update.year = value.year;
  if (value.fuelType !== undefined) update.fuel_type = value.fuelType;
  if (value.mileage !== undefined) update.mileage = value.mileage;
  if (value.plateNumber !== undefined) update.plate_number = value.plateNumber;
  const { data, error } = await getDb().from("vehicles").update(update)
    .eq("id", vehicleId).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found." });
}

export async function createMaintenance(authUserId: string, value: Pick<Maintenance, "vehicleId" | "title" | "serviceDate" | "mileage" | "cost"> & { notes?: string; invoiceUrl?: string }) {
  await verifyVehicle(authUserId, value.vehicleId);
  const { error } = await getDb().from("maintenance").insert({
    auth_user_id: authUserId, vehicle_id: value.vehicleId, title: value.title,
    service_date: value.serviceDate, mileage: value.mileage, cost: value.cost,
    notes: value.notes ?? null, invoice_url: value.invoiceUrl ?? null,
  });
  if (error) databaseError(error);
}

export async function createExpense(authUserId: string, value: Pick<Expense, "vehicleId" | "title" | "category" | "amount" | "expenseDate">) {
  await verifyVehicle(authUserId, value.vehicleId);
  const { error } = await getDb().from("expenses").insert({
    auth_user_id: authUserId, vehicle_id: value.vehicleId, title: value.title,
    category: value.category, amount: value.amount, expense_date: value.expenseDate,
  });
  if (error) databaseError(error);
}

export async function createFuel(authUserId: string, value: Pick<FuelLog, "vehicleId" | "amount" | "liters" | "pricePerLiter" | "mileage" | "fuelDate">) {
  await verifyVehicle(authUserId, value.vehicleId);
  const { error } = await getDb().from("fuel_logs").insert({
    auth_user_id: authUserId, vehicle_id: value.vehicleId, amount: value.amount,
    liters: value.liters, price_per_liter: value.pricePerLiter,
    mileage: value.mileage, fuel_date: value.fuelDate,
  });
  if (error) databaseError(error);
}

export async function createDocument(authUserId: string, value: Pick<Document, "vehicleId" | "title"> & { category?: string; expiresOn?: string | null; fileUrl?: string }) {
  await verifyVehicle(authUserId, value.vehicleId);
  const { error } = await getDb().from("documents").insert({
    auth_user_id: authUserId, vehicle_id: value.vehicleId, title: value.title,
    category: value.category?.trim() || "other", expires_on: value.expiresOn ?? null, file_url: value.fileUrl ?? null,
  });
  if (error) databaseError(error);
}


export async function updateMaintenance(authUserId: string, id: number, value: { title: string; serviceDate: string; mileage: number; cost: number; notes?: string }) {
  const { data, error } = await getDb().from("maintenance").update({ title: value.title, service_date: value.serviceDate, mileage: value.mileage, cost: value.cost, notes: value.notes ?? null }).eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Maintenance record not found." });
}
export async function deleteMaintenance(authUserId: string, id: number) {
  const { data, error } = await getDb().from("maintenance").delete().eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Maintenance record not found." });
}
export async function updateExpense(authUserId: string, id: number, value: { title: string; category: Expense["category"]; amount: number; expenseDate: string }) {
  const { data, error } = await getDb().from("expenses").update({ title: value.title, category: value.category, amount: value.amount, expense_date: value.expenseDate }).eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
}
export async function deleteExpense(authUserId: string, id: number) {
  const { data, error } = await getDb().from("expenses").delete().eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
}
export async function updateFuel(authUserId: string, id: number, value: { amount: number; liters: number; pricePerLiter: number; mileage: number; fuelDate: string }) {
  const { data, error } = await getDb().from("fuel_logs").update({ amount: value.amount, liters: value.liters, price_per_liter: value.pricePerLiter, mileage: value.mileage, fuel_date: value.fuelDate }).eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Fuel record not found." });
}
export async function deleteFuel(authUserId: string, id: number) {
  const { data, error } = await getDb().from("fuel_logs").delete().eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Fuel record not found." });
}
export async function updateDocument(authUserId: string, id: number, value: { title: string; category?: string; expiresOn?: string | null; fileUrl?: string | null }) {
  const { data, error } = await getDb().from("documents").update({ title: value.title, category: value.category?.trim() || "other", expires_on: value.expiresOn ?? null, ...(value.fileUrl !== undefined ? { file_url: value.fileUrl } : {}) }).eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
}
export async function deleteDocument(authUserId: string, id: number) {
  const { data, error } = await getDb().from("documents").delete().eq("id", id).eq("auth_user_id", authUserId).select("id").maybeSingle();
  if (error) databaseError(error); if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
}
