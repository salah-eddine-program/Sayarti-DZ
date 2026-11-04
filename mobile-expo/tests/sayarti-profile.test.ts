import { describe, expect, it } from "vitest";

import {
  parseAccountProfile,
  validateAccountProfile,
  type AccountProfile,
} from "../lib/sayarti/profile";

const validProfile: AccountProfile = {
  firstName: "سارة",
  lastName: "بن علي",
  vehicle: {
    brand: "Renault",
    model: "Clio 4",
    year: "2018",
    fuel: "diesel",
    mileage: "185200",
  },
};

describe("local account profile", () => {
  it("accepts a complete name and vehicle profile", () => {
    expect(validateAccountProfile(validProfile)).toBeNull();
  });

  it("requires the user's names and every vehicle field", () => {
    expect(
      validateAccountProfile({
        ...validProfile,
        firstName: " ",
      }),
    ).toBe("requiredFields");
  });

  it("requires a four-digit supported vehicle year", () => {
    expect(
      validateAccountProfile({
        ...validProfile,
        vehicle: { ...validProfile.vehicle, year: "18" },
      }),
    ).toBe("invalidYear");
  });

  it("requires a non-negative whole-kilometre odometer", () => {
    expect(
      validateAccountProfile({
        ...validProfile,
        vehicle: { ...validProfile.vehicle, mileage: "185.2" },
      }),
    ).toBe("invalidMileage");
  });

  it("restores only valid saved profiles", () => {
    expect(parseAccountProfile(JSON.stringify(validProfile))).toEqual(
      validProfile,
    );
    expect(parseAccountProfile("not-json")).toBeNull();
    expect(
      parseAccountProfile(
        JSON.stringify({
          ...validProfile,
          vehicle: { ...validProfile.vehicle, fuel: "unknown" },
        }),
      ),
    ).toBeNull();
  });
});
