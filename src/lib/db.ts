import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;

function getClient(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

// Lazily constructs the Neon client on first *use* rather than at module
// load. Next.js evaluates route modules during its build-time "collect page
// data" step even for purely dynamic routes — throwing here at import time
// would fail the build itself whenever DATABASE_URL isn't set yet (e.g.
// before the Neon integration is connected), even though the route is never
// actually invoked during build.
export const sql: Sql = ((...args: Parameters<Sql>) =>
  (getClient() as (...a: Parameters<Sql>) => ReturnType<Sql>)(...args)) as Sql;
