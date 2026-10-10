import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Fuel,
  Globe2,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { LOGIN_REQUEST_EVENT, startLogin } from "@/const";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { languages, t, type Language, type TranslationKey } from "@/lib/i18n";

const PROFILE_DEFAULT = "https://salah-eddine-program.github.io/bt-salahdine.com/";
const demo = {
  vehicles: [{ id: 1, brand: "Renault", model: "Clio 4", year: 2018, fuelType: "diesel", mileage: 185200, plateNumber: "" }],
  maintenance: [{ id: 1, vehicleId: 1, title: "Oil change", serviceDate: "2026-10-08", mileage: 185200, cost: 6500, notes: "Oil and filters changed" }],
  expenses: [{ id: 1, vehicleId: 1, title: "Oil change", category: "service", amount: 6500, expenseDate: "2026-10-08" }, { id: 2, vehicleId: 1, title: "Fuel", category: "fuel", amount: 1500, expenseDate: "2026-10-06" }, { id: 3, vehicleId: 1, title: "Other", category: "other", amount: 450, expenseDate: "2026-10-02" }],
  fuel: [{ id: 1, vehicleId: 1, amount: 2500, liters: 38, pricePerLiter: 6580, mileage: 184900, fuelDate: "2026-10-06" }],
  documents: [{ id: 1, vehicleId: 1, title: "Insurance", expiresOn: "2026-11-20" }, { id: 2, vehicleId: 1, title: "Technical inspection", expiresOn: "2027-03-15" }, { id: 3, vehicleId: 1, title: "Registration card", expiresOn: null }],
  user: { name: "Ahmed", email: "demo@example.com", language: "ar", theme: "light", profileLink: PROFILE_DEFAULT, plan: "free", premiumExpiresAt: null },
};

type Page = "home" | "service" | "expenses" | "fuel" | "documents" | "settings";
type FormKind = "vehicle" | "maintenance" | "expense" | "fuel" | "document" | null;
type FormState = Record<string, string>;

type AppData = typeof demo;

const palette = { dark: "#0B3D46", green: "#13B889", bg: "#F3F7F5", orange: "#F0A43A", red: "#D95E52", blue: "#3888B5" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDzd(value: number, lang: Language) {
  return `${Math.round(value).toLocaleString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-DZ")} ${lang === "ar" ? "دج" : "DZD"}`;
}

function formatDate(value: string | null | undefined, lang: Language) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-DZ", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00`).valueOf();
  return Math.ceil((target - new Date(`${today()}T00:00:00`).valueOf()) / 86400000);
}

function Logo({ size = 52 }: { size?: number }) {
  return <img className="logo-mark" style={{ width: size, height: size }} src={`${import.meta.env.BASE_URL}assets/sayarti-mark.svg`} alt="Sayarti DZ" />;
}

function Landing({ lang, onLang, onDemo, onLogin }: { lang: Language; onLang: (l: Language) => void; onDemo: () => void; onLogin: () => void }) {
  const tr = (key: TranslationKey) => t(lang, key);
  return <main className="landing" dir={lang === "ar" ? "rtl" : "ltr"}>
    <div className="landing-glow" />
    <header className="landing-header"><div className="brand"><Logo size={48} /><div><strong>{tr("brand")}</strong><span>{tr("tagline")}</span></div></div><div className="landing-tools"><LanguageSelect value={lang} onChange={onLang} light /><button className="icon-button ghost" onClick={onDemo} aria-label={tr("demo")}><Sparkles size={18} /></button></div></header>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">{tr("brandDescription")}</p><h1>{tr("welcome")}</h1><p className="hero-subtitle">{tr("tagline")}</p><div className="hero-actions"><button className="primary-button" onClick={onLogin}><LogIn size={18} />{tr("loginCta")}</button><button className="secondary-button" onClick={onDemo}><Sparkles size={18} />{tr("useDemo")}</button></div><p className="safe-note"><ShieldCheck size={16} />{tr("signInToSave")}</p></div>
      <div className="hero-card"><div className="hero-card-top"><span>{tr("sampleData")}</span><span className="status-pill ok"><CheckCircle2 size={14} />{tr("valid")}</span></div><div className="hero-car"><div className="gauge"><span>68%</span><small>{tr("vehicle")}</small></div><div><h2>Renault Clio 4</h2><p>2018 · Diesel</p><strong>185,200 <small>KM</small></strong></div></div><div className="hero-mini-grid"><div><Wrench size={16} /><span>{tr("nextService")}</span><b>1,200 {tr("km")}</b></div><div><CircleDollarSign size={16} /><span>{tr("monthlySpend")}</span><b>8,450 {lang === "ar" ? "دج" : "DZD"}</b></div></div><p className="demo-note">{tr("sampleNote")}</p></div>
    </section>
    <section className="landing-features"><div><Wrench /><strong>{tr("service")}</strong><span>{tr("serviceHistory")}</span></div><div><CircleDollarSign /><strong>{tr("expenses")}</strong><span>{tr("yearlySpend")}</span></div><div><FileText /><strong>{tr("documents")}</strong><span>{tr("reminders")}</span></div></section>
  </main>;
}

