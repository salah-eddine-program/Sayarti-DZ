export const ENV = {
  get supabaseUrl() { return process.env.SUPABASE_URL?.trim() ?? ""; },
  get supabaseAnonKey() { return process.env.SUPABASE_ANON_KEY?.trim() ?? ""; },
  get supabaseServiceRoleKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""; },
};
