# Supabase Storage images proxy for Astro

This document explains how to serve PNG (and other) images from Supabase Storage in an Astro site using a secure server endpoint.

Files added:
- `src/utils/supabaseStorage.ts` — helper to build public URLs and create a server-only Supabase client using the service role key.
- `src/pages/api/images/[...path].ts` — server endpoint that either redirects to the public object URL (public buckets) or proxies the object server-side (private buckets).
- `src/components/Logo.astro` — small example component showing usage.

Environment variables

Set these in your Netlify / Supabase integration or in a `.env` (server-only). Do NOT expose the `SUPABASE_SERVICE_ROLE_KEY` to clients.

- `SUPABASE_URL` — your Supabase project URL (e.g. `https://xyzcompany.supabase.co`)
- `SUPABASE_ANON_KEY` — (used by client-side code elsewhere)
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only** key used to read private objects
- `SUPABASE_BUCKET_NAME` — default bucket name (defaults to `public`)

Uploading images

1. Use the Supabase web UI or the CLI to upload images to your bucket (e.g. `logos/next.png`).
2. Prefer storing object paths in DB (e.g. `logos/next.png`). If you store the full public URL, you can use it directly in the `src`.

Using the endpoint in Astro

Example in a component or page:

```astro
---
import Logo from '../components/Logo.astro'
---

<Logo src="/api/images/logos/next.png" alt="Next logo" />
```

If your DB row stores `logo = 'logos/next.png'` then in your code:

```js
const src = logo.startsWith('http') ? logo : `/api/images/${logo}`
```

Image optimizers / external domains

If you use an image optimizer (Vercel, Cloudflare Image Resizing, Astro Image integrations, etc.) that requires a list of allowed external domains, add your Supabase storage domain:

 - `https://<your-project>.supabase.co` (the host part of `SUPABASE_URL`)

Notes on behavior

- Public objects: the endpoint performs a `HEAD` to the Supabase public object URL. If reachable, it returns a `302` redirect to that URL and sets a long `Cache-Control` so CDNs can cache aggressively.
- Private objects: the endpoint downloads the object using the service role key and streams it back with conservative caching headers.
- MIME types are inferred from file extension; common image types supported: `.png`, `.svg`, `.jpg`, `.jpeg`.
- Error handling: `400` for bad requests, `404` if not found, `500` for upstream or unexpected errors. Server-side errors are logged with `console.error`.

Security

- Ensure `SUPABASE_SERVICE_ROLE_KEY` is only available to the server environment (Netlify server environment variables or similar). Never expose it to the browser.

Troubleshooting

- If images unexpectedly 403 on the public path, confirm the bucket/object ACLs in Supabase Storage and that the object was uploaded to the correct bucket.
- If using an optimizer that rewrites image URLs, add your Supabase host to its allowed list.

MCP and Supabase CLI

You can use Supabase MCP and the Supabase CLI to inspect your project remotely. A minimal MCP config has been added at `.mcp/config.json` pointing to the Supabase MCP server for this project. Example:

```json
{
	"servers": {
		"supabase": {
			"type": "http",
			"url": "https://mcp.supabase.com/mcp?project_ref=gwvgajbhrnpjkajlakwv&features=database%2Cdebugging%2Cdevelopment%2Caccount%2Cdocs%2Cfunctions%2Cbranching%2Cstorage"
		}
	}
}
```

Quick commands using the Supabase CLI (install from https://supabase.com/docs/guides/cli):

```bash
# start an interactive session against the remote MCP server
supabase mcp connect --config .mcp/config.json

# list storage buckets
supabase storage ls --project-ref gwvgajbhrnpjkajlakwv

# upload a file to a bucket (local -> remote)
supabase storage upload public logos/next.png ./assets/next.png --project-ref gwvgajbhrnpjkajlakwv
```

Notes:
- The `mcp` connection lets you use CLI commands that target the remote project without exposing server keys locally.
- If you prefer, upload images via the Supabase web UI (Storage → select bucket → Upload).
