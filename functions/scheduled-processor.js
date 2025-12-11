// functions/scheduled-processor.js
// Cloudflare Cron Trigger worker for automated image processing
import { generateImageVariations } from './lib/gemini';
import { updateRecord } from './lib/airtable';

export async function onRequest({ request, env }) {
    // Handle manual trigger via HTTP POST
    if (request.method === "POST") {
        return await processNewRecords(env);
    }

    return new Response("Scheduled processor endpoint. Use POST to manually trigger.", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
    });
}

// This function is called by Cloudflare Cron Triggers
export async function scheduled(event, env, ctx) {
    console.log('🕐 Scheduled processor triggered at:', new Date().toISOString());

    // Check if automation is enabled
    if (env.AUTO_PROCESS_ENABLED === 'false') {
        console.log('⏸️ Automation is disabled');
        return;
    }

    ctx.waitUntil(processNewRecords(env));
}

async function processNewRecords(env) {
    const startTime = Date.now();
    const results = {
        timestamp: new Date().toISOString(),
        recordsFound: 0,
        recordsProcessed: 0,
        successCount: 0,
        errorCount: 0,
        errors: [],
        details: []
    };

    try {
        console.log('📡 Fetching new records from Airtable...');

        // Calculate timestamp for 24 hours ago
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch records from Airtable (last 24 hours with Order_Package)
        const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID1}/${env.AIRTABLE_TABLE_NAME1}`;

        // Filter: Created in last 24h AND has Order_Package
        // We process images from BOTH Image_Upload and Image_Upload2 fields
        const filterFormula = `AND(
      IS_AFTER({Timestamp}, '${twentyFourHoursAgo}'),
      {Order_Package} != ''
    )`;

        const encodedFormula = encodeURIComponent(filterFormula);
        const fetchUrl = `${airtableUrl}?filterByFormula=${encodedFormula}`;

        const response = await fetch(fetchUrl, {
            headers: {
                'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Airtable fetch failed: ${response.status}`);
        }

        const data = await response.json();
        const records = data.records || [];
        results.recordsFound = records.length;

        console.log(`✅ Found ${records.length} records to process`);

        if (records.length === 0) {
            console.log('ℹ️ No new records to process');
            return new Response(JSON.stringify(results), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Get default settings
        const defaultPrompt = env.DEFAULT_FOOD_PROMPT ||
            '„Ein professionelles Food-Fotografie-Bild::  Kamera-Perspektive: leicht erhöhte Draufsicht, etwa 30–45° von oben. Objektiv: Normalobjektiv, 50 mm Vollformat-Look. Den Teller oder Gefäß vervollständigen, Hintergrund sanft unscharf (Bokeh). Komposition klar und appetitlich, alle Speisen vollständig sichtbar. Keine störenden Objekte wie Dosen, Serviettenhalter oder Salzstreuer im Bild. Beleuchtung: weiches, diffuses Licht wie aus einer großen Lichtwanne, natürliche Reflexe, zarte Schatten. Farben lebendig, aber realistisch; leichte Food-Styling-Ästhetik; knackige Details, hohe Schärfe, professioneller Look. Ultra-realistischer Stil, hochwertige Food-Photography.“';
        const variationCount = parseInt(env.DEFAULT_VARIATION_COUNT || '2');
        const useDefaultPrompt = env.USE_DEFAULT_PROMPT !== 'false';

        // Process each record
        for (const record of records) {
            const recordId = record.id;
            const fields = record.fields;

            try {
                console.log(`🔄 Processing record ${recordId} for ${fields.Email}`);

                // Collect images from BOTH Image_Upload and Image_Upload2 fields
                const imageUpload1 = fields.Image_Upload || [];
                const imageUpload2 = fields.Image_Upload2 || [];
                const allImages = [...imageUpload1, ...imageUpload2];

                if (allImages.length === 0) {
                    console.log(`⏭️ Skipping ${recordId}: No images in Image_Upload or Image_Upload2`);
                    continue;
                }

                console.log(`📸 Found ${imageUpload1.length} test images + ${imageUpload2.length} bundle images = ${allImages.length} total`);

                results.recordsProcessed++;

                // Combine prompts
                let finalPrompt = fields.Prompt || '';
                if (useDefaultPrompt && defaultPrompt) {
                    finalPrompt = defaultPrompt + (finalPrompt ? '. ' + finalPrompt : '');
                }

                console.log(`📝 Using prompt: "${finalPrompt}"`);

                const allGeneratedAttachments = [];

                // Process each image
                for (let i = 0; i < allImages.length; i++) {
                    const imageUrl = allImages[i].url;
                    const imageFilename = allImages[i].filename || `image_${i + 1}.jpg`;

                    console.log(`🖼️ Processing image ${i + 1}/${allImages.length}: ${imageFilename}`);

                    try {
                        // Fetch the image
                        const imageResponse = await fetch(imageUrl);
                        if (!imageResponse.ok) {
                            throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                        }

                        const imageBlob = await imageResponse.blob();
                        const imageFile = new File([imageBlob], imageFilename, { type: imageBlob.type });

                        // Call AI generation internally (no HTTP fetch to self)
                        const generatedUrls = await generateImageVariations(env, imageFile, finalPrompt, variationCount.toString(), fields.Email);

                        console.log(`✅ Generated ${generatedUrls.length} variations for ${imageFilename}`);

                        // Accumulate all generated URLs
                        if (generatedUrls.length > 0) {
                            generatedUrls.forEach(img => {
                                if (img.url) {
                                    allGeneratedAttachments.push({ url: img.url });
                                }
                            });
                        }

                    } catch (imageError) {
                        console.error(`❌ Error processing image ${imageFilename}:`, imageError);
                        results.errors.push({
                            recordId,
                            email: fields.Email,
                            image: imageFilename,
                            error: imageError.message
                        });
                    }
                }

                // Save to destination Airtable using lib/airtable (Update ID1) ONCE per record
                if (allGeneratedAttachments.length > 0) {

                    // Generate HTML Download Page
                    const safeEmail = fields.Email ? fields.Email.replace(/[^a-zA-Z0-9]/g, '_') : 'anonymous';
                    const timestamp = Date.now();
                    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Generated Images</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .image-card { border: 1px solid #ddd; padding: 10px; border-radius: 8px; text-align: center; }
        img { max-width: 100%; height: auto; border-radius: 4px; }
        .download-btn { display: inline-block; margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .download-btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1>Your Generated Images</h1>
    <p>Here are your optimized images. Click "Download" to save them.</p>
    <div class="gallery">
        ${allGeneratedAttachments.map((img, idx) => `
            <div class="image-card">
                <img src="${img.url}" alt="Generated Image ${idx + 1}" loading="lazy">
                <br>
                <a href="${img.url}" class="download-btn" download>Download Image ${idx + 1}</a>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

                    const htmlFilename = `${safeEmail}_gen/download_${timestamp}.html`;
                    await env.IMAGE_BUCKET.put(htmlFilename, htmlContent, {
                        httpMetadata: { contentType: "text/html" },
                    });

                    const baseUrl = env.R2_PUBLIC_URL || "https://pub-2e08632872a645f89f91aad5f2904c70.r2.dev";
                    const htmlUrl = `${baseUrl}/${htmlFilename}`;
                    console.log(`📄 Generated Download Page: ${htmlUrl}`);

                    // Add HTML page to attachments (optional, keep if user wants file too, but mainly we want the link)
                    // allGeneratedAttachments.push({ url: htmlUrl }); 
                    // User seems to prefer a link, so we won't add it to 'Image' as attachment to avoid confusion if they want clean images.
                    // But wait, user said "Image field... Is it an attachment now?".
                    // I will add the LINK to 'Download_Link' field.
                    // I will KEEP the images in 'Image' field.

                    await updateRecord(env, recordId, {
                        Image: allGeneratedAttachments,
                        Download_Link: htmlUrl
                    });
                    console.log(`💾 Saved images and Download Link to destination Airtable (ID1) for record ${recordId}`);
                }

                results.successCount++;
                results.details.push({
                    recordId,
                    email: fields.Email,
                    imagesProcessed: allImages.length,
                    status: 'success'
                });

                console.log(`✅ Successfully processed record ${recordId}`);

            } catch (recordError) {
                console.error(`❌ Error processing record ${recordId}:`, recordError);
                results.errorCount++;
                results.errors.push({
                    recordId,
                    email: fields.Email,
                    error: recordError.message
                });
            }
        }

        const duration = Date.now() - startTime;
        results.durationMs = duration;

        console.log(`🏁 Processing complete in ${duration}ms`);
        console.log(`📊 Results: ${results.successCount} success, ${results.errorCount} errors`);

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('❌ Fatal error in scheduled processor:', error);

        results.errorCount++;
        results.errors.push({
            type: 'fatal',
            error: error.message
        });

        return new Response(JSON.stringify(results), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
