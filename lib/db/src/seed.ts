import { db } from "./index";
import { banksTable, loanProductsTable } from "./schema";

const banks = [
  { id: "a0000000-0000-0000-0000-000000000001", name: "State Bank of India (SBI)" },
  { id: "a0000000-0000-0000-0000-000000000002", name: "HDFC Bank" },
  { id: "a0000000-0000-0000-0000-000000000003", name: "ICICI Bank" },
  { id: "a0000000-0000-0000-0000-000000000004", name: "Axis Bank" },
  { id: "a0000000-0000-0000-0000-000000000005", name: "Bank of Baroda" },
  { id: "a0000000-0000-0000-0000-000000000006", name: "Punjab National Bank" },
  { id: "a0000000-0000-0000-0000-000000000007", name: "Canara Bank" },
  { id: "a0000000-0000-0000-0000-000000000008", name: "Kotak Mahindra Bank" },
  { id: "a0000000-0000-0000-0000-000000000009", name: "Union Bank of India" },
  { id: "a0000000-0000-0000-0000-000000000010", name: "IDFC First Bank" },
];

const productSeeds = [
  { bank: "State Bank of India (SBI)", loanType: "Personal", minInterestRate: 10, maxInterestRate: 14, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 1.50%", features: ["Zero prepayment charges", "Instant digital approval"] },
  { bank: "State Bank of India (SBI)", loanType: "Car", minInterestRate: 8.8, maxInterestRate: 11, maxTenureMonths: 84, maxLoanAmount: 10_000_000, processingFeeDesc: "Nil / Minimal fee", features: ["Up to 100% on-road funding", "Govt bank trust"] },
  { bank: "State Bank of India (SBI)", loanType: "Housing", minInterestRate: 7.25, maxInterestRate: 9.5, maxTenureMonths: 360, maxLoanAmount: 100_000_000, processingFeeDesc: "0.35% + GST", features: ["Special rate for women", "Repo-linked transparent rate"] },
  { bank: "State Bank of India (SBI)", loanType: "Education", minInterestRate: 8.15, maxInterestRate: 9.9, maxTenureMonths: 180, maxLoanAmount: 30_000_000, processingFeeDesc: "Nil up to ₹7.5 Lakhs", features: ["For premier institutes", "Moratorium period available"] },
  { bank: "HDFC Bank", loanType: "Personal", minInterestRate: 9.99, maxInterestRate: 21, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to ₹6,500", features: ["Quick disbursal in 10 secs", "Flexible tenure"] },
  { bank: "HDFC Bank", loanType: "Car", minInterestRate: 8.15, maxInterestRate: 12, maxTenureMonths: 84, maxLoanAmount: 2_500_000, processingFeeDesc: "Up to 0.50%", features: ["Fast approval", "End-to-end digital"] },
  { bank: "HDFC Bank", loanType: "Housing", minInterestRate: 7.2, maxInterestRate: 13.2, maxTenureMonths: 360, maxLoanAmount: 100_000_000, processingFeeDesc: "0.50% - 1.0%", features: ["Special salaried perks", "Doorstep service"] },
  { bank: "HDFC Bank", loanType: "Education", minInterestRate: 10.5, maxInterestRate: 15, maxTenureMonths: 180, maxLoanAmount: 10_000_000, processingFeeDesc: "1% above ₹7.5L", features: ["Global universities covered"] },
  { bank: "ICICI Bank", loanType: "Personal", minInterestRate: 9.99, maxInterestRate: 18, maxTenureMonths: 72, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 2%", features: ["Pre-approved offers", "Minimal documentation"] },
  { bank: "ICICI Bank", loanType: "Car", minInterestRate: 8.35, maxInterestRate: 12, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 2%", features: ["100% on-road funding"] },
  { bank: "ICICI Bank", loanType: "Housing", minInterestRate: 7.65, maxInterestRate: 9.8, maxTenureMonths: 360, maxLoanAmount: 100_000_000, processingFeeDesc: "Up to 2%", features: ["Quick balance transfer"] },
  { bank: "ICICI Bank", loanType: "Education", minInterestRate: 8.5, maxInterestRate: 13, maxTenureMonths: 180, maxLoanAmount: 20_000_000, processingFeeDesc: "Up to 2% + GST", features: ["Easy tracking & flexible repayment"] },
  { bank: "Axis Bank", loanType: "Personal", minInterestRate: 9.99, maxInterestRate: 21, maxTenureMonths: 84, maxLoanAmount: 4_000_000, processingFeeDesc: "Up to 2%", features: ["High loan amount", "Quick processing"] },
  { bank: "Axis Bank", loanType: "Car", minInterestRate: 8.95, maxInterestRate: 13, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "₹3,500 - ₹12,000", features: ["Flexible repayment options"] },
  { bank: "Axis Bank", loanType: "Housing", minInterestRate: 7.6, maxInterestRate: 9.9, maxTenureMonths: 360, maxLoanAmount: 100_000_000, processingFeeDesc: "Up to 1%", features: ["Attractive interest rates"] },
  { bank: "Axis Bank", loanType: "Education", minInterestRate: 8, maxInterestRate: 16, maxTenureMonths: 180, maxLoanAmount: 15_000_000, processingFeeDesc: "Up to 2%", features: ["Comprehensive coverage"] },
  { bank: "Bank of Baroda", loanType: "Personal", minInterestRate: 10.15, maxInterestRate: 16, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 2%", features: ["Low processing fees"] },
  { bank: "Bank of Baroda", loanType: "Car", minInterestRate: 7.6, maxInterestRate: 11.3, maxTenureMonths: 84, maxLoanAmount: 50_000_000, processingFeeDesc: "₹1,500 - ₹20,000", features: ["Budget-friendly car loans"] },
  { bank: "Bank of Baroda", loanType: "Housing", minInterestRate: 7.2, maxInterestRate: 9.1, maxTenureMonths: 360, maxLoanAmount: 50_000_000, processingFeeDesc: "0.25% - 0.50%", features: ["Long tenure options"] },
  { bank: "Bank of Baroda", loanType: "Education", minInterestRate: 8.15, maxInterestRate: 12, maxTenureMonths: 180, maxLoanAmount: 15_000_000, processingFeeDesc: "Nil fee", features: ["Premier institute discounts"] },
  { bank: "Punjab National Bank", loanType: "Personal", minInterestRate: 10.25, maxInterestRate: 16.8, maxTenureMonths: 84, maxLoanAmount: 2_000_000, processingFeeDesc: "Up to 1%", features: ["Trusted public bank"] },
  { bank: "Punjab National Bank", loanType: "Car", minInterestRate: 7.6, maxInterestRate: 9.4, maxTenureMonths: 84, maxLoanAmount: 10_000_000, processingFeeDesc: "0.25%", features: ["Salaried applicant perks"] },
  { bank: "Punjab National Bank", loanType: "Housing", minInterestRate: 7.25, maxInterestRate: 9.9, maxTenureMonths: 360, maxLoanAmount: 50_000_000, processingFeeDesc: "1.00%", features: ["Need-based financing"] },
  { bank: "Punjab National Bank", loanType: "Education", minInterestRate: 7.5, maxInterestRate: 12, maxTenureMonths: 180, maxLoanAmount: 10_000_000, processingFeeDesc: "Nil fee", features: ["Affordable rates"] },
  { bank: "Canara Bank", loanType: "Personal", minInterestRate: 9.7, maxInterestRate: 15.15, maxTenureMonths: 84, maxLoanAmount: 3_000_000, processingFeeDesc: "Up to 0.50%", features: ["Low interest rates"] },
  { bank: "Canara Bank", loanType: "Car", minInterestRate: 7.45, maxInterestRate: 11.3, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 0.25%", features: ["Special EV car loan rates"] },
  { bank: "Canara Bank", loanType: "Housing", minInterestRate: 7.25, maxInterestRate: 9.75, maxTenureMonths: 360, maxLoanAmount: 50_000_000, processingFeeDesc: "0.50%", features: ["Flexible repayment"] },
  { bank: "Canara Bank", loanType: "Education", minInterestRate: 7.25, maxInterestRate: 10.1, maxTenureMonths: 180, maxLoanAmount: 10_000_000, processingFeeDesc: "Nil fee", features: ["Study in India & Abroad"] },
  { bank: "Kotak Mahindra Bank", loanType: "Personal", minInterestRate: 9.99, maxInterestRate: 24, maxTenureMonths: 72, maxLoanAmount: 10_000_000, processingFeeDesc: "Up to 5%", features: ["High loan amount"] },
  { bank: "Kotak Mahindra Bank", loanType: "Car", minInterestRate: 9, maxInterestRate: 14, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 1%", features: ["Quick sanction"] },
  { bank: "Kotak Mahindra Bank", loanType: "Housing", minInterestRate: 7.99, maxInterestRate: 9.5, maxTenureMonths: 300, maxLoanAmount: 400_000_000, processingFeeDesc: "0.50% - 1.0%", features: ["High-income salaried buyers"] },
  { bank: "Kotak Mahindra Bank", loanType: "Education", minInterestRate: 9.98, maxInterestRate: 16, maxTenureMonths: 180, maxLoanAmount: 2_000_000, processingFeeDesc: "Nil fee", features: ["Quick processing"] },
  { bank: "Union Bank of India", loanType: "Personal", minInterestRate: 8.9, maxInterestRate: 12.65, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to 1%", features: ["Low starting rate"] },
  { bank: "Union Bank of India", loanType: "Car", minInterestRate: 7.5, maxInterestRate: 9.45, maxTenureMonths: 84, maxLoanAmount: 5_000_000, processingFeeDesc: "₹1,000 + GST", features: ["Zero pre-closure penalties"] },
  { bank: "Union Bank of India", loanType: "Housing", minInterestRate: 7.35, maxInterestRate: 9.8, maxTenureMonths: 360, maxLoanAmount: 50_000_000, processingFeeDesc: "0.50%", features: ["Semi-urban friendly"] },
  { bank: "Union Bank of India", loanType: "Education", minInterestRate: 9.25, maxInterestRate: 13, maxTenureMonths: 180, maxLoanAmount: 15_000_000, processingFeeDesc: "Nil fee", features: ["Secured & unsecured options"] },
  { bank: "IDFC First Bank", loanType: "Personal", minInterestRate: 9.99, maxInterestRate: 22.5, maxTenureMonths: 60, maxLoanAmount: 1_500_000, processingFeeDesc: "Up to 3.5%", features: ["Customer-friendly policies"] },
  { bank: "IDFC First Bank", loanType: "Car", minInterestRate: 9.99, maxInterestRate: 16, maxTenureMonths: 120, maxLoanAmount: 5_000_000, processingFeeDesc: "Up to ₹10,000", features: ["Up to 10-year tenure"] },
  { bank: "IDFC First Bank", loanType: "Housing", minInterestRate: 8.1, maxInterestRate: 10.5, maxTenureMonths: 360, maxLoanAmount: 100_000_000, processingFeeDesc: "Up to 3.0%", features: ["Digital first experience"] },
  { bank: "IDFC First Bank", loanType: "Education", minInterestRate: 9.5, maxInterestRate: 15, maxTenureMonths: 180, maxLoanAmount: 15_000_000, processingFeeDesc: "Up to 1.5%", features: ["Fast approval"] },
];

export async function seedLoanCatalog(): Promise<void> {
  await db.insert(banksTable).values(
    banks.map((bank) => ({ ...bank, logoUrl: null })),
  ).onConflictDoNothing();

  const savedBanks = await db
    .select({ id: banksTable.id, name: banksTable.name })
    .from(banksTable);
  const bankIds = new Map(savedBanks.map((bank) => [bank.name, bank.id]));

  const products = productSeeds.map(({ bank, ...product }) => {
    const bankId = bankIds.get(bank);
    if (!bankId) {
      throw new Error(`Seed bank was not created: ${bank}`);
    }
    return { ...product, bankId };
  });

  await db
    .insert(loanProductsTable)
    .values(products)
    .onConflictDoNothing();
}
