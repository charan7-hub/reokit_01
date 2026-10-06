import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Form, FormField } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowDownUp, ArrowRight, BadgeCheck, Building2, CarFront, Check, ChevronDown, CircleAlert, GraduationCap, HandCoins, Landmark, LoaderCircle, LockKeyhole, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchLoanProducts, submitLoanApplication } from '@/lib/loan-service';
import type { LoanApplicationInput, LoanProduct, LoanType } from '@/lib/loan-service';

const queryClient = new QueryClient();
const applicationFormSchema = z.object({
  user_name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name is too long.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit Indian mobile number.'),
});
type ApplicationFormValues = z.infer<typeof applicationFormSchema>;
const LOAN_TYPES: { label: LoanType; sub: string; icon: typeof HandCoins }[] = [
  { label: 'Personal', sub: 'For life, as it happens', icon: HandCoins },
  { label: 'Car', sub: 'Your next mile starts here', icon: CarFront },
  { label: 'Housing', sub: 'Make room for more', icon: Building2 },
  { label: 'Education', sub: 'Invest in what’s next', icon: GraduationCap },
];
const COMPARE_KEY = 'loancompare-india:compare';
const inr = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const calcEmi = (amount: number, annualRate: number, months: number) => {
  if (!amount || !months) return 0;
  const monthly = annualRate / 1200;
  return monthly === 0 ? amount / months : (amount * monthly * Math.pow(1 + monthly, months)) / (Math.pow(1 + monthly, months) - 1);
};
const safeLogo = (product: LoanProduct) => product.bank.logo_url || undefined;

