# Homepage demo media (Vercel Blob)

The homepage `DemoShowcase` plays short recorded loops of the LangGraph and
AG-UI demos. These are **large binaries**, so they are NOT committed to git —
they live in a public **Vercel Blob** store and are referenced by absolute URL
from `apps/website/src/components/landing/DemoShowcase.tsx` (`DEMO_CDN`).

- **Store:** `ngaf-website-assets` (id `store_ELgKDAxPSvqCrns1`), team `cacheplane`, public access.
- **Public base:** `https://elgkdaxpsvqcrns1.public.blob.vercel-storage.com/demo`
- **Files:** `{langgraph,ag-ui}-demo.mp4`, `{langgraph,ag-ui}-demo.webm`, `{langgraph,ag-ui}-demo-poster.webp`

`apps/website/public/demo/` is gitignored so these never re-enter history.

## Re-uploading (e.g. a recut)

Uploads use the same pathnames, so the URLs in `DemoShowcase.tsx` stay stable —
no code change needed unless you add/rename a file.

1. Get the store's read-write token (`BLOB_READ_WRITE_TOKEN`). It is connected to
   the `threadplane` Vercel project; pull it with the Vercel API or
   `vercel env pull` (CLI ≥ 37 also has `vercel blob` commands).

2. Upload each file with a stable pathname (no random suffix):

   ```bash
   curl -X PUT "https://blob.vercel-storage.com/demo/langgraph-demo.mp4" \
     -H "authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
     -H "x-content-type: video/mp4" \
     -H "x-add-random-suffix: 0" \
     -H "x-api-version: 7" \
     --data-binary @langgraph-demo.mp4
   # repeat for .webm (video/webm) and -poster.webp (image/webp), both runtimes
   ```

3. Verify: `curl -I https://elgkdaxpsvqcrns1.public.blob.vercel-storage.com/demo/langgraph-demo.mp4` → `200`.

## Producing the clips

The clips are screen recordings of the live demos captured headlessly with
Playwright (`recordVideo`), then trimmed/sped and encoded small with `ffmpeg`
(H.264 mp4 + VP9 webm, first-frame `webp` poster, 1280×800). Keep each file
well under ~1 MB.
