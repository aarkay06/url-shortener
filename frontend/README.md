# snip frontend

A responsive React/Vite interface for the URL shortener backend.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the `ApiBaseUrl` output from the deployed SAM stack.
3. From this directory, run `npm install`, then `npm run dev`.

The page sends `POST {VITE_API_BASE_URL}/links` with `{ "url": "https://example.com" }` and displays the `shortUrl` and `code` returned by the Lambda. The clipboard control uses the browser Clipboard API, so local development should use localhost and deployed sites should use HTTPS.

## Mount at `https://aarkay.tech/url`

`vite.config.js` sets the asset base path to `/url/`. Deploy this frontend as a separate Vercel project, then merge the first three routing rules from `vercel-rewrites.example.json` into the **existing root Vercel project's** `routes` array, before its `server.js` catch-all. Replace the example origins with the deployed frontend project's Vercel URL and the API Gateway URL. The rules keep the public browser URL while Vercel fetches the matching frontend or API route.

Keep the existing DNS records unchanged. Vercel rewrites route by path; DNS cannot send `/url` and `/<code>` to different providers. Review existing Vercel routes before adding these rules: an existing eight-character route could conflict with a short code.

The SAM template defaults `PublicShortBaseUrl` and `FrontendOrigin` to `https://aarkay.tech`. The create function will return `https://aarkay.tech/<code>`, while the API's CORS policy allows the frontend to create links. If your existing site also uses `www.aarkay.tech`, decide whether to redirect it to the apex domain or add it as another allowed CORS origin.

For a standalone S3 deployment instead, run `npm run build` and upload the generated `dist/` files. In that setup, use a CDN/reverse proxy with path routing to mount the frontend under `/url`.