function LanguageSelect({ value, onChange, light = false }: { value: Language; onChange: (l: Language) => void; light?: boolean }) {
  return <label className={`language-select ${light ? "on-light" : ""}`}><Globe2 size={16} /><select value={value} onChange={e => onChange(e.target.value as Language)} aria-label="Language"><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></select><ChevronDown size={14} /></label>;
}

export default function Home() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>("home");
  const [lang, setLang] = useState<Language>("ar");
  const [dark, setDark] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [form, setForm] = useState<FormState>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | undefined>();
  const [toast, setToast] = useState("");
  const [setupData, setSetupData] = useState<AppData | undefined>();
  const onboardingOpened = useRef(false);
  const tr = (key: TranslationKey) => t(lang, key);
  const hasSession = Boolean(auth.session);
  const dataQuery = trpc.app.data.useQuery(undefined, { enabled: hasSession, retry: false });
  const utils = trpc.useUtils();
  const settingsMutation = trpc.app.settings.useMutation({ onSuccess: () => { dataQuery.refetch(); showToast(tr("profileSaved")); } });
  const vehicleCreate = trpc.app.vehicle.create.useMutation({
    onSuccess: (result) => { setSetupData(result as AppData); dataQuery.refetch(); closeForm(); showToast(tr("carSaved")); },
    onError: () => showToast(lang === "ar" ? "تعذر حفظ السيارة. تحقق من الاتصال وحاول مرة أخرى." : lang === "fr" ? "Impossible d’enregistrer le véhicule. Réessayez." : "The vehicle could not be saved. Please try again."),
  });
  const vehicleUpdate = trpc.app.vehicle.update.useMutation({ onSuccess: () => { dataQuery.refetch(); closeForm(); showToast(tr("carSaved")); } });
  const maintenanceCreate = trpc.app.maintenance.create.useMutation({ onSuccess: () => { dataQuery.refetch(); closeForm(); showToast(tr("serviceSaved")); } });
  const expenseCreate = trpc.app.expense.create.useMutation({ onSuccess: () => { dataQuery.refetch(); closeForm(); showToast(tr("expenseSaved")); } });
  const fuelCreate = trpc.app.fuel.create.useMutation({ onSuccess: () => { dataQuery.refetch(); closeForm(); showToast(tr("fuelSaved")); } });
  const documentCreate = trpc.app.document.create.useMutation({ onSuccess: () => { dataQuery.refetch(); closeForm(); showToast(tr("documentSaved")); } });
  const isDemo = !hasSession && demoMode;
  const data = (isDemo ? demo : (setupData ?? dataQuery.data)) as AppData | undefined;
  const currentVehicle = data?.vehicles?.find(v => v.id === selectedVehicleId) ?? data?.vehicles?.[0];
  const currentId = currentVehicle?.id;
  const openAuth = useCallback(() => {
    setFormKind(null);
    setForm({});
    startLogin(() => setAuthOpen(true));
  }, []);

  useEffect(() => {
    const savedLang = localStorage.getItem("sayarti.language") as Language | null;
    const savedTheme = localStorage.getItem("sayarti.theme");
    if (savedLang && languages.includes(savedLang)) setLang(savedLang);
    if (savedTheme === "dark") setDark(true);
  }, []);
  useEffect(() => { document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; document.documentElement.lang = lang; localStorage.setItem("sayarti.language", lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("sayarti.theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { const user = data?.user; if (user?.language && languages.includes(user.language as Language)) setLang(user.language as Language); if (user?.theme === "dark") setDark(true); }, [data?.user]);
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); } }, [toast]);
  useEffect(() => {
    window.addEventListener(LOGIN_REQUEST_EVENT, openAuth);
    return () => window.removeEventListener(LOGIN_REQUEST_EVENT, openAuth);
  }, [openAuth]);
  useEffect(() => {
    if (auth.isAuthenticated) { setAuthOpen(false); setDemoMode(false); }
    else onboardingOpened.current = false;
  }, [auth.isAuthenticated]);
  useEffect(() => {
    // New accounts should land in a useful first step, not an empty dashboard.
    if (auth.isAuthenticated && dataQuery.data && dataQuery.data.vehicles.length === 0 && !onboardingOpened.current) {
      onboardingOpened.current = true;
      openForm("vehicle");
    }
  }, [auth.isAuthenticated, dataQuery.data]);

  function showToast(message: string) { setToast(message); }
  function setLanguage(next: Language) { setLang(next); if (auth.isAuthenticated && !isDemo) settingsMutation.mutate({ language: next }); }
  function setTheme(next: boolean) { setDark(next); if (auth.isAuthenticated && !isDemo) settingsMutation.mutate({ theme: next ? "dark" : "light" }); }
  function openForm(kind: Exclude<FormKind, null>, item?: Record<string, unknown>) {
    setFormKind(kind);
    setForm({
      id: item?.id ? String(item.id) : "",
      title: typeof item?.title === "string" ? item.title : kind === "maintenance" ? tr("oilChange") : "",
      brand: typeof item?.brand === "string" ? item.brand : "",
      model: typeof item?.model === "string" ? item.model : "",
      year: item?.year ? String(item.year) : "",
      fuelType: typeof item?.fuelType === "string" ? item.fuelType : "diesel",
      mileage: item?.mileage ? String(item.mileage) : currentVehicle?.mileage ? String(currentVehicle.mileage) : "",
      plateNumber: typeof item?.plateNumber === "string" ? item.plateNumber : "",
      date: typeof item?.serviceDate === "string" ? item.serviceDate.slice(0, 10) : today(),
      amount: item?.amount ? String(item.amount) : item?.cost ? String(item.cost) : "",
      notes: typeof item?.notes === "string" ? item.notes : "",
      category: typeof item?.category === "string" ? item.category : "other",
      liters: item?.liters ? String(item.liters) : "",
      pricePerLiter: item?.pricePerLiter ? String(Number(item.pricePerLiter) / 100) : "",
      expiresOn: typeof item?.expiresOn === "string" ? item.expiresOn.slice(0, 10) : "",
    });
  }
  function closeForm() { setFormKind(null); setForm({}); }
  function field(name: string, value: string) { setForm(current => ({ ...current, [name]: value })); }
  function numberValue(name: string) { return Number(form[name] || 0); }
  function requireVehicle() { if (!auth.isAuthenticated) { showToast(tr("signInToSave")); openAuth(); return false; } if (!currentId) { showToast(tr("noVehicle")); return false; } return true; }
  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!auth.isAuthenticated && !isDemo) { openAuth(); return; }
    if (formKind === "vehicle") {
      if (!form.brand || !form.model || !form.year) return showToast(tr("required"));
      const value = { brand: form.brand, model: form.model, year: numberValue("year"), fuelType: (form.fuelType || "diesel") as "diesel" | "petrol" | "lpg" | "electric", mileage: numberValue("mileage"), plateNumber: form.plateNumber || undefined };
      if (isDemo) { closeForm(); showToast(tr("carSaved")); return; }
      if (form.id) vehicleUpdate.mutate({ id: Number(form.id), ...value }); else vehicleCreate.mutate(value);
      return;
    }
    if (!requireVehicle()) return;
    if (isDemo) { closeForm(); showToast(tr("saved")); return; }
    if (formKind === "maintenance") maintenanceCreate.mutate({ vehicleId: currentId!, title: form.title || tr("oilChange"), serviceDate: form.date || today(), mileage: numberValue("mileage"), cost: numberValue("amount"), notes: form.notes || undefined });
    if (formKind === "expense") expenseCreate.mutate({ vehicleId: currentId!, title: form.title || tr("other"), category: (form.category || "other") as "service" | "fuel" | "parts" | "other", amount: numberValue("amount"), expenseDate: form.date || today() });
    if (formKind === "fuel") fuelCreate.mutate({ vehicleId: currentId!, amount: numberValue("amount"), liters: numberValue("liters"), pricePerLiter: Math.round(numberValue("pricePerLiter") * 100), mileage: numberValue("mileage"), fuelDate: form.date || today() });
    if (formKind === "document") documentCreate.mutate({ vehicleId: currentId!, title: form.title || tr("documents"), expiresOn: form.expiresOn || null });
  }
  function saveProfileLink() {
    const value = form.profileLink?.trim() ?? "";
    if (value && !/^https:\/\//i.test(value)) return showToast(tr("invalidLink"));
    if (isDemo) { localStorage.setItem("sayarti.profileLink", value); showToast(tr("profileSaved")); return; }
    if (auth.isAuthenticated) settingsMutation.mutate({ profileLink: value || null }); else showToast(tr("signInToSave"));
  }
  function profileLink() { return (data?.user?.profileLink || (isDemo ? localStorage.getItem("sayarti.profileLink") : null) || PROFILE_DEFAULT); }

  function completeFirstSetup(values: { name: string; brand: string; model: string; year: string; fuelType: string; mileage: string; plateNumber: string }) {
    const name = values.name.trim();
    if (name.length < 2 || !values.brand.trim() || !values.model.trim() || !values.year || !values.mileage) {
      showToast(tr("required"));
      return;
    }
    settingsMutation.mutate({ name });
    vehicleCreate.mutate({
      brand: values.brand.trim(), model: values.model.trim(), year: Number(values.year),
      fuelType: values.fuelType as "diesel" | "petrol" | "lpg" | "electric",
      mileage: Number(values.mileage), plateNumber: values.plateNumber.trim() || undefined,
    });
  }

  const authModal = authOpen && <AuthModal lang={lang} dark={dark} onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); setDemoMode(false); closeForm(); setSelectedVehicleId(undefined); }} />;
  if ((auth.loading || (hasSession && dataQuery.isLoading)) && !demoMode) return <><div className="loading-screen"><Logo size={66} /><span>{tr("brand")}</span></div>{authModal}</>;
  if (!hasSession && !demoMode) return <><Landing lang={lang} onLang={setLanguage} onDemo={() => setDemoMode(true)} onLogin={openAuth} />{authModal}</>;

  const busy = vehicleCreate.isPending || vehicleUpdate.isPending || maintenanceCreate.isPending || expenseCreate.isPending || fuelCreate.isPending || documentCreate.isPending;
  const monthlySpend = (data?.expenses ?? []).reduce((sum, item) => sum + item.amount, 0) + (data?.maintenance ?? []).reduce((sum, item) => sum + item.cost, 0);
  const yearlySpend = monthlySpend;
  const lastFuel = data?.fuel?.[0];
  const nextDocument = data?.documents?.find(d => (daysUntil(d.expiresOn) ?? 9999) >= 0);
  const mutationError = [vehicleCreate, vehicleUpdate, maintenanceCreate, expenseCreate, fuelCreate, documentCreate].find(m => m.error)?.error;
  if (hasSession && !setupData && (!dataQuery.data || dataQuery.data.vehicles.length === 0)) {
    return <div className={`app-shell ${dark ? "theme-dark" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
      <main className="content first-setup-content"><FirstSetup lang={lang} tr={tr} initialName={dataQuery.data?.user?.name ?? (auth.session?.user.user_metadata?.name as string | undefined) ?? ""} busy={vehicleCreate.isPending || settingsMutation.isPending} onSubmit={completeFirstSetup} /></main>
      {authModal}
    </div>;
  }
  return <div className={`app-shell ${dark ? "theme-dark" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
    <aside className="sidebar"><div className="brand"><Logo size={44} /><div><strong>{tr("brand")}</strong><span>{tr("tagline")}</span></div></div><nav>{([{ id: "home", icon: BarChart3, key: "home" }, { id: "service", icon: Wrench, key: "service" }, { id: "expenses", icon: CircleDollarSign, key: "expenses" }, { id: "fuel", icon: Fuel, key: "fuel" }, { id: "documents", icon: FileText, key: "documents" }, { id: "settings", icon: Settings2, key: "settings" }] as const).map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id as Page)}><Icon size={19} /><span>{tr(item.key as TranslationKey)}</span></button>; })}</nav><div className="sidebar-bottom"><div className="sidebar-profile"><div className="avatar">{(data?.user?.name || "S").slice(0, 1).toUpperCase()}</div><div><strong>{data?.user?.name || tr("sampleData")}</strong><span>{isDemo ? tr("sampleData") : data?.user?.email || ""}</span></div></div>{isDemo ? <button className="sidebar-login" onClick={openAuth}><LogIn size={16} />{tr("login")}</button> : <button className="sidebar-login" onClick={() => auth.logout()}><LogOut size={16} />{tr("logout")}</button>}</div></aside>
    <main className="content"><header className="topbar"><div className="mobile-brand"><Logo size={38} /><strong>{tr("brand")}</strong></div><div className="topbar-actions"><LanguageSelect value={lang} onChange={setLanguage} /><button className="icon-button" onClick={() => setTheme(!dark)} aria-label={tr("theme")}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="menu-button"><Menu size={20} /></button></div></header>{isDemo && <div className="demo-banner"><Sparkles size={16} /><span><b>{tr("sampleData")}</b> — {tr("sampleNote")}</span><button onClick={openAuth}>{tr("login")}</button></div>}{mutationError && <div className="error-banner"><AlertTriangle size={16} />{mutationError.message}</div>}
      {page === "home" && <Dashboard data={data} currentVehicle={currentVehicle} monthlySpend={monthlySpend} nextDocument={nextDocument} lastFuel={lastFuel} lang={lang} tr={tr} onAdd={openForm} onPage={setPage} onVehicle={() => openForm("vehicle")} onEditVehicle={() => openForm("vehicle", currentVehicle)} />}
      {page === "service" && <RecordsPage type="service" data={data} currentId={currentId} lang={lang} tr={tr} onAdd={() => openForm("maintenance")} />}
      {page === "expenses" && <RecordsPage type="expenses" data={data} currentId={currentId} lang={lang} tr={tr} onAdd={() => openForm("expense")} />}
      {page === "fuel" && <RecordsPage type="fuel" data={data} currentId={currentId} lang={lang} tr={tr} onAdd={() => openForm("fuel")} />}
      {page === "documents" && <RecordsPage type="documents" data={data} currentId={currentId} lang={lang} tr={tr} onAdd={() => openForm("document")} />}
      {page === "settings" && <Settings data={data} lang={lang} tr={tr} isDemo={isDemo} onLanguage={setLanguage} dark={dark} onTheme={setTheme} profileLink={profileLink()} onSaveLink={saveProfileLink} onProfileField={value => field("profileLink", value)} />}
    </main>
    <div className="mobile-nav">{([{ id: "home", icon: BarChart3, key: "home" }, { id: "service", icon: Wrench, key: "service" }, { id: "expenses", icon: CircleDollarSign, key: "expenses" }, { id: "documents", icon: FileText, key: "documents" }, { id: "settings", icon: Settings2, key: "settings" }] as const).map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id as Page)}><Icon size={19} /><span>{tr(item.key as TranslationKey)}</span></button>; })}</div>
    {formKind && <Modal kind={formKind} form={form} setForm={field} tr={tr} onClose={closeForm} onSubmit={submitForm} busy={busy} />}
    {authModal}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function PageHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) { return <div className="page-header"><div><p className="eyebrow">SAYARTI DZ</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="primary-button" onClick={onAction}><Plus size={18} />{action}</button>}</div>; }

