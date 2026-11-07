export type MaintenanceItem = {
  id: string;
  title: string;
  mileage: string;
  date: string;
  cost: number;
  note?: string;
};

export type ExpenseItem = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  linkedKind?: "maintenance" | "fuel";
  linkedId?: string;
};

export type FuelItem = {
  id: string;
  amount: number;
  liters: number;
  pricePerLiter: number;
  mileage: number;
  date: string;
};

export type DocumentItem = {
  id: string;
  title: string;
  expiry: string;
  status: "valid" | "soon" | "stored";
};

export type ServicePlanItem = {
  id: string;
  title: string;
  remainingKm: number;
};

export const initialMaintenance: MaintenanceItem[] = [
  {
    id: "service-oil-2026",
    title: "Oil change",
    mileage: "185,200 km",
    date: "04/11/2026",
    cost: 5500,
    note: "Oil and filters changed",
  },
];

export const initialExpenses: ExpenseItem[] = [
  {
    id: "expense-oil-2026",
    title: "Oil change",
    category: "Service",
    amount: 5500,
    date: "04/11/2026",
    linkedKind: "maintenance",
    linkedId: "service-oil-2026",
  },
  {
    id: "expense-fuel-2026",
    title: "Fuel",
    category: "Fuel",
    amount: 2500,
    date: "06/11/2026",
    linkedKind: "fuel",
    linkedId: "fuel-fill-2026",
  },
  { id: "expense-other-2026", title: "Other", category: "Other", amount: 450, date: "02/11/2026" },
  { id: "expense-feb-2026", title: "Routine maintenance", category: "Service", amount: 25000, date: "18/02/2026" },
  { id: "expense-apr-2026", title: "Fuel and road costs", category: "Fuel", amount: 18000, date: "15/04/2026" },
  { id: "expense-jul-2026", title: "Parts", category: "Parts", amount: 20000, date: "22/07/2026" },
  { id: "expense-sep-2026", title: "Other vehicle costs", category: "Other", amount: 15950, date: "09/09/2026" },
];

export const initialFuel: FuelItem[] = [
  {
    id: "fuel-fill-2026",
    amount: 2500,
    liters: 38,
    pricePerLiter: 65.8,
    mileage: 184900,
    date: "06/11/2026",
  },
];

export const initialDocuments: DocumentItem[] = [
  { id: "document-insurance", title: "Insurance", expiry: "20/11/2026", status: "soon" },
  { id: "document-technical-check", title: "Technical inspection", expiry: "15/03/2027", status: "valid" },
  { id: "document-registration", title: "Registration card", expiry: "—", status: "stored" },
  { id: "document-license", title: "Driving licence", expiry: "12/08/2030", status: "valid" },
];

export const initialServicePlans: ServicePlanItem[] = [
  { id: "plan-oil-change", title: "Oil change", remainingKm: 1200 },
  { id: "plan-air-filter", title: "Air filter", remainingKm: 5000 },
  { id: "plan-tire-check", title: "Tire check", remainingKm: 3000 },
];
