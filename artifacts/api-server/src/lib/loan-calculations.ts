export function calculateEmiAmount(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;

  const monthlyRate = annualInterestRate / 1200;
  if (monthlyRate === 0) {
    return Math.round((principal / tenureMonths) * 100) / 100;
  }

  const growth = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * growth) / (growth - 1);
  return Math.round(emi * 100) / 100;
}