function Home() {
  const [loanType, setLoanType] = useState<LoanType>('Personal');
  const [tenureUnit, setTenureUnit] = useState<'months' | 'years'>('months');
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bank, setBank] = useState('all');
  const [sort, setSort] = useState('rate');
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');
  const [amount, setAmount] = useState(500000);
  const [tenure, setTenure] = useState(36);
  const [compared, setCompared] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]').slice(0, 3); } catch { return []; }
  });
  const [showCompare, setShowCompare] = useState(false);
  const [applyProduct, setApplyProduct] = useState<LoanProduct | null>(null);
  const applicationForm = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: { user_name: '', email: '', phone: '' },
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchLoanProducts(loanType);
      setProducts(rows);
    } catch (error) {
      setProducts([]);
      setLoadError(error instanceof Error ? error.message : 'We couldn’t reach the loan database. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loanType]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { localStorage.setItem(COMPARE_KEY, JSON.stringify(compared)); }, [compared]);
  useEffect(() => {
    if (loadError) {
      toast({ title: 'Could not load loan offers', description: loadError, variant: 'destructive' });
    }
  }, [loadError, toast]);

  const banks = useMemo(() => [...new Map(products.map((p) => [p.bank_id, p.bank.name])).entries()].map(([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const filtered = useMemo(() => {
    const rows = products.filter((p) => bank === 'all' || String(p.bank_id) === bank);
    return rows.sort((a, b) => {
      if (sort === 'emi') return calcEmi(amount, a.min_interest_rate, tenure) - calcEmi(amount, b.min_interest_rate, tenure);
      if (sort === 'amount') return b.max_loan_amount - a.max_loan_amount;
      return a.min_interest_rate - b.min_interest_rate;
    });
  }, [products, bank, sort, amount, tenure]);
  const compareProducts = products.filter((product) => compared.includes(String(product.id)));
  useEffect(() => {
    if (!loading && !loadError && products.length > 0 && filtered.length === 0) {
      toast({ title: 'No offers match those filters', description: 'Reset filters to see the available offers again.' });
    }
  }, [loading, loadError, products.length, filtered.length, toast]);
  const heroOffer = filtered[0];

  function toggleCompare(id: string) {
    setCompared((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length < 3 ? [...current, id] : current);
  }
  function resetFilters() { setBank('all'); setSort('rate'); setAmount(500000); setTenure(36); }
  function openApply(product: LoanProduct) {
    setAmount((current) => Math.min(current, product.max_loan_amount));
    setTenure((current) => Math.min(current, product.max_tenure_months));
    setApplyProduct(product);
    applicationForm.reset({ user_name: '', email: '', phone: '' });
    setFormError('');
    setApplicationId('');
  }
  async function handleApply(values: ApplicationFormValues) {
    if (!applyProduct) return;
    if (amount <= 0 || amount > applyProduct.max_loan_amount) return setFormError(`Choose an amount up to ${inr(applyProduct.max_loan_amount)} for this offer.`);
    if (tenure <= 0 || tenure > applyProduct.max_tenure_months) return setFormError(`Choose a tenure up to ${applyProduct.max_tenure_months} months for this offer.`);
    setSubmitting(true);
    setFormError('');
    const input: LoanApplicationInput = {
      user_name: values.user_name,
      email: values.email,
      phone: values.phone,
      loan_product_id: applyProduct.id,
      requested_amount: amount,
      tenure_months: tenure,
      estimated_emi: Math.round(calcEmi(amount, applyProduct.min_interest_rate, tenure)),
    };
    try {
      const result = await submitLoanApplication(input);
      setApplicationId(result.id);
      toast({ title: 'Application submitted', description: `Reference ID: ${result.id}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Your application could not be sent. Please try again.';
      setFormError(message);
      toast({ title: 'Application could not be sent', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell" data-testid="page-loancompare">
      <header className="topbar">
        <a href="/" className="brand" data-testid="link-home">
          <span className="brand-mark"><Landmark size={21} strokeWidth={2.1} /></span>
          <span className="brand-name">LoanCompare<span>India</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#offers" data-testid="link-browse">Explore loans</a>
          <button type="button" onClick={() => setShowCompare(true)} className="nav-compare" data-testid="button-open-comparison">
            Compare <span className="compare-count">{compared.length}</span>
          </button>
        </nav>
        <div className="trust-note"><ShieldCheck size={16} /> Free to compare <i /> No impact on credit score</div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> SMARTER BORROWING STARTS HERE</div>
          <h1>Big plans.<br /><em>Better</em> borrowing.</h1>
          <p>Compare loan estimates from Indian banks. Explore starting rates, see your EMI, and decide what works for you.</p>
          <div className="hero-proof">
            <span><BadgeCheck size={17} /> Options across 10 banks</span>
            <span><LockKeyhole size={15} /> Your details stay private</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-paper"><div className="paper-top"><span>{heroOffer ? `${heroOffer.bank.name.toUpperCase()} · ${loanType.toUpperCase()}` : 'YOUR NEXT CHAPTER'}</span><Sparkles size={15} /></div><div className="paper-rate">{heroOffer ? heroOffer.min_interest_rate : '—'}{heroOffer && <span>%</span>}</div><div className="paper-caption">{heroOffer ? 'indicative starting rate' : 'loan rate estimate'}</div><div className="paper-rule" /><div className="paper-foot"><span>Estimated EMI</span><b>{heroOffer ? `${inr(Math.round(calcEmi(amount, heroOffer.min_interest_rate, tenure)))} / mo` : '—'}</b></div></div>
          <div className="coin coin-a">₹</div><div className="coin coin-b">₹</div>
          <div className="art-caption">A clearer path<br />to what’s next.</div>
        </div>
        <div className="hero-index"><span>01</span><i /> COMPARE WITH CLARITY</div>
      </section>

      <section className="loan-type-section" aria-label="Choose a loan category">
        <div className="section-kicker">START WITH YOUR PLAN</div>
        <div className="loan-type-row">
            {LOAN_TYPES.map(({ label, sub, icon: Icon }, index) => (
            <button key={label} type="button" className={`loan-type ${loanType === label ? 'selected' : ''}`} onClick={() => { setLoanType(label); setBank('all'); setCompared([]); setShowCompare(false); }} data-testid={`button-loan-type-${label.toLowerCase()}`}>
              <span className="type-icon"><Icon size={20} strokeWidth={1.8} /></span>
              <span className="type-copy"><b>{label} loan</b><small>{sub}</small></span>
              <span className="type-num">0{index + 1}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="finder-section" aria-label="Loan calculator and offer filters">
        <div className="finder-heading">
          <div><div className="section-kicker">MAKE IT YOURS</div><h2>Set your numbers.</h2></div>
          <p>See what each offer could look like for you.<br />EMIs update as you adjust.</p>
        </div>
        <div className="calculator">
          <div className="calc-control">
            <label htmlFor="amount-range">I’d like to borrow</label>
            <div className="calc-value"><span>₹</span><input aria-label="Loan amount" data-testid="input-loan-amount" type="number" min="50000" step="10000" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} /></div>
            <input id="amount-range" data-testid="range-loan-amount" className="range-input" type="range" min="50000" max="5000000" step="50000" value={Math.min(amount, 5000000)} onChange={(e) => setAmount(Number(e.target.value))} />
            <div className="range-hints"><span>₹50,000</span><span>₹50 lakh</span></div>
          </div>
          <div className="calc-divider" />
          <div className="calc-control tenure-control">
            <div className="tenure-heading"><label htmlFor="tenure-range">Over a period of</label><div className="tenure-unit-toggle" role="group" aria-label="Tenure unit"><button type="button" className={tenureUnit === 'months' ? 'active' : ''} onClick={() => setTenureUnit('months')} data-testid="button-tenure-months">Months</button><button type="button" className={tenureUnit === 'years' ? 'active' : ''} onClick={() => { setTenureUnit('years'); setTenure(Math.min(360, Math.max(12, Math.round(tenure / 12) * 12))); }} data-testid="button-tenure-years">Years</button></div></div>
            <div className="calc-value"><input aria-label={`Tenure in ${tenureUnit}`} data-testid="input-tenure" type="number" min={tenureUnit === 'months' ? 6 : 1} max={tenureUnit === 'months' ? 360 : 30} step={tenureUnit === 'months' ? 6 : 1} value={tenureUnit === 'months' ? tenure : Math.round(tenure / 12)} onChange={(e) => setTenure(Math.min(360, Math.max(tenureUnit === 'months' ? 6 : 12, tenureUnit === 'months' ? Number(e.target.value) : Number(e.target.value) * 12)))} /><span className="unit">{tenureUnit}</span></div>
            <input id="tenure-range" data-testid="range-tenure" className="range-input" type="range" min={tenureUnit === 'months' ? 6 : 1} max={tenureUnit === 'months' ? 360 : 30} step={tenureUnit === 'months' ? 6 : 1} value={tenureUnit === 'months' ? tenure : Math.round(tenure / 12)} onChange={(e) => setTenure(tenureUnit === 'months' ? Number(e.target.value) : Number(e.target.value) * 12)} />
            <div className="range-hints"><span>{tenureUnit === 'months' ? '6 months' : '1 year'}</span><span>30 years</span></div>
          </div>
          <div className="emi-preview" data-testid="text-estimated-emi">
            <span>ESTIMATED EMI FROM</span>
            <strong>{filtered.length ? inr(Math.round(calcEmi(amount, filtered[0].min_interest_rate, tenure))) : '—'}<small>/ month</small></strong>
            <small>At the lowest available rate</small>
          </div>
        </div>
      </section>

      <section id="offers" className="offers-section">
        <div className="offers-title-row">
          <div><div className="section-kicker">YOUR SHORTLIST</div><h2>Offers worth a look<span>.</span></h2></div>
          <div className="result-count" data-testid="text-offer-count">{loading ? 'Checking rates…' : `${filtered.length} ${filtered.length === 1 ? 'offer' : 'offers'} found`}</div>
        </div>
        <div className="filters-bar">
          <div className="filters-label"><SlidersHorizontal size={16} /> Refine</div>
          <label className="select-wrap"><span className="sr-only">Filter by bank</span><Landmark size={15} /><select value={bank} onChange={(e) => setBank(e.target.value)} data-testid="select-bank-filter"><option value="all">All banks</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><ChevronDown size={14} /></label>
          <label className="select-wrap sort-select"><ArrowDownUp size={15} /><span className="sr-only">Sort offers</span><select value={sort} onChange={(e) => setSort(e.target.value)} data-testid="select-sort-offers"><option value="rate">Lowest interest rate</option><option value="emi">Lowest estimated EMI</option><option value="amount">Highest loan amount</option></select><ChevronDown size={14} /></label>
          <div className="view-switch" aria-label="Offer display style"><button type="button" className={layout === 'cards' ? 'active' : ''} aria-label="Card view" onClick={() => setLayout('cards')} data-testid="button-card-view"><span className="grid-glyph">▦</span></button><button type="button" className={layout === 'table' ? 'active' : ''} aria-label="Table view" onClick={() => setLayout('table')} data-testid="button-table-view"><span className="table-glyph">☷</span></button></div>
        </div>
        {loading ? <div className="skeleton-list" data-testid="status-products-loading">{[1, 2, 3].map((x) => <div className="skeleton-card" key={x}><span /><span /><span /><span /></div>)}</div> :
          loadError ? <div className="state-panel error-panel" data-testid="status-products-error"><span className="state-icon"><CircleAlert size={23} /></span><h3>Offers are taking a moment.</h3><p>{loadError}</p><button className="button-secondary" onClick={() => void loadProducts()} data-testid="button-retry-products"><RotateCcw size={15} /> Try again</button></div> :
          filtered.length === 0 ? <div className="state-panel empty-panel" data-testid="status-products-empty"><span className="state-icon"><HandCoins size={23} /></span><h3>No offers match those filters.</h3><p>Clear your filters to see every available {loanType.toLowerCase()} loan offer.</p><button className="button-secondary" onClick={resetFilters} data-testid="button-reset-filters"><RotateCcw size={15} /> Reset filters</button></div> :
          layout === 'cards' ? <div className="product-grid" data-testid="list-loan-products">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} amount={amount} tenure={tenure} compared={compared.includes(String(product.id))} compareDisabled={compared.length >= 3 && !compared.includes(String(product.id))} onCompare={() => toggleCompare(String(product.id))} onApply={() => openApply(product)} />)}</div> :
          <div className="table-wrap"><table className="offer-table"><thead><tr><th>Bank & offer</th><th>Interest rate</th><th>Estimated EMI</th><th>Max amount</th><th>Tenure</th><th>Compare</th><th></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id} data-testid={`row-loan-product-${product.id}`}><td><div className="table-bank">{product.bank.logo_url ? <img src={safeLogo(product)} alt="" /> : <span className="bank-monogram">{product.bank.name.slice(0, 1)}</span>}<b>{product.bank.name}</b></div></td><td className="table-rate">{product.min_interest_rate}% <small>onwards</small></td><td>{inr(Math.round(calcEmi(amount, product.min_interest_rate, tenure)))}</td><td>{inr(product.max_loan_amount)}</td><td>Up to {Math.round(product.max_tenure_months / 12)} yrs</td><td><button className={`compare-check ${compared.includes(String(product.id)) ? 'checked' : ''}`} type="button" onClick={() => toggleCompare(String(product.id))} disabled={compared.length >= 3 && !compared.includes(String(product.id))} data-testid={`button-compare-${product.id}`}>{compared.includes(String(product.id)) ? <Check size={14} /> : <Plus size={14} />}</button></td><td><button className="table-apply" type="button" onClick={() => openApply(product)} data-testid={`button-apply-${product.id}`}>Apply <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div>
        }
        <div className="comparison-callout"><div className="callout-icon"><ArrowDownUp size={18} /></div><div><b>Good decisions deserve a side-by-side.</b><p>Add up to 3 offers to compare the details that matter.</p></div><button type="button" onClick={() => setShowCompare(true)} data-testid="button-view-comparison">Compare offers <ArrowRight size={15} /></button></div>
      </section>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark"><Landmark size={18} /></span><span>LoanCompare<span>India</span></span></div><div className="footer-trust"><ShieldCheck size={15} /> Clear estimates. Confident decisions.</div><p>Rates and eligibility are indicative and supplied for comparison only. Verify current terms with the lender. EMI shown is an estimate, not a loan offer.</p><span className="footer-mark">MADE FOR THE WAY INDIA MOVES</span></footer>

      {compared.length > 0 && <aside className="compare-dock" aria-label="Selected loan comparisons" data-testid="drawer-comparison">
        <div className="compare-dock-copy"><b>{compareProducts.length} of 3 offers selected</b><span>Compare rates, EMIs and fees</span></div>
        <div className="compare-dock-picks">{compareProducts.map((product) => <span className="compare-dock-pick" key={product.id} data-testid={`chip-compared-${product.id}`}>{product.bank.name}<button type="button" onClick={() => toggleCompare(String(product.id))} aria-label={`Remove ${product.bank.name}`} data-testid={`button-remove-dock-${product.id}`}><X size={13} /></button></span>)}</div>
        <button className="primary-button compare-dock-action" type="button" disabled={compareProducts.length === 0} onClick={() => setShowCompare(true)} data-testid="button-open-comparison-drawer">Compare offers <span>{compareProducts.length}</span><ArrowRight size={15} /></button>
        <button className="compare-dock-clear" type="button" onClick={() => setCompared([])} data-testid="button-clear-comparison">Clear</button>
      </aside>}

      {showCompare && <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCompare(false); }}><section className="compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-title" data-testid="dialog-comparison"><header className="dialog-header"><div><div className="section-kicker">SIDE BY SIDE</div><h2 id="compare-title">Compare your picks.</h2></div><button type="button" className="icon-button" onClick={() => setShowCompare(false)} aria-label="Close comparison" data-testid="button-close-comparison"><X size={19} /></button></header>
        {compareProducts.length ? <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th></th>{compareProducts.map((p) => <th key={p.id}><div className="compare-bank">{p.bank.logo_url ? <img src={safeLogo(p)} alt="" /> : <span className="bank-monogram">{p.bank.name.slice(0, 1)}</span>}<b>{p.bank.name}</b><button type="button" onClick={() => toggleCompare(String(p.id))} aria-label={`Remove ${p.bank.name} from comparison`} data-testid={`button-remove-compare-${p.id}`}><X size={14} /></button></div></th>)}</tr></thead><tbody><CompareRow label="Interest rate" products={compareProducts} render={(p) => <strong className="compare-rate">{p.min_interest_rate}%<small> onwards</small></strong>} /><CompareRow label="Estimated EMI" products={compareProducts} render={(p) => <strong>{inr(Math.round(calcEmi(amount, p.min_interest_rate, tenure)))}</strong>} /><CompareRow label="Max loan amount" products={compareProducts} render={(p) => <strong>{inr(p.max_loan_amount)}</strong>} /><CompareRow label="Max tenure" products={compareProducts} render={(p) => <strong>{Math.round(p.max_tenure_months / 12)} years</strong>} /><CompareRow label="Processing fee" products={compareProducts} render={(p) => <span>{p.processing_fee_desc}</span>} /><CompareRow label="Highlights" products={compareProducts} render={(p) => <ul className="feature-list">{p.features.slice(0, 3).map((feature, i) => <li key={`${p.id}-${i}`}><Check size={13} />{feature}</li>)}</ul>} /><tr><th></th>{compareProducts.map((p) => <td key={p.id}><button type="button" className="primary-button compare-apply" onClick={() => { setShowCompare(false); openApply(p); }} data-testid={`button-compare-apply-${p.id}`}>Apply now <ArrowRight size={15} /></button></td>)}</tr></tbody></table></div> : <div className="compare-empty"><div className="empty-stack"><Plus size={24} /></div><h3>Your comparison starts here.</h3><p>Pick up to three offers from the list. We’ll line up rates, EMIs, fees and features for you.</p><button type="button" className="button-secondary" onClick={() => setShowCompare(false)} data-testid="button-return-offers">Browse offers <ArrowRight size={15} /></button></div>}
        <div className="dialog-footnote"><LockKeyhole size={14} /> Comparing offers is private and won’t affect your credit score.</div></section></div>}

      {applyProduct && <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setApplyProduct(null); }}><section className="apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title" data-testid="dialog-application">
        <header className="dialog-header"><div><div className="section-kicker">{applicationId ? 'APPLICATION RECEIVED' : 'A GOOD NEXT STEP'}</div><h2 id="apply-title">{applicationId ? 'You’re on your way.' : 'Start your application.'}</h2></div><button type="button" className="icon-button" disabled={submitting} onClick={() => setApplyProduct(null)} aria-label="Close application" data-testid="button-close-application"><X size={19} /></button></header>
        {applicationId ? <div className="success-panel" data-testid="status-application-success"><span className="success-check"><Check size={25} /></span><h3>Request recorded successfully.</h3><p>Your enquiry is saved with LoanCompare India. Keep this reference for your records.</p><div className="reference-box"><span>APPLICATION REFERENCE</span><b data-testid="text-application-id">{applicationId}</b></div><button type="button" className="primary-button full-button" onClick={() => setApplyProduct(null)} data-testid="button-finish-application">Done <ArrowRight size={16} /></button></div> :
          <><div className="apply-summary"><div className="summary-bank">{applyProduct.bank.logo_url ? <img src={safeLogo(applyProduct)} alt="" /> : <span className="bank-monogram">{applyProduct.bank.name.slice(0, 1)}</span>}<div><b>{applyProduct.bank.name}</b><small>{loanType} loan · {applyProduct.min_interest_rate}% onwards</small></div></div><div className="summary-emi"><small>EST. MONTHLY EMI</small><b>{inr(Math.round(calcEmi(amount, applyProduct.min_interest_rate, tenure)))}</b></div></div>
          <Form {...applicationForm}>
          <form onSubmit={applicationForm.handleSubmit(handleApply)} className="application-form" noValidate>
            <FormField control={applicationForm.control} name="user_name" render={({ field, fieldState }) => <label>Full name<input {...field} required autoComplete="name" placeholder="As on your PAN card" aria-invalid={fieldState.invalid} data-testid="input-applicant-name" />{fieldState.error && <span className="field-error">{fieldState.error.message}</span>}</label>} />
            <FormField control={applicationForm.control} name="email" render={({ field, fieldState }) => <label>Email address<input {...field} required type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={fieldState.invalid} data-testid="input-applicant-email" />{fieldState.error && <span className="field-error">{fieldState.error.message}</span>}</label>} />
            <FormField control={applicationForm.control} name="phone" render={({ field, fieldState }) => <label>Mobile number<div className="phone-input"><span>+91</span><input {...field} required inputMode="numeric" autoComplete="tel-national" maxLength={10} aria-invalid={fieldState.invalid} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" data-testid="input-applicant-phone" /></div>{fieldState.error && <span className="field-error">{fieldState.error.message}</span>}</label>} />
            <div className="request-summary"><span>Requested amount <b>{inr(amount)}</b></span><span>Repayment period <b>{tenureUnit === 'years' ? `${Math.round(tenure / 12)} years` : `${tenure} months`}</b></span></div>
            {formError && <div className="form-error" role="alert" data-testid="status-application-error"><CircleAlert size={16} />{formError}</div>}
            <button type="submit" className="primary-button full-button" disabled={submitting} data-testid="button-submit-application">{submitting ? <><LoaderCircle className="spin" size={17} /> Sending securely…</> : <>Submit application <ArrowRight size={16} /></>}</button>
            <p className="privacy-copy"><LockKeyhole size={13} /> Your details are stored for this enquiry; they are not sent to the lender automatically.</p>
          </form>
          </Form></>}
      </section></div>}
    </main>
  );
}

function ProductCard({ product, index, amount, tenure, compared, compareDisabled, onCompare, onApply }: { product: LoanProduct; index: number; amount: number; tenure: number; compared: boolean; compareDisabled: boolean; onCompare: () => void; onApply: () => void }) {
  const emi = calcEmi(amount, product.min_interest_rate, tenure);
  return <article className={`product-card ${index === 0 ? 'best-card' : ''}`} data-testid={`card-loan-product-${product.id}`}>
    {index === 0 && <div className="best-label"><Sparkles size={13} /> LOWEST STARTING RATE</div>}
    <div className="product-card-head"><div className="bank-identity">{product.bank.logo_url ? <img src={safeLogo(product)} alt={`${product.bank.name} logo`} data-testid={`img-bank-logo-${product.id}`} /> : <span className="bank-monogram" data-testid={`text-bank-initial-${product.id}`}>{product.bank.name.slice(0, 1)}</span>}<div><b data-testid={`text-bank-name-${product.id}`}>{product.bank.name}</b><small>{product.loan_type} loan</small></div></div><button type="button" className={`compare-check ${compared ? 'checked' : ''}`} onClick={onCompare} disabled={compareDisabled} aria-label={compared ? 'Remove from comparison' : compareDisabled ? 'Comparison is limited to three offers' : 'Add to comparison'} data-testid={`button-compare-${product.id}`}>{compared ? <Check size={14} /> : <Plus size={14} />}</button></div>
    <div className="rate-line"><strong>{product.min_interest_rate}<small>%</small></strong><div><b>starting interest rate</b><span>Up to {product.max_interest_rate}%</span></div></div>
    <div className="product-facts"><div><span>ESTIMATED EMI</span><b data-testid={`text-product-emi-${product.id}`}>{inr(Math.round(emi))}<small>/mo</small></b></div><div><span>MAX. AMOUNT</span><b>{inr(product.max_loan_amount)}</b></div><div><span>MAX. TENURE</span><b>{Math.round(product.max_tenure_months / 12)}<small> yrs</small></b></div></div>
    <div className="fee-line"><span>Processing fee</span><b>{product.processing_fee_desc}</b></div>
    {!!product.features.length && <ul className="card-features">{product.features.slice(0, 2).map((feature, i) => <li key={`${product.id}-feature-${i}`}><Check size={13} />{feature}</li>)}</ul>}
    <button type="button" className="primary-button card-apply" onClick={onApply} data-testid={`button-apply-${product.id}`}>Apply now <ArrowRight size={15} /></button>
  </article>;
}

function CompareRow({ label, products, render }: { label: string; products: LoanProduct[]; render: (product: LoanProduct) => ReactNode }) {
  return <tr><th>{label}</th>{products.map((product) => <td key={product.id}>{render(product)}</td>)}</tr>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
