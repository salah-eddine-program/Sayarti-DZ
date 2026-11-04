export type MaintenanceItem = {
  title: string;
  mileage: string;
  date: string;
  cost: number;
  note?: string;
};

export type ExpenseItem = {
  title: string;
  category: string;
  amount: number;
  date: string;
};

export type FuelItem = {
  amount: number;
  liters: number;
  pricePerLiter: number;
  mileage: number;
  date: string;
};

export type DocumentItem = {
  title: string;
  expiry: string;
  status: "valid" | "soon" | "stored";
};

export const initialMaintenance: MaintenanceItem[] = [
  { title: "Oil change", mileage: "185,200 km", date: "08/10/2026", cost: 6500, note: "Oil and filters changed" },
];

export const initialExpenses: ExpenseItem[] = [
  { title: "Oil change", category: "Service", amount: 6500, date: "08/10/2026" },
  { title: "Fuel", category: "Fuel", amount: 1500, date: "06/10/2026" },
  { title: "Other", category: "Other", amount: 450, date: "02/10/2026" },
];

export const initialFuel: FuelItem[] = [
  { amount: 2500, liters: 38, pricePerLiter: 65.8, mileage: 184900, date: "06/10/2026" },
];

export const initialDocuments: DocumentItem[] = [
  { title: "Insurance", expiry: "20/11/2026", status: "soon" },
  { title: "Technical inspection", expiry: "15/03/2027", status: "valid" },
  { title: "Registration card", expiry: "—", status: "stored" },
  { title: "Driving licence", expiry: "12/08/2030", status: "valid" },
];
