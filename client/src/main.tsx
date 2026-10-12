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
const isGithubPages = typeof window !== "undefined" && window.location.hostname.endsWith(".github.io");
const apiOrigin = import.meta.env.VITE_API_ORIGIN || (isGithubPages ? "https://sayarti-dz.onrender.com" : "");

if (typeof window !== "undefined" && "serviceWorker" in navigator) {

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => registration.update());
  });
}

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
      url: `${apiOrigin}/api/trpc`,
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
