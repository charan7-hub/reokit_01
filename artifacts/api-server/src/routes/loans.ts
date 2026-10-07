import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  banksTable,
  db,
  loanApplicationsTable,
  loanProductsTable,
} from "@workspace/db";
import {
  ListLoanProductsQueryParams,
  ListLoanProductsResponse,
  SubmitLoanApplicationBody,
  SubmitLoanApplicationResponse,
} from "@workspace/api-zod";
import type { ErrorResponse } from "@workspace/api-zod";
import { calculateEmiAmount } from "../lib/loan-calculations";

const router: IRouter = Router();
const errorResponse = (error: string): ErrorResponse => ({ error });

router.get("/loan-products", async (req, res): Promise<void> => {
  const params = ListLoanProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res
      .status(400)
      .json(errorResponse("Choose a valid loan type."));
    return;
  }

  try {
    const products = await db
      .select({
        id: loanProductsTable.id,
        bank_id: loanProductsTable.bankId,
        loan_type: loanProductsTable.loanType,
        min_interest_rate: loanProductsTable.minInterestRate,
        max_interest_rate: loanProductsTable.maxInterestRate,
        max_tenure_months: loanProductsTable.maxTenureMonths,
        max_loan_amount: loanProductsTable.maxLoanAmount,
        processing_fee_desc: loanProductsTable.processingFeeDesc,
        features: loanProductsTable.features,
        bank: {
          id: banksTable.id,
          name: banksTable.name,
          logo_url: banksTable.logoUrl,
        },
      })
      .from(loanProductsTable)
      .innerJoin(banksTable, eq(loanProductsTable.bankId, banksTable.id))
      .where(eq(loanProductsTable.loanType, params.data.loanType))
      .orderBy(asc(loanProductsTable.minInterestRate));

    res.json(ListLoanProductsResponse.parse(products));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load loan products");
    res
      .status(500)
      .json(
        errorResponse("Could not load loan offers right now. Please try again."),
      );
  }
});

router.post("/loan-applications", async (req, res): Promise<void> => {
  const parsed = SubmitLoanApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json(errorResponse("Check the application details and try again."));
    return;
  }

  const input = {
    ...parsed.data,
    user_name: parsed.data.user_name.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    phone: parsed.data.phone.trim(),
  };
  if (input.user_name.length < 2) {
    res
      .status(400)
      .json(errorResponse("Enter your name."));
    return;
  }

  try {
    const [product] = await db
      .select({
        id: loanProductsTable.id,
        minInterestRate: loanProductsTable.minInterestRate,
        maxTenureMonths: loanProductsTable.maxTenureMonths,
        maxLoanAmount: loanProductsTable.maxLoanAmount,
      })
      .from(loanProductsTable)
      .where(eq(loanProductsTable.id, input.loan_product_id))
      .limit(1);

    if (!product) {
      res
        .status(404)
        .json(errorResponse("That loan offer is no longer available."));
      return;
    }

    if (input.requested_amount > product.maxLoanAmount) {
      res
        .status(400)
        .json(
          errorResponse(
            "Requested amount exceeds this offer’s maximum loan amount.",
          ),
        );
      return;
    }

    if (input.tenure_months > product.maxTenureMonths) {
      res
        .status(400)
        .json(
          errorResponse("Requested tenure exceeds this offer’s maximum tenure."),
        );
      return;
    }

    const estimatedEmi = calculateEmiAmount(
      input.requested_amount,
      product.minInterestRate,
      input.tenure_months,
    );
    const [application] = await db
      .insert(loanApplicationsTable)
      .values({
        userName: input.user_name,
        email: input.email,
        phone: input.phone,
        loanProductId: product.id,
        requestedAmount: input.requested_amount,
        tenureMonths: input.tenure_months,
        estimatedEmi,
      })
      .returning({ id: loanApplicationsTable.id });

    res
      .status(201)
      .json(
        SubmitLoanApplicationResponse.parse({
          id: application.id,
          estimated_emi: estimatedEmi,
        }),
      );
  } catch (error) {
    req.log.error({ err: error }, "Failed to submit loan application");
    res
      .status(500)
      .json(
        errorResponse("Could not submit your application. Please try again."),
      );
  }
});

export default router;
