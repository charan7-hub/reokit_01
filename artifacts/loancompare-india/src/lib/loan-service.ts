import {
  listLoanProducts,
  submitLoanApplication as submitLoanApplicationRequest,
} from "@workspace/api-client-react";
import type {
  LoanApplicationInput,
  LoanApplicationReceipt,
  LoanProduct,
  LoanType,
} from "@workspace/api-client-react";

export type { LoanApplicationInput, LoanProduct, LoanType };

export async function fetchLoanProducts(
  loanType: LoanType,
): Promise<LoanProduct[]> {
  return listLoanProducts({ loanType });
}

export async function submitLoanApplication(
  input: LoanApplicationInput,
): Promise<LoanApplicationReceipt> {
  return submitLoanApplicationRequest({
    ...input,
    user_name: input.user_name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
  });
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