function FirstSetup({ lang, tr, initialName, busy, onSubmit }: { lang: Language; tr: (k: TranslationKey) => string; initialName: string; busy: boolean; onSubmit: (values: { name: string; brand: string; model: string; year: string; fuelType: string; mileage: string; plateNumber: string }) => void }) {
  const [values, setValues] = useState({ name: initialName, brand: "", model: "", year: "", fuelType: "diesel", mileage: "", plateNumber: "" });
  const set = (name: string, value: string) => setValues(current => ({ ...current, [name]: value }));
  const label = lang === "ar" ? { name: "اسمك الكامل", brand: "العلامة التجارية", model: "نوع / موديل السيارة", year: "سنة الصنع", fuel: "نوع الوقود", mileage: "عداد الكيلومترات", plate: "رقم التسجيل" } : lang === "fr" ? { name: "Votre nom complet", brand: "Marque", model: "Modèle", year: "Année", fuel: "Carburant", mileage: "Kilométrage", plate: "Immatriculation" } : { name: "Your full name", brand: "Make", model: "Model", year: "Year", fuel: "Fuel type", mileage: "Odometer", plate: "Plate number" };
  return <div className="page first-setup-page"><div className="first-setup-intro"><div className="empty-icon"><CarFront size={30} /></div><p className="eyebrow">SAYARTI DZ</p><h1>{lang === "ar" ? "لنبدأ بإعداد سيارتك" : lang === "fr" ? "Configurons votre véhicule" : "Let’s set up your vehicle"}</h1><p>{lang === "ar" ? "أدخل معلوماتك الأساسية وسيارتك الأولى حتى تصبح لوحة القيادة جاهزة للاستخدام." : lang === "fr" ? "Ajoutez vos informations et votre premier véhicule pour activer votre tableau de bord." : "Add your details and first vehicle to activate your dashboard."}</p></div><section className="panel first-setup-card"><form onSubmit={event => { event.preventDefault(); onSubmit(values); }}><div className="form-grid"><Field label={label.name} name="name" value={values.name} set={set} required /><Field label={label.brand} name="brand" value={values.brand} set={set} required /><Field label={label.model} name="model" value={values.model} set={set} required /><Field label={label.year} name="year" value={values.year} set={set} type="number" required /><Field label={label.mileage} name="mileage" value={values.mileage} set={set} type="number" required /><Field label={label.plate} name="plateNumber" value={values.plateNumber} set={set} /><SelectField label={label.fuel} name="fuelType" value={values.fuelType} set={set} options={[["diesel", tr("diesel")], ["petrol", tr("petrol")], ["lpg", tr("lpg")], ["electric", tr("electric")]]} /></div><div className="modal-actions"><button className="primary-button" disabled={busy} type="submit">{busy ? <span className="spinner" /> : <CheckCircle2 size={17} />}{lang === "ar" ? "حفظ وبدء الاستخدام" : lang === "fr" ? "Enregistrer et commencer" : "Save and continue"}</button></div></form></section></div>;
}

