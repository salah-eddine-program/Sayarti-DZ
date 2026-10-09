import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const vehicleId = z.number().int().positive();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  app: router({
    data: protectedProcedure.query(({ ctx }) => db.getAppData(ctx.user.id)),
    settings: protectedProcedure
      .input(z.object({
        language: z.enum(["ar", "fr", "en"]).optional(),
        theme: z.enum(["light", "dark"]).optional(),
        profileLink: z.string().url().max(2048).nullable().optional(),
      }))
      .mutation(({ ctx, input }) => db.updateUserSettings(ctx.user.id, input)),
    vehicle: router({
      create: protectedProcedure
        .input(z.object({
          brand: z.string().trim().min(1).max(80),
          model: z.string().trim().min(1).max(80),
          year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
          fuelType: z.enum(["diesel", "petrol", "lpg", "electric"]),
          mileage: z.number().int().min(0).max(10_000_000),
          plateNumber: z.string().trim().max(32).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.createVehicle(ctx.user.id, input);
          return db.getAppData(ctx.user.id);
        }),
      update: protectedProcedure
        .input(z.object({
          id: vehicleId,
          brand: z.string().trim().min(1).max(80).optional(),
          model: z.string().trim().min(1).max(80).optional(),
          year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
          fuelType: z.enum(["diesel", "petrol", "lpg", "electric"]).optional(),
          mileage: z.number().int().min(0).max(10_000_000).optional(),
          plateNumber: z.string().trim().max(32).nullable().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { id, ...value } = input;
          await db.updateVehicle(ctx.user.id, id, value);
          return db.getAppData(ctx.user.id);
        }),
    }),
    maintenance: router({
      create: protectedProcedure
        .input(z.object({
          vehicleId,
          title: z.string().trim().min(1).max(160),
          serviceDate: dateValue,
          mileage: z.number().int().min(0).max(10_000_000),
          cost: z.number().int().min(0).max(100_000_000),
          notes: z.string().trim().max(4000).optional(),
          invoiceUrl: z.string().url().max(2048).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.createMaintenance(ctx.user.id, input);
          return db.getAppData(ctx.user.id);
        }),
    }),
    expense: router({
      create: protectedProcedure
        .input(z.object({
          vehicleId,
          title: z.string().trim().min(1).max(160),
          category: z.enum(["service", "fuel", "parts", "other"]),
          amount: z.number().int().min(0).max(100_000_000),
          expenseDate: dateValue,
        }))
        .mutation(async ({ ctx, input }) => {
          await db.createExpense(ctx.user.id, input);
          return db.getAppData(ctx.user.id);
        }),
    }),
    fuel: router({
      create: protectedProcedure
        .input(z.object({
          vehicleId,
          amount: z.number().int().min(0).max(100_000_000),
          liters: z.number().int().min(0).max(10_000),
          pricePerLiter: z.number().int().min(0).max(1_000_000),
          mileage: z.number().int().min(0).max(10_000_000),
          fuelDate: dateValue,
        }))
        .mutation(async ({ ctx, input }) => {
          await db.createFuel(ctx.user.id, input);
          return db.getAppData(ctx.user.id);
        }),
    }),
    document: router({
      create: protectedProcedure
        .input(z.object({
          vehicleId,
          title: z.string().trim().min(1).max(160),
          expiresOn: dateValue.nullable().optional(),
          fileUrl: z.string().url().max(2048).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await db.createDocument(ctx.user.id, input);
          return db.getAppData(ctx.user.id);
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
