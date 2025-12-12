# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **React + Vite** application that provides AI-powered food image processing and enhancement using Google's Gemini API. Images are uploaded to Cloudflare R2, processed with AI variations, and metadata is stored in Airtable. The system includes both manual and automated (scheduled) processing workflows.

**Tech Stack:** React 19, Vite, Cloudflare Pages Functions, Cloudflare R2 (storage), Google Gemini API (image-to-image), Airtable (database)

## Development Commands

### Build and Development
```bash
# Start development server (Vite HMR enabled)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code with ESLint
npm run lint
```

### Deployment
```bash
# Deploy to GitHub Pages
npm run deploy

# Deploy to Cloudflare Pages
npm run deploy:cloudflare
# Or using wrangler directly:
wrangler pages deploy dist
```

### Testing
This project does not have a formal test suite configured. Manual testing is done through the browser at various routes.

## Architecture

### Frontend Structure

The app uses **simple client-side routing** (no React Router) implemented in `src/main.jsx`:

- **`/`** → `App.jsx` - Main image upload and AI processing interface
  - Load images from R2 by email
  - Modify individual images or batch process all images
  - Select variation count (1, 2, or 4)
  - Different packages: `?package=test` / `?package=starter` / `?package=normal`

- **`/automation`** → `pages/Automation.jsx` - Client upload automation interface

- **`/admin-automation`** → `pages/AdminAutomation.jsx` - Admin control panel for scheduled processing
  - Configure automation settings (enable/disable, schedule, variations)
  - Manually trigger processing with "Run Now"
  - View processing history and results

- **`/auto-runner`** → `pages/AutoRunner.jsx` - Alternative automation runner interface

### Backend (Cloudflare Pages Functions)

Located in `functions/` directory. Each file exports `onRequest` function that handles HTTP requests:

- **`ai.js`** - Main AI image processing endpoint (`/ai`)
  - Accepts image + prompt (optional, uses default if empty)
  - Calls Google Gemini API for image-to-image generation
  - Auto-detects image orientation and aspect ratio (16:9 or 9:16)
  - Generates 1, 2, or 4 variations per image
  - Uploads results to R2 with email-based folder structure
  - Returns array of generated image URLs

- **`airtable.js`** - Save/update Airtable records (`/airtable`)
  - Saves AI-generated images and metadata to Airtable
  - Handles pending record logic (test vs paid package workflow)
  - Uploads original images to R2 before saving to Airtable

- **`upload_images.js`** - Direct image upload endpoint (`/upload_images`)
  - Uploads images to R2 without AI processing
  - Creates or updates Airtable records

- **`list-images.js`** - List R2 images for a user (`/list-images`)
  - Fetches images from email-based folder in R2

- **`fetch-airtable-data.js`** - Fetch records from Airtable (`/fetch-airtable-data`)

- **`process-next.js`** - Process next queued record (`/process-next`)

- **`scheduled-processor.js`** - Automated cron trigger worker
  - **Cron Schedule:** Configured in `wrangler.toml` under `[triggers]`
  - Runs automatically every 6 or 24 hours (configurable)
  - Fetches records from last 24 hours with `Order_Package` field
  - Processes ALL images from both `Image_Upload` (test) and `Image_Upload2` (bundle) fields
  - Combines default food prompt + client prompt
  - Generates HTML download page for each processed record
  - Controlled by `AUTO_PROCESS_ENABLED` environment variable

### Data Flow

1. **Manual Processing Flow:**
   ```
   User uploads images → R2 storage (email-based folders)
   User selects image + enters prompt → /ai endpoint
   /ai calls Gemini API → generates variations
   Results saved to R2 → URLs returned to frontend
   First image saved to Airtable via /airtable
   ```

2. **Automated Processing Flow (Cron):**
   ```
   Cron trigger fires (every 6-24h) → scheduled-processor.js
   Fetches new Airtable records (last 24h with Order_Package)
   For each record: fetch images from Image_Upload + Image_Upload2
   Process each image with Gemini → upload to R2
   Generate HTML download page → save to R2
   Update destination Airtable table with results
   ```

### Airtable Structure

Two Airtable bases are used:

- **Source Base** (`AIRTABLE_BASE_ID1` / `AIRTABLE_TABLE_NAME1`)
  - Stores client orders and original uploaded images
  - Fields: `Email`, `Order_Package`, `Prompt`, `Image_Upload` (test images), `Image_Upload2` (bundle images), `Timestamp`

- **Destination Base** (`AIRTABLE_BASE_ID2` / `AIRTABLE_TABLE_NAME2`)
  - Stores processed/generated images
  - Fields: `Email`, `User`, `Prompt`, `Image` (generated), `Image_Upload` (test originals), `Image_Upload2` (bundle originals), `Timestamp`

**Pending Record Logic:**
- When uploading to `Image_Upload` (test package), checks if pending record exists
- Blocks duplicate test uploads if user has unpaid bundle pending
- When uploading to `Image_Upload2` (paid package), updates existing pending record instead of creating new one

### R2 Storage Structure

Images are organized by email in R2:

```
<sanitized_email>_<timestamp>_<filename>          # Original uploads
<sanitized_email>_gen/<timestamp>_<filename>_v1   # Generated variations
<sanitized_email>_gen/<timestamp>_<filename>_v2
<sanitized_email>_gen/download_<timestamp>.html   # Download page
```

Email is sanitized by replacing non-alphanumeric chars with underscores.

## Environment Variables

### Core Configuration (in `wrangler.toml` or Cloudflare Dashboard)