function Dashboard({ data, currentVehicle, monthlySpend, nextDocument, lastFuel, lang, tr, onAdd, onPage, onVehicle, onEditVehicle }: { data?: AppData; currentVehicle?: AppData["vehicles"][number]; monthlySpend: number; nextDocument?: AppData["documents"][number]; lastFuel?: AppData["fuel"][number]; lang: Language; tr: (k: TranslationKey) => string; onAdd: (kind: Exclude<FormKind, null>) => void; onPage: (p: Page) => void; onVehicle: () => void; onEditVehicle: () => void }) {
  if (!currentVehicle) return <div className="empty-state full"><div className="empty-icon"><CarFront size={28} /></div><h2>{tr("noVehicle")}</h2><p>{tr("startByVehicle")}</p><button className="primary-button" onClick={onVehicle}><Plus size={18} />{tr("addVehicle")}</button></div>;
  const services = data?.maintenance ?? [];
  const expenses = data?.expenses ?? [];
  return <div className="page"><PageHeader title={`${tr("hello")}, ${data?.user?.name || ""}`} subtitle={tr("tagline")} action={tr("addVehicle")} onAction={onVehicle} /><section className="vehicle-hero"><div className="vehicle-visual"><div className="gauge-ring"><span>68%</span><small>{tr("vehicle")}</small></div><div><span className="eyebrow">{tr("currentVehicle")}</span><h2>{currentVehicle.brand} {currentVehicle.model}</h2><p>{currentVehicle.year} · {tr(currentVehicle.fuelType as TranslationKey)} · {currentVehicle.mileage.toLocaleString(lang === "ar" ? "ar-DZ" : "en-DZ")} {tr("km")}</p></div></div><div className="vehicle-status"><span className="status-pill ok"><CheckCircle2 size={14} />{tr("valid")}</span><button className="text-button" onClick={onEditVehicle}>{tr("edit")}</button></div></section><section className="stats-grid"><StatCard icon={Wrench} label={tr("nextService")} value="1,200" unit={tr("km")} tone="green" onClick={() => onPage("service")} /><StatCard icon={CircleDollarSign} label={tr("monthlySpend")} value={formatDzd(monthlySpend, lang)} tone="amber" onClick={() => onPage("expenses")} /><StatCard icon={Fuel} label={tr("lastFill")} value={lastFuel ? formatDzd(lastFuel.amount, lang) : "—"} tone="blue" onClick={() => onPage("fuel")} /><StatCard icon={FileText} label={tr("reminders")} value={nextDocument ? formatDate(nextDocument.expiresOn, lang) : "—"} tone="purple" onClick={() => onPage("documents")} /></section><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">{tr("service")}</p><h2>{tr("serviceHistory")}</h2></div><button className="text-button" onClick={() => onPage("service")}>{tr("history")}</button></div>{services.length ? services.slice(0, 3).map(item => <RecordRow key={item.id} icon={<Wrench size={18} />} title={item.title} meta={`${formatDate(item.serviceDate, lang)} · ${item.mileage.toLocaleString()} ${tr("km")}`} value={formatDzd(item.cost, lang)} />) : <SmallEmpty text={tr("noData")} />}</section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">{tr("quickActions")}</p><h2>{tr("addRecord")}</h2></div></div><div className="quick-actions"><button onClick={() => onAdd("maintenance")}><Wrench size={18} /><span>{tr("addService")}</span></button><button onClick={() => onAdd("expense")}><CircleDollarSign size={18} /><span>{tr("addExpense")}</span></button><button onClick={() => onAdd("fuel")}><Fuel size={18} /><span>{tr("addFuel")}</span></button><button onClick={() => onAdd("document")}><FileText size={18} /><span>{tr("addDocument")}</span></button></div></section></div><section className="premium-card"><div className="premium-icon"><Sparkles size={22} /></div><div><span className="eyebrow">{tr("premium")}</span><h2>{tr("premiumPrice")}</h2><p>{tr("premiumDesc")}</p></div><div className="premium-note"><b>{tr("paymentOff")}</b><span>{tr("paymentNote")}</span></div></section></div>;
}

