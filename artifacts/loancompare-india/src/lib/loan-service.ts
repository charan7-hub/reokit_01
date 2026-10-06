import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LoanType = "Personal" | "Car" | "Housing" | "Education";

export interface Bank {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface LoanProduct {
  id: string;
  bank_id: string;
  loan_type: LoanType;
  min_interest_rate: number;
  max_interest_rate: number;
  max_tenure_months: number;
  max_loan_amount: number;
  processing_fee_desc: string | null;
  features: string[];
  bank: Bank;
}

export interface LoanApplicationInput {
  user_name: string;
  email: string;
  phone: string;
  loan_product_id: string;
  requested_amount: number;
  tenure_months: number;
  estimated_emi: number;
}

let supabase: SupabaseClient | undefined;

function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error(
      "Supabase project URL is missing. Add VITE_SUPABASE_URL to the project secrets.",
    );
  }
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error();
    }
  } catch {
    throw new Error(
      "VITE_SUPABASE_URL must be your full Supabase project URL, such as https://your-project-ref.supabase.co. Update it in the project secrets.",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Supabase anon key is missing. Add VITE_SUPABASE_ANON_KEY to the project secrets.",
    );
  }

  supabase = createClient(url, anonKey);
  return supabase;
}

export async function fetchLoanProducts(
  loanType: LoanType,
): Promise<LoanProduct[]> {
  const { data, error } = await getSupabaseClient()
    .from("loan_products")
    .select(
      "id, bank_id, loan_type, min_interest_rate, max_interest_rate, max_tenure_months, max_loan_amount, processing_fee_desc, features, bank:banks!inner(id, name, logo_url)",
    )
    .eq("loan_type", loanType)
    .order("min_interest_rate", { ascending: true });

  if (error) {
    throw new Error(
      `Could not load loan products from Supabase: ${error.message}. Run supabase/setup.sql if the tables are not set up yet.`,
    );
  }

  return (data ?? []) as unknown as LoanProduct[];
}

export async function submitLoanApplication(
  input: LoanApplicationInput,
): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc(
    "submit_loan_application",
    {
      p_user_name: input.user_name.trim(),
      p_email: input.email.trim(),
      p_phone: input.phone.trim(),
      p_loan_product_id: input.loan_product_id,
      p_requested_amount: input.requested_amount,
      p_tenure_months: input.tenure_months,
    },
  );

  if (error) {
    throw new Error(`Could not submit your application: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error("Supabase did not return an application reference.");
  }

  return { id: data };
}

export function calculateEmi(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const monthlyRate = annualInterestRate / 1200;
  if (monthlyRate === 0) return principal / tenureMonths;

  const growth = Math.pow(1 + monthlyRate, tenureMonths);
  return (principal * monthlyRate * growth) / (growth - 1);
}