```bash
# Airtable
AIRTABLE_API_KEY           # Airtable API token
AIRTABLE_BASE_ID1          # Source base (client orders)
AIRTABLE_TABLE_NAME1       # Source table
AIRTABLE_BASE_ID2          # Destination base (processed images)
AIRTABLE_TABLE_NAME2       # Destination table

# API Keys
GEMINI_API_KEY             # Google Gemini API key
VITE_APP_OPENAI_API_KEY    # OpenAI key (legacy, not actively used)
E2B_API_KEY                # E2B API key

# Storage
R2_PUBLIC_URL              # Public URL for R2 bucket (e.g., https://pub-xxx.r2.dev)
IMAGE_BUCKET               # R2 bucket binding (configured in wrangler.toml)
```

### Automation Configuration

```bash
AUTO_PROCESS_ENABLED       # "true" or "false" - master switch for cron automation
DEFAULT_FOOD_PROMPT        # Default prompt prepended to client prompts
USE_DEFAULT_PROMPT         # "true" or "false" - whether to use default prompt
DEFAULT_VARIATION_COUNT    # "1", "2", or "4" - variations per image
WORKER_URL                 # Full URL of deployed site (for internal API calls)
```

**Note:** `wrangler.toml` currently contains secrets in plain text. These should be moved to Cloudflare environment variables for production.

## Key Implementation Details

### Image Processing (ai.js)

- **Aspect Ratio Detection:** Reads image headers (JPEG/PNG/GIF/WebP) to determine dimensions and sets aspect ratio (16:9 for landscape, 9:16 for portrait)
- **Gemini Model:** Uses `gemini-3-pro-image-preview` model
- **Safety Settings:** All safety thresholds set to `BLOCK_NONE` for food photography
- **Output Size:** `2K` resolution
- **Multiple Variations:** Loops API calls for requested variation count

### Prompt Handling

**Default Prompt (German):**
Professional food photography instructions including camera angle (30-45° from above), 50mm lens look, soft diffused lighting, bokeh background, realistic colors, sharp details, ultra-realistic style.

**Prompt Combination:**
- If `USE_DEFAULT_PROMPT=true`: Final = Default + Client Prompt
- If `USE_DEFAULT_PROMPT=false`: Final = Client Prompt only

### Package System

Query parameter `?package=TYPE` determines upload limits:
- `test`: 2 images → `Image_Upload` column
- `starter`: 3 images → `Image_Upload2` column
- `normal`: 8 images → `Image_Upload2` column
- `default`: 10 images → `Image_Upload2` column

### Cron Configuration

Edit `wrangler.toml` to change schedule:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

Common schedules:
- Every 6 hours: `"0 */6 * * *"`
- Every 24 hours (midnight UTC): `"0 0 * * *"`
- Twice daily (9 AM & 9 PM UTC): `"0 9,21 * * *"`

Use [crontab.guru](https://crontab.guru/) for custom schedules.

## Important Patterns

### Cloudflare Functions Pattern

All functions in `functions/` follow this structure:

```javascript
export async function onRequest({ request, env }) {
  // Handle OPTIONS for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ... } });
  }
  
  // Access environment via env parameter
  const apiKey = env.GEMINI_API_KEY;
  const bucket = env.IMAGE_BUCKET;
  
  // Process request...
}
```

### R2 Upload Pattern

```javascript
const key = `${safeEmail}_${Date.now()}_${file.name}`;
await env.IMAGE_BUCKET.put(key, file.stream());
const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
```

### Base64 Image Handling

```javascript
// File to Base64 for Gemini
const arrayBuffer = await imageFile.arrayBuffer();
const base64Image = btoa(
  new Uint8Array(arrayBuffer).reduce((data, byte) => 
    data + String.fromCharCode(byte), "")
);

// Base64 to Uint8Array for R2
const binaryString = atob(base64Image);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
```

## Common Tasks

### Add New Route
1. Create component in `src/pages/`
2. Add route in `src/main.jsx` path detection
3. No build step needed - client-side routing

### Modify AI Generation Parameters
Edit `ai.js` `generationConfig` section:
- `aspectRatio`: "16:9" | "9:16" | "1:1" | "3:4" | "4:3"
- `imageSize`: "256", "512", "1K", "2K", "4K"

### Change Default Prompt
Set `DEFAULT_FOOD_PROMPT` environment variable or edit `scheduled-processor.js` fallback

### Debug Scheduled Processing
1. Check Cloudflare Workers logs (Dashboard → Workers & Pages → Logs)
2. Use `/admin-automation` → "Run Now" for manual testing
3. Review processing results in admin UI

### Modify Airtable Filter
Edit `scheduled-processor.js` `filterFormula`:
```javascript
const filterFormula = `AND(
  IS_AFTER({Timestamp}, '${twentyFourHoursAgo}'),
  {Order_Package} != ''
)`;
```

## Deployment Notes

- **Cloudflare Pages** automatically deploys on git push
- Changes to `wrangler.toml` require redeployment: `wrangler pages deploy dist`
- Environment variables added via Cloudflare Dashboard require redeployment
- Cron triggers only work in production (not in local dev)
- Build output directory: `dist/`

## Security Considerations

- Admin routes (`/admin-automation`) currently have no authentication
- API keys are stored in `wrangler.toml` in plain text (should migrate to Dashboard environment variables)
- All Cloudflare Functions use CORS headers with `Access-Control-Allow-Origin: *`
- Consider adding rate limiting for AI endpoints to prevent abuse
