-- LoanCompare India — Supabase schema and supplied indicative seed data.
-- Rates are the figures supplied in the project brief; they are not a live
-- quote or independently verified current bank offer. Confirm with each bank.

begin;

create extension if not exists pgcrypto;

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.loan_products (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  loan_type text not null check (loan_type in ('Personal', 'Car', 'Housing', 'Education')),
  min_interest_rate numeric(5, 2) not null check (min_interest_rate >= 0),
  max_interest_rate numeric(5, 2) not null check (max_interest_rate >= min_interest_rate),
  max_tenure_months integer not null check (max_tenure_months > 0),
  max_loan_amount bigint not null check (max_loan_amount > 0),
  processing_fee_desc text,
  features text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint loan_products_bank_id_loan_type_key unique (bank_id, loan_type)
);

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_name text not null check (char_length(trim(user_name)) between 2 and 100),
  email text not null check (position('@' in email) > 1),
  phone text not null check (char_length(phone) between 8 and 20),
  loan_product_id uuid not null references public.loan_products(id),
  requested_amount numeric not null check (requested_amount > 0),
  tenure_months integer not null check (tenure_months > 0),
  estimated_emi numeric not null check (estimated_emi > 0),
  status text not null default 'Pending',
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.banks enable row level security;
alter table public.loan_products enable row level security;
alter table public.loan_applications enable row level security;

drop policy if exists "Public can read banks" on public.banks;
create policy "Public can read banks"
  on public.banks for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read loan products" on public.loan_products;
create policy "Public can read loan products"
  on public.loan_products for select
  to anon, authenticated
  using (true);

grant select on public.banks, public.loan_products to anon, authenticated;
revoke all on public.loan_applications from anon, authenticated;

