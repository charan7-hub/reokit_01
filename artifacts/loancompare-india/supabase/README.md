# Supabase setup

1. In Supabase, open **SQL Editor** for the project connected to LoanCompare India.
2. Run [`setup.sql`](./setup.sql) once. It creates the public bank and loan tables, enables row-level security, seeds 40 loan products, and adds the application submission function.
3. Start or refresh LoanCompare India. The app reads the loan catalogue using the configured Supabase URL and anon/publishable key. Applications are written through `submit_loan_application`; the browser never receives permission to list submitted applications.

The Replit project has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured. Use only the Supabase anon/publishable key in the browser; never put a `service_role` key in a `VITE_` variable.

## Rate data

The starting figures are the rates and fees supplied in the project brief. They are indicative comparison inputs, not bank-approved quotations or verified live rates. Confirm eligibility, fees, and the current offer directly with each lender before applying.

The SQL can be re-run safely to refresh the supplied bank and product rows. Existing application records are not changed by the seed operations.
