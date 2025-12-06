# Automated Processing Environment Variables

Add these environment variables to your Cloudflare Pages dashboard for the automated processing system.

## Required Variables

### Existing Variables (Already Configured)
- `AIRTABLE_API_KEY` - Your Airtable API key
- `AIRTABLE_BASE_ID` - Primary Airtable base ID
- `AIRTABLE_TABLE_NAME` - Primary Airtable table name
- `AIRTABLE_BASE_ID1` - Secondary Airtable base ID (app43PSg6pTJ9HhY2)
- `AIRTABLE_TABLE_NAME1` - Secondary Airtable table name (tblZn0kJvbvG92ksR)
- `R2_PUBLIC_URL` - Your R2 bucket public URL
- `IMAGE_BUCKET` - R2 bucket binding (configured in wrangler.toml)

### New Variables for Automation

```
AUTO_PROCESS_ENABLED=true
DEFAULT_FOOD_PROMPT=Professional food photography, high quality, well-lit, appetizing presentation, restaurant quality
USE_DEFAULT_PROMPT=true
DEFAULT_VARIATION_COUNT=2
WORKER_URL=https://upload-images-nano-banana-auto.pages.dev
```

## Variable Descriptions

### `AUTO_PROCESS_ENABLED`
- **Type**: Boolean string ("true" or "false")
- **Default**: "false"
- **Description**: Master switch to enable/disable automated processing
- **Recommended**: Start with "false", enable after testing

### `DEFAULT_FOOD_PROMPT`
- **Type**: String
- **Default**: "Professional food photography, high quality, well-lit, appetizing presentation, restaurant quality"
- **Description**: Default prompt that will be prepended to client prompts
- **Example**: If client prompt is "make colors vibrant", final prompt becomes: "Professional food photography... make colors vibrant"

### `USE_DEFAULT_PROMPT`
- **Type**: Boolean string ("true" or "false")
- **Default**: "true"
- **Description**: Whether to combine default prompt with client prompt
- **Options**:
  - "true" = Use `DEFAULT_FOOD_PROMPT + Client Prompt`
  - "false" = Use only client prompt

### `DEFAULT_VARIATION_COUNT`
- **Type**: Number string ("1", "2", or "4")
- **Default**: "2"
- **Description**: Number of AI variations to generate per image
- **Recommended**: "2" for balance between quality options and processing time

### `WORKER_URL`
- **Type**: URL string
- **Description**: Full URL of your deployed Cloudflare Pages site
- **Example**: "https://upload-images-nano-banana-auto.pages.dev"
- **Note**: Used for internal API calls from the scheduled worker

## Cron Schedule Configuration

The cron schedule is configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

### Cron Schedule Options

- **Every 6 hours**: `"0 */6 * * *"` (Recommended for active use)
- **Every 24 hours**: `"0 0 * * *"` (Midnight UTC, good for testing)
- **Every 12 hours**: `"0 */12 * * *"` (Twice daily)
- **Custom**: Use [crontab.guru](https://crontab.guru/) to create custom schedules

## How to Add Variables

1. Go to Cloudflare Pages dashboard
2. Select your project: `upload-images-nano-banana-auto`
3. Navigate to **Settings** > **Environment variables**
4. For each variable:
   - Click **Add variable**
   - Enter variable name and value
   - Select environment (Production and/or Preview)
   - Click **Save**
5. Redeploy your application

## Testing the Automation

### 1. Test Manually First
Before enabling the cron trigger:
1. Set `AUTO_PROCESS_ENABLED=false`
2. Navigate to `/admin-automation`
3. Configure settings
4. Click "Run Now" to manually trigger processing
5. Review results

### 2. Enable Scheduled Processing
Once manual testing works:
1. Set `AUTO_PROCESS_ENABLED=true`
2. Redeploy
3. Monitor the first few automated runs
4. Check Cloudflare Workers logs for any errors

## Monitoring

### Cloudflare Dashboard
- Go to Workers & Pages > Your Project > Logs
- View real-time logs of cron executions
- Check for errors or warnings

### Admin UI
- Visit `/admin-automation`
- View processing results
- Check success/error counts
- Review detailed processing logs

## Troubleshooting

### Automation Not Running
- Check `AUTO_PROCESS_ENABLED` is set to "true"
- Verify cron trigger is configured in `wrangler.toml`
- Check Cloudflare Workers logs for errors
- Ensure all environment variables are set correctly

### No Records Being Processed
- Verify records exist in Airtable from last 24 hours
- Check records have `Order_Package` field filled
- Ensure records have `Image_Upload` but no `Image_Upload2`
- Review filter formula in `scheduled-processor.js`

### Processing Errors
- Check Cloudflare Workers logs for detailed error messages
- Verify R2 bucket permissions
- Ensure AI endpoint is accessible
- Check Airtable API rate limits
