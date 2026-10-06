# dyc-assesment

## Persistent storage for deployed assessments

Assessment attempts and shared inspector profiles are stored in Supabase PostgreSQL. This is required for serverless deployments such as Vercel, where the application filesystem is read-only and instance-local.

1. In the Supabase project SQL Editor, run [`supabase/migrations/20261006120000_create_inspector_storage.sql`](./supabase/migrations/20261006120000_create_inspector_storage.sql).
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. Use the project URL and the **service_role** key from Supabase project API settings. Keep the service-role key server-side; do not use a `NEXT_PUBLIC_` variable or expose it to browser code.
3. Add the same variables to local `.env.local` when running against Supabase locally, then redeploy.

The migration enables row-level security without public policies. Server API routes use the service-role key, and attempt creation is serialized in PostgreSQL to avoid duplicate concurrent starts. A missing configuration or database setup is reported as a storage error instead of attempting to write into the deployment filesystem.