function StatCard({ icon: Icon, label, value, unit, tone, onClick }: { icon: typeof Wrench; label: string; value: string; unit?: string; tone: string; onClick: () => void }) { return <button className={`stat-card ${tone}`} onClick={onClick}><span className="stat-icon"><Icon size={18} /></span><span className="stat-label">{label}</span><strong>{value} {unit && <small>{unit}</small>}</strong><span className="stat-arrow">›</span></button>; }
function RecordRow({ icon, title, meta, value }: { icon: React.ReactNode; title: string; meta: string; value: string }) { return <div className="record-row"><span className="record-icon">{icon}</span><span className="record-main"><strong>{title}</strong><small>{meta}</small></span><b>{value}</b></div>; }
function SmallEmpty({ text }: { text: string }) { return <div className="small-empty"><ClipboardList size={18} />{text}</div>; }

function RecordsPage({ type, data, currentId, lang, tr, onAdd }: { type: "service" | "expenses" | "fuel" | "documents"; data?: AppData; currentId?: number; lang: Language; tr: (k: TranslationKey) => string; onAdd: () => void }) {
  const items = type === "service" ? data?.maintenance?.filter(x => x.vehicleId === currentId) : type === "expenses" ? data?.expenses?.filter(x => x.vehicleId === currentId) : type === "fuel" ? data?.fuel?.filter(x => x.vehicleId === currentId) : data?.documents?.filter(x => x.vehicleId === currentId);
  const title = type === "service" ? tr("serviceHistory") : type === "expenses" ? tr("expenses") : type === "fuel" ? tr("fuel") : tr("documents");
  const action = type === "service" ? tr("addService") : type === "expenses" ? tr("addExpense") : type === "fuel" ? tr("addFuel") : tr("addDocument");
  return <div className="page"><PageHeader title={title} subtitle={tr("dashboard")} action={action} onAction={onAdd} /><section className="panel record-list">{items?.length ? items.map(item => { if (type === "service") { const x = item as AppData["maintenance"][number]; return <RecordRow key={x.id} icon={<Wrench size={18} />} title={x.title} meta={`${formatDate(x.serviceDate, lang)} · ${x.mileage.toLocaleString()} ${tr("km")}`} value={formatDzd(x.cost, lang)} />; } if (type === "expenses") { const x = item as AppData["expenses"][number]; return <RecordRow key={x.id} icon={<CircleDollarSign size={18} />} title={x.title} meta={`${x.category} · ${formatDate(x.expenseDate, lang)}`} value={formatDzd(x.amount, lang)} />; } if (type === "fuel") { const x = item as AppData["fuel"][number]; return <RecordRow key={x.id} icon={<Fuel size={18} />} title={tr("lastFill")} meta={`${formatDate(x.fuelDate, lang)} · ${x.liters} L · ${x.mileage.toLocaleString()} ${tr("km")}`} value={formatDzd(x.amount, lang)} />; } const x = item as AppData["documents"][number]; const days = daysUntil(x.expiresOn); return <RecordRow key={x.id} icon={days !== null && days < 30 ? <AlertTriangle size={18} /> : <FileText size={18} />} title={x.title} meta={`${tr("expires")}: ${formatDate(x.expiresOn, lang)}`} value={days === null ? tr("stored") : days < 30 ? tr("soon") : tr("valid")} />; }) : <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><h2>{tr("noData")}</h2><p>{tr("addRecord")}</p><button className="primary-button" onClick={onAdd}><Plus size={18} />{action}</button></div>}</section></div>;
}

