export * from "./_core/errors";

export type AppUserRow = {
  id: number; auth_user_id: string; open_id: string; name: string | null; email: string | null; login_method: string | null; role: "user" | "admin"; language: "ar" | "fr" | "en"; theme: "light" | "dark"; profile_link: string | null; plan: "free" | "premium"; premium_expires_at: string | null; created_at: string; updated_at: string; last_signed_in: string;
};
type OwnedRow = { id: number; auth_user_id: string; created_at: string };
export type VehicleRow = OwnedRow & { brand: string; model: string; year: number; fuel_type: "diesel" | "petrol" | "lpg" | "electric"; mileage: number; plate_number: string | null; updated_at: string };
export type MaintenanceRow = OwnedRow & { vehicle_id: number; title: string; service_date: string; mileage: number; cost: number; notes: string | null; invoice_url: string | null };
export type ExpenseRow = OwnedRow & { vehicle_id: number; title: string; category: "service" | "fuel" | "parts" | "other"; amount: number; expense_date: string };
export type FuelLogRow = OwnedRow & { vehicle_id: number; amount: number; liters: number; price_per_liter: number; mileage: number; fuel_date: string };
export type DocumentRow = OwnedRow & { vehicle_id: number; title: string; category: string; expires_on: string | null; file_url: string | null };
type Table<Row, Required extends keyof Row> = { Row: Row; Insert: Partial<Row> & Pick<Row, Required>; Update: Partial<Row>; Relationships: [] };
export type Database = { public: { Tables: { app_users: Table<AppUserRow, "auth_user_id">; vehicles: Table<VehicleRow, "auth_user_id" | "brand" | "model" | "year" | "fuel_type">; maintenance: Table<MaintenanceRow, "auth_user_id" | "vehicle_id" | "title" | "service_date" | "mileage">; expenses: Table<ExpenseRow, "auth_user_id" | "vehicle_id" | "title" | "category" | "expense_date">; fuel_logs: Table<FuelLogRow, "auth_user_id" | "vehicle_id" | "mileage" | "fuel_date">; documents: Table<DocumentRow, "auth_user_id" | "vehicle_id" | "title"> }; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };
type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<CamelCase<Tail>>}` : S;
export type ApiRow<T> = { [K in keyof T as K extends string ? CamelCase<K> : K]: T[K] };
export type User = ApiRow<AppUserRow>; export type Vehicle = ApiRow<VehicleRow>; export type Maintenance = ApiRow<MaintenanceRow>; export type Expense = ApiRow<ExpenseRow>; export type FuelLog = ApiRow<FuelLogRow>; export type Document = ApiRow<DocumentRow>;
