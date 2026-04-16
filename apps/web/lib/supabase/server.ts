import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Automatically manages session cookies via @supabase/ssr.
 */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            // `set` throws from Server Components; middleware/route handlers handle refresh.
          }
        },
      },
    },
  );
}