function Settings({ data, lang, tr, isDemo, onLanguage, dark, onTheme, profileLink, onSaveLink, onProfileField }: { data?: AppData; lang: Language; tr: (k: TranslationKey) => string; isDemo: boolean; onLanguage: (l: Language) => void; dark: boolean; onTheme: (v: boolean) => void; profileLink: string; onSaveLink: () => void; onProfileField: (v: string) => void }) {
  const [value, setValue] = useState(profileLink);
  useEffect(() => setValue(profileLink), [profileLink]);
  return <div className="page"><PageHeader title={tr("settings")} subtitle={tr("account")} /><div className="settings-grid"><section className="panel settings-card"><div className="settings-title"><div className="avatar large">{(data?.user?.name || "S").slice(0, 1).toUpperCase()}</div><div><h2>{data?.user?.name || tr("sampleData")}</h2><p>{data?.user?.email || tr("sampleNote")}</p></div></div><label className="form-label">{tr("language")}</label><LanguageSelect value={lang} onChange={onLanguage} /><label className="form-label">{tr("theme")}</label><button className="setting-toggle" onClick={() => onTheme(!dark)}><span>{dark ? <Moon size={17} /> : <Sun size={17} />}{dark ? tr("dark") : tr("light")}</span><span className={`toggle ${dark ? "on" : ""}`}><i /></span></button></section><section className="panel settings-card"><div className="panel-heading"><div><p className="eyebrow">{tr("profileLink")}</p><h2>{tr("openProfile")}</h2></div><Globe2 size={22} color={palette.green} /></div><input className="text-input" value={value} onChange={e => { setValue(e.target.value); onProfileField(e.target.value); }} placeholder={tr("profileHint")} type="url" /><div className="button-row"><button className="secondary-button" onClick={onSaveLink}>{tr("save")}</button><button className="text-button" onClick={() => window.open(value, "_blank", "noopener,noreferrer")}>{tr("openProfile")}</button></div>{isDemo && <p className="field-hint">{tr("sampleNote")}</p>}</section><section className="panel premium-settings"><div className="premium-icon"><Sparkles size={20} /></div><div><span className="eyebrow">{tr("premium")}</span><h2>{tr("premiumPrice")}</h2><p>{tr("premiumDesc")}</p><small>{tr("paymentOff")}</small></div></section></div></div>;
}

