import { requireSupabase } from "@/lib/supabase";

let loginInProgress = false;

/** Invoke from an event handler, never during render. */
export async function startLogin(): Promise<void> {
  if (typeof window === "undefined" || loginInProgress) return;
  loginInProgress = true;
  try {
    const client = requireSupabase();
    const email = window.prompt("البريد الإلكتروني / Email")?.trim();
    if (!email) return;
    const password = window.prompt("كلمة المرور / Password");
    if (!password) return;

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return;

    // Supabase deliberately returns the same error for an absent account and a
    // wrong password. Do not enumerate users or automatically register on errors.
    if (error.code !== "invalid_credentials" && error.code !== "user_not_found") {
      window.alert(error.message);
      return;
    }
    if (!window.confirm("البريد أو كلمة المرور غير صحيحة. إن لم يكن لديك حساب، هل تريد إنشاء حساب جديد؟")) return;
    const confirmation = window.prompt("أعد كتابة كلمة المرور لإنشاء الحساب / Confirm password");
    if (confirmation !== password) {
      if (confirmation !== null) window.alert("كلمتا المرور غير متطابقتين.");
      return;
    }
    const { data, error: signUpError } = await client.auth.signUp({ email, password });
    if (signUpError) {
      window.alert(signUpError.message);
    } else if (!data.session) {
      window.alert("تحقق من بريدك لتأكيد الحساب، ثم سجّل الدخول. إذا كان لديك حساب، استخدم كلمة المرور الصحيحة.");
    }
  } catch {
    window.alert("تعذر تسجيل الدخول. تأكد من إعداد Supabase واتصال الشبكة وحاول مجددًا.");
  } finally {
    loginInProgress = false;
  }
}

export async function logout(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}
