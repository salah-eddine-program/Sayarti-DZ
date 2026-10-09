import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  language: mysqlEnum("language", ["ar", "fr", "en"]).default("ar").notNull(),
  theme: mysqlEnum("theme", ["light", "dark"]).default("light").notNull(),
  profileLink: varchar("profileLink", { length: 2048 }),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  premiumExpiresAt: timestamp("premiumExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    brand: varchar("brand", { length: 80 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    year: int("year").notNull(),
    fuelType: mysqlEnum("fuelType", ["diesel", "petrol", "lpg", "electric"]).notNull(),
    mileage: int("mileage").default(0).notNull(),
    plateNumber: varchar("plateNumber", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userIdx: index("vehicles_user_idx").on(table.userId) }),
);

export const maintenance = mysqlTable(
  "maintenance",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    vehicleId: int("vehicleId").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    serviceDate: date("serviceDate").notNull(),
    mileage: int("mileage").notNull(),
    cost: int("cost").default(0).notNull(),
    notes: text("notes"),
    invoiceUrl: varchar("invoiceUrl", { length: 2048 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ownerIdx: index("maintenance_owner_idx").on(table.userId, table.vehicleId) }),
);

export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    vehicleId: int("vehicleId").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    category: mysqlEnum("category", ["service", "fuel", "parts", "other"]).notNull(),
    amount: int("amount").default(0).notNull(),
    expenseDate: date("expenseDate").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ownerIdx: index("expenses_owner_idx").on(table.userId, table.vehicleId) }),
);

export const fuelLogs = mysqlTable(
  "fuelLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    vehicleId: int("vehicleId").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    amount: int("amount").default(0).notNull(),
    liters: int("liters").default(0).notNull(),
    pricePerLiter: int("pricePerLiter").default(0).notNull(),
    mileage: int("mileage").notNull(),
    fuelDate: date("fuelDate").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ownerIdx: index("fuel_owner_idx").on(table.userId, table.vehicleId) }),
);

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    vehicleId: int("vehicleId").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    expiresOn: date("expiresOn"),
    fileUrl: varchar("fileUrl", { length: 2048 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ownerIdx: index("documents_owner_idx").on(table.userId, table.vehicleId) }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type Maintenance = typeof maintenance.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type FuelLog = typeof fuelLogs.$inferSelect;
export type Document = typeof documents.$inferSelect;
