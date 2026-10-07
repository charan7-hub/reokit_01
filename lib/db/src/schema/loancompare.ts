import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const banksTable = pgTable("banks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loanProductsTable = pgTable(
  "loan_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banksTable.id, { onDelete: "cascade" }),
    loanType: text("loan_type").notNull(),
    minInterestRate: numeric("min_interest_rate", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    maxInterestRate: numeric("max_interest_rate", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    maxTenureMonths: integer("max_tenure_months").notNull(),
    maxLoanAmount: bigint("max_loan_amount", { mode: "number" }).notNull(),
    processingFeeDesc: text("processing_fee_desc"),
    features: text("features")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("loan_products_bank_type_unique").on(table.bankId, table.loanType),
    check(
      "loan_products_rate_range_check",
      sql`${table.minInterestRate} <= ${table.maxInterestRate}`,
    ),
    check(
      "loan_products_type_check",
      sql`${table.loanType} in ('Personal', 'Car', 'Housing', 'Education')`,
    ),
    index("loan_products_type_rate_idx").on(
      table.loanType,
      table.minInterestRate,
    ),
  ],
);

export const loanApplicationsTable = pgTable(
  "loan_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userName: text("user_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    loanProductId: uuid("loan_product_id")
      .notNull()
      .references(() => loanProductsTable.id, { onDelete: "restrict" }),
    requestedAmount: numeric("requested_amount", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    tenureMonths: integer("tenure_months").notNull(),
    estimatedEmi: numeric("estimated_emi", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    status: text("status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "loan_applications_amount_positive_check",
      sql`${table.requestedAmount} > 0`,
    ),
    check(
      "loan_applications_tenure_positive_check",
      sql`${table.tenureMonths} > 0`,
    ),
    index("loan_applications_created_at_idx").on(table.createdAt),
  ],
);

export const insertBankSchema = createInsertSchema(banksTable).omit({
  id: true,
  createdAt: true,
});
export const insertLoanProductSchema = createInsertSchema(
  loanProductsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLoanApplicationSchema = createInsertSchema(
  loanApplicationsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertBank = z.infer<typeof insertBankSchema>;
export type Bank = typeof banksTable.$inferSelect;
export type InsertLoanProduct = z.infer<typeof insertLoanProductSchema>;
export type LoanProductRecord = typeof loanProductsTable.$inferSelect;
export type InsertLoanApplication = z.infer<
  typeof insertLoanApplicationSchema
>;
export type LoanApplicationRecord = typeof loanApplicationsTable.$inferSelect;
