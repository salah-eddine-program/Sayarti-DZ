import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  documents,
  expenses,
  fuelLogs,
  maintenance,
  type InsertUser,
  users,
  vehicles,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId && ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function updateUserSettings(
  userId: number,
  values: { language?: "ar" | "fr" | "en"; theme?: "light" | "dark"; profileLink?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set(values).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getAppData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [user, userVehicles, userMaintenance, userExpenses, userFuel, userDocuments] = await Promise.all([
    getUserById(userId),
    db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.updatedAt)),
    db.select().from(maintenance).where(eq(maintenance.userId, userId)).orderBy(desc(maintenance.serviceDate)),
    db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.expenseDate)),
    db.select().from(fuelLogs).where(eq(fuelLogs.userId, userId)).orderBy(desc(fuelLogs.fuelDate)),
    db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.expiresOn)),
  ]);
  return { user, vehicles: userVehicles, maintenance: userMaintenance, expenses: userExpenses, fuel: userFuel, documents: userDocuments };
}

async function verifyVehicle(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, vehicleId: number) {
  const result = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId))).limit(1);
  if (!result[0]) throw new Error("Vehicle not found");
}

export async function createVehicle(userId: number, value: Omit<typeof vehicles.$inferInsert, "userId">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(vehicles).values({ ...value, userId }).$returningId();
  return result[0]?.id;
}

export async function updateVehicle(userId: number, vehicleId: number, value: Partial<typeof vehicles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await verifyVehicle(db, userId, vehicleId);
  await db.update(vehicles).set(value).where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)));
}

export async function createMaintenance(userId: number, value: Omit<typeof maintenance.$inferInsert, "userId" | "serviceDate"> & { serviceDate: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await verifyVehicle(db, userId, value.vehicleId);
  await db.insert(maintenance).values({ ...value, userId, serviceDate: new Date(value.serviceDate) });
}

export async function createExpense(userId: number, value: Omit<typeof expenses.$inferInsert, "userId" | "expenseDate"> & { expenseDate: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await verifyVehicle(db, userId, value.vehicleId);
  await db.insert(expenses).values({ ...value, userId, expenseDate: new Date(value.expenseDate) });
}

export async function createFuel(userId: number, value: Omit<typeof fuelLogs.$inferInsert, "userId" | "fuelDate"> & { fuelDate: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await verifyVehicle(db, userId, value.vehicleId);
  await db.insert(fuelLogs).values({ ...value, userId, fuelDate: new Date(value.fuelDate) });
}

export async function createDocument(userId: number, value: Omit<typeof documents.$inferInsert, "userId" | "expiresOn"> & { expiresOn?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await verifyVehicle(db, userId, value.vehicleId);
  await db.insert(documents).values({ ...value, userId, expiresOn: value.expiresOn ? new Date(value.expiresOn) : null });
}