-- Public visitors can submit an application, but cannot read the applications
-- table. The function validates the selected product and computes EMI itself.
create or replace function public.submit_loan_application(
  p_user_name text,
  p_email text,
  p_phone text,
  p_loan_product_id uuid,
  p_requested_amount numeric,
  p_tenure_months integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rate numeric;
  v_max_amount bigint;
  v_max_tenure integer;
  v_monthly_rate numeric;
  v_emi numeric;
  v_name text := trim(coalesce(p_user_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Enter a name between 2 and 100 characters.';
  end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Enter a valid email address.';
  end if;
  if v_phone !~ '^\+?[0-9][0-9\s()\-]{7,18}$' then
    raise exception 'Enter a valid phone number.';
  end if;
  if p_requested_amount is null or p_requested_amount <= 0 then
    raise exception 'Requested amount must be greater than zero.';
  end if;
  if p_tenure_months is null or p_tenure_months <= 0 then
    raise exception 'Tenure must be greater than zero.';
  end if;

  select min_interest_rate, max_loan_amount, max_tenure_months
    into v_rate, v_max_amount, v_max_tenure
    from public.loan_products
    where id = p_loan_product_id;

  if not found then
    raise exception 'The selected loan offer is no longer available.';
  end if;
  if p_requested_amount > v_max_amount then
    raise exception 'Requested amount exceeds this product’s maximum loan amount.';
  end if;
  if p_tenure_months > v_max_tenure then
    raise exception 'Requested tenure exceeds this product’s maximum tenure.';
  end if;

  v_monthly_rate := v_rate / 1200;
  if v_monthly_rate = 0 then
    v_emi := p_requested_amount / p_tenure_months;
  else
    v_emi := p_requested_amount * v_monthly_rate
      * power(1 + v_monthly_rate, p_tenure_months)
      / (power(1 + v_monthly_rate, p_tenure_months) - 1);
  end if;

  insert into public.loan_applications (
    user_name, email, phone, loan_product_id, requested_amount,
    tenure_months, estimated_emi, status
  ) values (
    v_name, v_email, v_phone, p_loan_product_id, p_requested_amount,
    p_tenure_months, round(v_emi, 2), 'Pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_loan_application(text, text, text, uuid, numeric, integer) from public;
grant execute on function public.submit_loan_application(text, text, text, uuid, numeric, integer) to anon, authenticated;

insert into public.banks (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'State Bank of India (SBI)'),
  ('a0000000-0000-0000-0000-000000000002', 'HDFC Bank'),
  ('a0000000-0000-0000-0000-000000000003', 'ICICI Bank'),
  ('a0000000-0000-0000-0000-000000000004', 'Axis Bank'),
  ('a0000000-0000-0000-0000-000000000005', 'Bank of Baroda'),
  ('a0000000-0000-0000-0000-000000000006', 'Punjab National Bank'),
  ('a0000000-0000-0000-0000-000000000007', 'Canara Bank'),
  ('a0000000-0000-0000-0000-000000000008', 'Kotak Mahindra Bank'),
  ('a0000000-0000-0000-0000-000000000009', 'Union Bank of India'),
  ('a0000000-0000-0000-0000-000000000010', 'IDFC First Bank')
on conflict (id) do update set name = excluded.name;

insert into public.loan_products (
  bank_id, loan_type, min_interest_rate, max_interest_rate,
  max_tenure_months, max_loan_amount, processing_fee_desc, features
) values
  -- State Bank of India (SBI)
  ('a0000000-0000-0000-0000-000000000001', 'Personal', 10.00, 14.00, 84, 5000000, 'Up to 1.50%', array['Zero prepayment charges', 'Instant digital approval']),
  ('a0000000-0000-0000-0000-000000000001', 'Car', 8.80, 11.00, 84, 10000000, 'Nil / Minimal fee', array['Up to 100% on-road funding', 'Govt bank trust']),
  ('a0000000-0000-0000-0000-000000000001', 'Housing', 7.25, 9.50, 360, 100000000, '0.35% + GST', array['Special rate for women', 'Repo-linked transparent rate']),
  ('a0000000-0000-0000-0000-000000000001', 'Education', 8.15, 9.90, 180, 30000000, 'Nil up to ₹7.5 Lakhs', array['For premier institutes', 'Moratorium period available']),
  -- HDFC Bank
  ('a0000000-0000-0000-0000-000000000002', 'Personal', 9.99, 21.00, 84, 5000000, 'Up to ₹6,500', array['Quick disbursal in 10 secs', 'Flexible tenure']),
  ('a0000000-0000-0000-0000-000000000002', 'Car', 8.15, 12.00, 84, 2500000, 'Up to 0.50%', array['Fast approval', 'End-to-end digital']),
  ('a0000000-0000-0000-0000-000000000002', 'Housing', 7.20, 13.20, 360, 100000000, '0.50% - 1.0%', array['Special salaried perks', 'Doorstep service']),
  ('a0000000-0000-0000-0000-000000000002', 'Education', 10.50, 15.00, 180, 10000000, '1% above ₹7.5L', array['Global universities covered']),
  -- ICICI Bank
  ('a0000000-0000-0000-0000-000000000003', 'Personal', 9.99, 18.00, 72, 5000000, 'Up to 2%', array['Pre-approved offers', 'Minimal documentation']),
  ('a0000000-0000-0000-0000-000000000003', 'Car', 8.35, 12.00, 84, 5000000, 'Up to 2%', array['100% on-road funding']),
  ('a0000000-0000-0000-0000-000000000003', 'Housing', 7.65, 9.80, 360, 100000000, 'Up to 2%', array['Quick balance transfer']),
  ('a0000000-0000-0000-0000-000000000003', 'Education', 8.50, 13.00, 180, 20000000, 'Up to 2% + GST', array['Easy tracking & flexible repayment']),
  -- Axis Bank
  ('a0000000-0000-0000-0000-000000000004', 'Personal', 9.99, 21.00, 84, 4000000, 'Up to 2%', array['High loan amount', 'Quick processing']),
  ('a0000000-0000-0000-0000-000000000004', 'Car', 8.95, 13.00, 84, 5000000, '₹3,500 - ₹12,000', array['Flexible repayment options']),
  ('a0000000-0000-0000-0000-000000000004', 'Housing', 7.60, 9.90, 360, 100000000, 'Up to 1%', array['Attractive interest rates']),
  ('a0000000-0000-0000-0000-000000000004', 'Education', 8.00, 16.00, 180, 15000000, 'Up to 2%', array['Comprehensive coverage']),
  -- Bank of Baroda
  ('a0000000-0000-0000-0000-000000000005', 'Personal', 10.15, 16.00, 84, 5000000, 'Up to 2%', array['Low processing fees']),
  ('a0000000-0000-0000-0000-000000000005', 'Car', 7.60, 11.30, 84, 50000000, '₹1,500 - ₹20,000', array['Budget-friendly car loans']),
  ('a0000000-0000-0000-0000-000000000005', 'Housing', 7.20, 9.10, 360, 50000000, '0.25% - 0.50%', array['Long tenure options']),
  ('a0000000-0000-0000-0000-000000000005', 'Education', 8.15, 12.00, 180, 15000000, 'Nil fee', array['Premier institute discounts']),
  -- Punjab National Bank
  ('a0000000-0000-0000-0000-000000000006', 'Personal', 10.25, 16.80, 84, 2000000, 'Up to 1%', array['Trusted public bank']),
  ('a0000000-0000-0000-0000-000000000006', 'Car', 7.60, 9.40, 84, 10000000, '0.25%', array['Salaried applicant perks']),
  ('a0000000-0000-0000-0000-000000000006', 'Housing', 7.25, 9.90, 360, 50000000, '1.00%', array['Need-based financing']),
  ('a0000000-0000-0000-0000-000000000006', 'Education', 7.50, 12.00, 180, 10000000, 'Nil fee', array['Affordable rates']),
  -- Canara Bank
  ('a0000000-0000-0000-0000-000000000007', 'Personal', 9.70, 15.15, 84, 3000000, 'Up to 0.50%', array['Low interest rates']),
  ('a0000000-0000-0000-0000-000000000007', 'Car', 7.45, 11.30, 84, 5000000, 'Up to 0.25%', array['Special EV car loan rates']),
  ('a0000000-0000-0000-0000-000000000007', 'Housing', 7.25, 9.75, 360, 50000000, '0.50%', array['Flexible repayment']),
  ('a0000000-0000-0000-0000-000000000007', 'Education', 7.25, 10.10, 180, 10000000, 'Nil fee', array['Study in India & Abroad']),
  -- Kotak Mahindra Bank
  ('a0000000-0000-0000-0000-000000000008', 'Personal', 9.99, 24.00, 72, 10000000, 'Up to 5%', array['High loan amount']),
  ('a0000000-0000-0000-0000-000000000008', 'Car', 9.00, 14.00, 84, 5000000, 'Up to 1%', array['Quick sanction']),
  ('a0000000-0000-0000-0000-000000000008', 'Housing', 7.99, 9.50, 300, 400000000, '0.50% - 1.0%', array['High-income salaried buyers']),
  ('a0000000-0000-0000-0000-000000000008', 'Education', 9.98, 16.00, 180, 2000000, 'Nil fee', array['Quick processing']),
  -- Union Bank of India
  ('a0000000-0000-0000-0000-000000000009', 'Personal', 8.90, 12.65, 84, 5000000, 'Up to 1%', array['Low starting rate']),
  ('a0000000-0000-0000-0000-000000000009', 'Car', 7.50, 9.45, 84, 5000000, '₹1,000 + GST', array['Zero pre-closure penalties']),
  ('a0000000-0000-0000-0000-000000000009', 'Housing', 7.35, 9.80, 360, 50000000, '0.50%', array['Semi-urban friendly']),
  ('a0000000-0000-0000-0000-000000000009', 'Education', 9.25, 13.00, 180, 15000000, 'Nil fee', array['Secured & unsecured options']),
  -- IDFC First Bank
  ('a0000000-0000-0000-0000-000000000010', 'Personal', 9.99, 22.50, 60, 1500000, 'Up to 3.5%', array['Customer-friendly policies']),
  ('a0000000-0000-0000-0000-000000000010', 'Car', 9.99, 16.00, 120, 5000000, 'Up to ₹10,000', array['Up to 10-year tenure']),
  ('a0000000-0000-0000-0000-000000000010', 'Housing', 8.10, 10.50, 360, 100000000, 'Up to 3.0%', array['Digital first experience']),
  ('a0000000-0000-0000-0000-000000000010', 'Education', 9.50, 15.00, 180, 15000000, 'Up to 1.5%', array['Fast approval'])
on conflict (bank_id, loan_type) do update set
  min_interest_rate = excluded.min_interest_rate,
  max_interest_rate = excluded.max_interest_rate,
  max_tenure_months = excluded.max_tenure_months,
  max_loan_amount = excluded.max_loan_amount,
  processing_fee_desc = excluded.processing_fee_desc,
  features = excluded.features;

commit;