function Modal({ kind, form, setForm, tr, onClose, onSubmit, busy }: { kind: Exclude<FormKind, null>; form: FormState; setForm: (name: string, value: string) => void; tr: (k: TranslationKey) => string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; busy: boolean }) {
  const title = kind === "vehicle" ? tr("addVehicle") : kind === "maintenance" ? tr("addService") : kind === "expense" ? tr("addExpense") : kind === "fuel" ? tr("addFuel") : tr("addDocument");
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-header"><div><p className="eyebrow">SAYARTI DZ</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={onSubmit}><div className="form-grid">{kind === "vehicle" ? <><Field label={tr("make")} name="brand" value={form.brand} set={setForm} required /><Field label={tr("model")} name="model" value={form.model} set={setForm} required /><Field label={tr("year")} name="year" value={form.year} set={setForm} type="number" required /><Field label={tr("mileage")} name="mileage" value={form.mileage} set={setForm} type="number" required /><Field label={tr("plate")} name="plateNumber" value={form.plateNumber} set={setForm} /><SelectField label={tr("fuelType")} name="fuelType" value={form.fuelType} set={setForm} options={[["diesel", tr("diesel")], ["petrol", tr("petrol")], ["lpg", tr("lpg")], ["electric", tr("electric")]]} /></> : <><Field label={tr("title")} name="title" value={form.title} set={setForm} required />{kind === "maintenance" && <><Field label={tr("date")} name="date" value={form.date} set={setForm} type="date" required /><Field label={tr("mileage")} name="mileage" value={form.mileage} set={setForm} type="number" required /><Field label={tr("cost")} name="amount" value={form.amount} set={setForm} type="number" required /><TextArea label={tr("notes")} name="notes" value={form.notes} set={setForm} /></>}{kind === "expense" && <><Field label={tr("amount")} name="amount" value={form.amount} set={setForm} type="number" required /><Field label={tr("date")} name="date" value={form.date} set={setForm} type="date" required /><SelectField label={tr("category")} name="category" value={form.category} set={setForm} options={[["service", tr("serviceCategory")], ["fuel", tr("fuelCategory")], ["parts", tr("parts")], ["other", tr("other")]]} /></>}{kind === "fuel" && <><Field label={tr("amount")} name="amount" value={form.amount} set={setForm} type="number" required /><Field label={tr("liters")} name="liters" value={form.liters} set={setForm} type="number" required /><Field label={tr("priceLiter")} name="pricePerLiter" value={form.pricePerLiter} set={setForm} type="number" required /><Field label={tr("mileage")} name="mileage" value={form.mileage} set={setForm} type="number" required /><Field label={tr("date")} name="date" value={form.date} set={setForm} type="date" required /></>}{kind === "document" && <Field label={tr("expires")} name="expiresOn" value={form.expiresOn} set={setForm} type="date" />}</>}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>{tr("cancel")}</button><button className="primary-button" disabled={busy} type="submit">{busy ? <span className="spinner" /> : <CheckCircle2 size={17} />}{tr("save")}</button></div></form></div></div>;
}
function Field({ label, name, value, set, type = "text", required = false }: { label: string; name: string; value?: string; set: (n: string, v: string) => void; type?: string; required?: boolean }) { return <label className="field"><span>{label}</span><input className="text-input" type={type} value={value ?? ""} onChange={e => set(name, e.target.value)} required={required} /></label>; }
function TextArea({ label, name, value, set }: { label: string; name: string; value?: string; set: (n: string, v: string) => void }) { return <label className="field wide"><span>{label}</span><textarea className="text-input" value={value ?? ""} onChange={e => set(name, e.target.value)} rows={3} /></label>; }
function SelectField({ label, name, value, set, options }: { label: string; name: string; value?: string; set: (n: string, v: string) => void; options: string[][] }) { return <label className="field"><span>{label}</span><select className="text-input" value={value ?? options[0]?.[0]} onChange={e => set(name, e.target.value)}>{options.map(([v, labelText]) => <option key={v} value={v}>{labelText}</option>)}</select></label>; }
