import { logout as signOut, startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const loginRequested = useRef(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!supabase) {
      setInitializing(false);
      return;
    }
    let mounted = true;
    let authEventReceived = false;
    // Keep the callback synchronous: awaiting other Auth methods here can deadlock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!mounted) return;
      setSession(nextSession);
      setInitializing(false);
      setAuthError(null);
      if (nextSession) loginRequested.current = false;
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventReceived) return;
      setSession(data.session);
      setAuthError(error);
      setInitializing(false);
    }).catch(() => {
      if (!mounted || authEventReceived) return;
      setAuthError(new Error("تعذر استعادة جلسة تسجيل الدخول."));
      setInitializing(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !initializing && Boolean(session),
    retry: false,
    refetchOnWindowFocus: false,
  });
  // Do not display cached data belonging to a previous account.
  const user = session && meQuery.data?.authUserId === session.user.id ? meQuery.data : null;
  const loading = initializing || (Boolean(session) && meQuery.isLoading) || signingOut;

  const logoutMutation = trpc.auth.logout.useMutation();
  const logout = useCallback(async () => {
    setSigningOut(true);
    setAuthError(null);
    try {
      // The browser owns the refresh token. Sign it out even if the API is offline.
      try { await logoutMutation.mutateAsync(); } catch { /* local sign-out still runs */ }
      await signOut();
      setSession(null);
      utils.auth.me.setData(undefined, null);
    } catch (error) {
      setAuthError(error instanceof Error ? error : new Error("تعذر تسجيل الخروج."));
    } finally {
      setSigningOut(false);
    }
  }, [logoutMutation, utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || session || authError || loginRequested.current) return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    loginRequested.current = true;
    if (redirectPath) window.location.assign(redirectPath);
    else void startLogin();
  }, [redirectOnUnauthenticated, redirectPath, loading, session, authError]);

  return {
    session,
    user,
    loading,
    error: authError ?? meQuery.error ?? null,
    isAuthenticated: Boolean(session && user),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
