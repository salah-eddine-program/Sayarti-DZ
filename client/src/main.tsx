import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
    void startLogin();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
  }
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
  }
});

// Auth event callbacks stay synchronous. Reset all private cache when the
// identity changes, including requests that were in flight at sign-out.
let currentUserId: string | null = null;
supabase?.auth.onAuthStateChange((_event, session) => {
  const nextUserId = session?.user.id ?? null;
  if (nextUserId !== currentUserId) {
    currentUserId = nextUserId;
    window.setTimeout(() => { void queryClient.resetQueries(); }, 0);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        // getSession refreshes expiring tokens; the server independently validates
        // every token using Auth.getUser, never trusting this client-side session.
        const token = (await supabase?.auth.getSession())?.data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...init, credentials: "omit" });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
