export const vehicleFuelTypes = ["diesel", "petrol", "lpg"] as const;

export type VehicleFuel = (typeof vehicleFuelTypes)[number];

export type VehicleProfile = {
  brand: string;
  model: string;
  year: string;
  fuel: VehicleFuel;
  mileage: string;
};

export type AccountProfile = {
  firstName: string;
  lastName: string;
  vehicle: VehicleProfile;
};

export type ProfileValidationError =
  | "requiredFields"
  | "invalidYear"
  | "invalidMileage";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isVehicleFuel = (value: unknown): value is VehicleFuel =>
  typeof value === "string" &&
  (vehicleFuelTypes as readonly string[]).includes(value);

export function validateAccountProfile(
  profile: AccountProfile,
): ProfileValidationError | null {
  const { firstName, lastName, vehicle } = profile;
  if (
    !firstName.trim() ||
    !lastName.trim() ||
    !vehicle.brand.trim() ||
    !vehicle.model.trim() ||
    !vehicle.year.trim() ||
    !vehicle.mileage.trim() ||
    !isVehicleFuel(vehicle.fuel)
  ) {
    return "requiredFields";
  }

  const year = Number(vehicle.year);
  if (
    !/^\d{4}$/.test(vehicle.year) ||
    year < 1886 ||
    year > new Date().getFullYear() + 1
  ) {
    return "invalidYear";
  }

  if (!/^\d+$/.test(vehicle.mileage)) return "invalidMileage";
  return null;
}

export function parseAccountProfile(raw: string): AccountProfile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isRecord(parsed.vehicle)) return null;
  const vehicle = parsed.vehicle;
  if (
    typeof parsed.firstName !== "string" ||
    typeof parsed.lastName !== "string" ||
    typeof vehicle.brand !== "string" ||
    typeof vehicle.model !== "string" ||
    typeof vehicle.year !== "string" ||
    !isVehicleFuel(vehicle.fuel) ||
    typeof vehicle.mileage !== "string"
  ) {
    return null;
  }

  const profile: AccountProfile = {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      fuel: vehicle.fuel,
      mileage: vehicle.mileage,
    },
  };
  return validateAccountProfile(profile) ? null : profile;
}
