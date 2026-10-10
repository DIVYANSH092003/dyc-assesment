# dyc-assesment

## Persistent storage for deployed assessments

Assessment attempts, shared inspector profiles, and proctoring recordings use Supabase. This is required for serverless deployments such as Vercel, where the application filesystem is read-only and instance-local.

1. Run [`supabase/migrations/20261006120000_create_inspector_storage.sql`](./supabase/migrations/20261006120000_create_inspector_storage.sql) and [`supabase/migrations/20261007120000_create_inspector_recordings.sql`](./supabase/migrations/20261007120000_create_inspector_recordings.sql) in the Supabase project SQL Editor, in that order.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. Use the project URL and the **service_role** key from Supabase project API settings. Keep the service-role key server-side; do not use a `NEXT_PUBLIC_` variable or expose it to browser code.
3. Set `NEXT_PUBLIC_SUPABASE_URL` to the same project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Supabase publishable/anon key. These browser values are used only for Supabase Auth and uploading with short-lived, attempt-specific signed upload tokens.
4. Set `SUPABASE_RECORDINGS_ADMIN_EMAILS` to a comma-separated list of administrator email addresses authorized to list, view, and delete recordings. Create or invite those users in Supabase Auth; they sign in to the **Live monitoring & footage** panel with those credentials. The server verifies the access token with Supabase Auth and checks the verified email against this allowlist. This additional Supabase Auth sign-in is only for recording review; the platform's existing login remains unchanged.
5. Add these values in Vercel for the relevant environments and redeploy after changing environment variables.

The recording bucket is private and accepts WebM or MP4 video uploads up to 100 MiB. Uploads are authorized by the unique token for the active assessment attempt; the file path is linked to that attempt in PostgreSQL. Administrators receive one-hour signed playback URLs. Deleting footage removes the stored object and clears its attempt link. No browser IndexedDB is used for recordings.

The migration enables row-level security without public database policies. Server API routes use the service-role key, and attempt creation is serialized in PostgreSQL to avoid duplicate concurrent starts. A missing configuration or database setup is reported as a storage error instead of attempting to write into the deployment filesystem.

Before go-live, confirm the recording retention period with the Quality Manager and document it in the record-control procedure. The current upload limit and Supabase project plan must also be checked against the expected recording duration and file sizes.
