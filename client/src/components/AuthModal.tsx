import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, LogIn, ShieldCheck, UserPlus, X } from "lucide-react";
import { authCopy, getAuthErrorMessage, validateAuthFields, type AuthFieldErrors, type AuthFields, type AuthMode } from "@/lib/auth";
import type { Language } from "@/lib/i18n";
import { requireSupabase } from "@/lib/supabase";

export type AuthModalProps = {
  lang: Language;
  dark: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

/** Mounted only while open, so closing never retains a password for the next visit. */
export default function AuthModal({ lang, dark, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fields, setFields] = useState<AuthFields>({ name: "", email: "", password: "", confirmation: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const copy = authCopy[lang];
  const signup = mode === "signup";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function updateField(name: keyof AuthFields, value: string) {
    setFields(current => ({ ...current, [name]: value }));
    setFieldErrors(current => ({ ...current, [name]: undefined }));
    setError("");
  }

  function switchMode() {
    if (pending.current) return;
    setMode(current => current === "login" ? "signup" : "login");
    setFields(current => ({ name: current.name, email: current.email, password: "", confirmation: "" }));
    setVisible(false);
    setFieldErrors({});
    setError("");
    setCheckEmail(false);
    emailRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    const errors = validateAuthFields(fields, mode, lang);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (errors.name) nameRef.current?.focus();
      else if (errors.email) emailRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      else confirmationRef.current?.focus();
      return;
    }

    pending.current = true;
    setBusy(true);
    try {
      const client = requireSupabase();
      const credentials = { email: fields.email.trim(), password: fields.password };
      // Account creation is explicit, never an automatic fallback after failed sign-in.
      const { data, error: authError } = signup
        ? await client.auth.signUp({
            ...credentials,
            options: {
              // Supabase otherwise falls back to its dashboard Site URL,
              // which may still be localhost in development.
              emailRedirectTo: `${window.location.origin}/`,
              data: { name: fields.name.trim() },
            },
          })
        : await client.auth.signInWithPassword(credentials);
      if (!mounted.current) return;
      if (authError) {
        setError(getAuthErrorMessage(authError, lang));
        return;
      }
      setFields(current => ({ name: current.name.trim(), email: current.email.trim(), password: "", confirmation: "" }));
      setVisible(false);
      if (data.session) onSuccess();
      else setCheckEmail(true);
    } catch (authError) {
      if (mounted.current) setError(getAuthErrorMessage(authError, lang));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-overlay" />
        <Dialog.Content
          className={`auth-modal ${dark ? "theme-dark" : ""}`}
          dir={lang === "ar" ? "rtl" : "ltr"}
          lang={lang}
          onOpenAutoFocus={event => { event.preventDefault(); emailRef.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus(); }}
        >
          <div className="auth-heading">
            <div className="auth-brand-icon"><ShieldCheck size={24} aria-hidden="true" /></div>
            <div>
              <p className="eyebrow">SAYARTI DZ</p>
              <Dialog.Title>{signup ? copy.signup : copy.login}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-button auth-close" aria-label={copy.close}><X size={19} /></button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="auth-description">{copy.description}</Dialog.Description>
          {checkEmail ? (
            <div className="auth-confirmation">
              <div className="auth-message success" role="status"><CheckCircle2 size={21} aria-hidden="true" /><p>{copy.checkEmail}</p></div>
              <button type="button" className="secondary-button" onClick={() => setCheckEmail(false)}>{copy.retry}</button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
              {signup && <div className="field">
                <label htmlFor="auth-name">{copy.name}</label>
                <input
                  ref={nameRef} id="auth-name" name="name" className="text-input" type="text"
                  autoComplete="name" required value={fields.name} disabled={busy}
                  onChange={event => updateField("name", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
                  placeholder={lang === "ar" ? "مثال: أحمد محمد" : "Your name"}
                />
                {fieldErrors.name && <p id="auth-name-error" className="auth-field-error" role="alert">{fieldErrors.name}</p>}
              </div>}
              <div className="field">
                <label htmlFor="auth-email">{copy.email}</label>
                <input
                  ref={emailRef} id="auth-email" name="email" className="text-input" type="email" dir="ltr"
                  autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required
                  value={fields.email} onChange={event => updateField("email", event.target.value)} disabled={busy}
                  aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                  placeholder="name@example.com"
                />
                {fieldErrors.email && <p id="auth-email-error" className="auth-field-error" role="alert">{fieldErrors.email}</p>}
              </div>
              <div className="field">
                <label htmlFor="auth-password">{copy.password}</label>
                <div className="auth-password-input">
                  <input
                    ref={passwordRef} id="auth-password" name="password" className="text-input" dir="ltr"
                    type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"}
                    required minLength={6} value={fields.password} disabled={busy}
                    onChange={event => updateField("password", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.password)} aria-describedby="auth-password-hint auth-password-error"
                  />
                  <button type="button" className="auth-visibility" onClick={() => setVisible(current => !current)} disabled={busy}
                    aria-label={visible ? copy.hidePassword : copy.showPassword} aria-pressed={visible}>
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p id="auth-password-hint" className="auth-field-hint">{copy.passwordHint}</p>
                <p id="auth-password-error" className="auth-field-error" role={fieldErrors.password ? "alert" : undefined}>{fieldErrors.password}</p>
              </div>
              {signup && (
                <div className="field">
                  <label htmlFor="auth-confirmation">{copy.confirmation}</label>
                  <input
                    ref={confirmationRef} id="auth-confirmation" name="confirmation" className="text-input" dir="ltr"
                    type={visible ? "text" : "password"} autoComplete="new-password" required minLength={6}
                    value={fields.confirmation} onChange={event => updateField("confirmation", event.target.value)} disabled={busy}
                    aria-invalid={Boolean(fieldErrors.confirmation)} aria-describedby={fieldErrors.confirmation ? "auth-confirmation-error" : undefined}
                  />
                  {fieldErrors.confirmation && <p id="auth-confirmation-error" className="auth-field-error" role="alert">{fieldErrors.confirmation}</p>}
                </div>
              )}
              {error && <div className="auth-message error" role="alert"><AlertTriangle size={18} aria-hidden="true" /><p>{error}</p></div>}
              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy ? <span className="spinner" aria-hidden="true" /> : signup ? <UserPlus size={18} /> : <LogIn size={18} />}
                {busy ? copy.loading : error ? copy.retry : signup ? copy.signup : copy.login}
              </button>
            </form>
          )}
          <div className="auth-mode-switch">
            <span>{signup ? copy.hasAccount : copy.noAccount}</span>
            <button type="button" className="text-button" onClick={switchMode} disabled={busy}>{signup ? copy.login : copy.signup}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
