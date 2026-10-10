import type { Language } from "@/lib/i18n";

export type AuthMode = "login" | "signup";
export type AuthFields = { email: string; password: string; confirmation: string };
export type AuthFieldErrors = Partial<Record<keyof AuthFields, string>>;

export const authCopy = {
  ar: {
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    description: "احفظ بيانات سيارتك بأمان باستخدام بريدك الإلكتروني وكلمة المرور.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmation: "تأكيد كلمة المرور",
    passwordHint: "استخدم 6 أحرف على الأقل.",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    close: "إغلاق",
    loading: "جارٍ المتابعة…",
    noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب بالفعل؟",
    retry: "إعادة المحاولة",
    checkEmail: "تم إرسال طلب إنشاء الحساب. تحقق من بريدك، بما فيه الرسائل غير المرغوب فيها، لتأكيد الحساب ثم سجّل الدخول. إن كان لديك حساب بالفعل، استخدم كلمة المرور الصحيحة.",
    invalidEmail: "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.com.",
    shortPassword: "يجب ألا تقل كلمة المرور عن 6 أحرف.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة. تحقق منهما وحاول مجددًا.",
    unconfirmed: "أكّد بريدك الإلكتروني عبر رسالة التأكيد قبل تسجيل الدخول.",
    weakPassword: "كلمة المرور لا تستوفي متطلبات الأمان. جرّب كلمة أطول وأكثر تنوعًا.",
    rateLimited: "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
    signupFailed: "تعذر إنشاء الحساب. إن كان لديك حساب، جرّب تسجيل الدخول، أو استخدم بريدًا آخر.",
    unavailable: "خدمة تسجيل الدخول غير متاحة الآن. حاول مرة أخرى لاحقًا.",
    connectionError: "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من اتصالك وأعد المحاولة.",
    genericError: "لم نتمكن من إتمام الطلب. تحقق من البيانات وأعد المحاولة.",
  },
  en: {
    login: "Sign in",
    signup: "Create account",
    description: "Keep your car data safe with your email and password.",
    email: "Email address",
    password: "Password",
    confirmation: "Confirm password",
    passwordHint: "Use at least 6 characters.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    close: "Close",
    loading: "Please wait…",
    noAccount: "New here?",
    hasAccount: "Already have an account?",
    retry: "Try again",
    checkEmail: "Your account request was submitted. Check your inbox and spam folder to confirm your email, then sign in. If you already have an account, use your existing password.",
    invalidEmail: "Enter a valid email address, such as name@example.com.",
    shortPassword: "Your password must contain at least 6 characters.",
    mismatch: "The passwords do not match.",
    invalidCredentials: "The email or password is incorrect. Check both and try again.",
    unconfirmed: "Confirm your email using the confirmation message before signing in.",
    weakPassword: "This password does not meet the security requirements. Try a longer, more varied password.",
    rateLimited: "Too many attempts. Please wait a little before trying again.",
    signupFailed: "We could not create the account. If you have an account, try signing in, or use another email.",
    unavailable: "Sign-in is currently unavailable. Please try again later.",
    connectionError: "Could not connect to the sign-in service. Check your connection and try again.",
    genericError: "We could not complete the request. Check your details and try again.",
  },
  fr: {
    login: "Connexion",
    signup: "Créer un compte",
    description: "Protégez les données de votre voiture avec votre e-mail et votre mot de passe.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmation: "Confirmer le mot de passe",
    passwordHint: "Utilisez au moins 6 caractères.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    close: "Fermer",
    loading: "Veuillez patienter…",
    noAccount: "Pas encore de compte ?",
    hasAccount: "Vous avez déjà un compte ?",
    retry: "Réessayer",
    checkEmail: "Votre demande de compte a été envoyée. Consultez votre boîte de réception et vos courriers indésirables pour confirmer votre e-mail, puis connectez-vous. Si vous avez déjà un compte, utilisez votre mot de passe actuel.",
    invalidEmail: "Saisissez une adresse e-mail valide, par exemple name@example.com.",
    shortPassword: "Le mot de passe doit contenir au moins 6 caractères.",
    mismatch: "Les mots de passe ne correspondent pas.",
    invalidCredentials: "L’e-mail ou le mot de passe est incorrect. Vérifiez-les et réessayez.",
    unconfirmed: "Confirmez votre e-mail à l’aide du message de confirmation avant de vous connecter.",
    weakPassword: "Ce mot de passe ne respecte pas les exigences de sécurité. Essayez un mot de passe plus long et varié.",
    rateLimited: "Trop de tentatives. Patientez un peu avant de réessayer.",
    signupFailed: "Impossible de créer le compte. Si vous avez un compte, essayez de vous connecter, ou utilisez un autre e-mail.",
    unavailable: "La connexion est indisponible. Réessayez plus tard.",
    connectionError: "Impossible de joindre le service de connexion. Vérifiez votre connexion et réessayez.",
    genericError: "Impossible de terminer la demande. Vérifiez vos informations et réessayez.",
  },
} satisfies Record<Language, Record<string, string>>;

export function validateAuthFields(fields: AuthFields, mode: AuthMode, lang: Language): AuthFieldErrors {
  const copy = authCopy[lang];
  const errors: AuthFieldErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = copy.invalidEmail;
  // Never trim a password: leading/trailing spaces may be part of it.
  if (fields.password.length < 6) errors.password = copy.shortPassword;
  if (mode === "signup" && fields.confirmation !== fields.password) errors.confirmation = copy.mismatch;
  return errors;
}

/** Translate only allowlisted codes; never display server messages, URLs or credentials. */
export function getAuthErrorMessage(error: unknown, lang: Language): string {
  const copy = authCopy[lang];
  const { code, status, name } = (error && typeof error === "object" ? error : {}) as {
    code?: string; status?: number; name?: string;
  };
  switch (code) {
    case "invalid_credentials":
    case "user_not_found": return copy.invalidCredentials;
    case "email_not_confirmed": return copy.unconfirmed;
    case "weak_password": return copy.weakPassword;
    case "email_address_invalid":
    case "validation_failed": return copy.invalidEmail;
    case "user_already_exists":
    case "email_exists": return copy.signupFailed;
    case "signup_disabled":
    case "email_provider_disabled": return copy.unavailable;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return copy.rateLimited;
    case "request_timeout": return copy.connectionError;
  }
  if (status === 429) return copy.rateLimited;
  if (name === "AuthRetryableFetchError" || error instanceof TypeError) return copy.connectionError;
  if (status && status >= 500) return copy.unavailable;
  return copy.genericError;
}
