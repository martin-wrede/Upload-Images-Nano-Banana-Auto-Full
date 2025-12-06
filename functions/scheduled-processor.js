// functions/scheduled-processor.js
// Cloudflare Cron Trigger worker for automated image processing

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
            'Professional food photography, high quality, well-lit, appetizing presentation, restaurant quality';
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

                        // Create FormData for AI processing
                        const formData = new FormData();
                        formData.append('prompt', finalPrompt);
                        formData.append('image', imageFile);
                        formData.append('email', fields.Email || 'automated');
                        formData.append('count', variationCount.toString());

                        // Call AI endpoint
                        const aiResponse = await fetch(`${env.WORKER_URL || 'https://upload-images-nano-banana-auto.pages.dev'}/ai`, {
                            method: 'POST',
                            body: formData,
                        });

                        if (!aiResponse.ok) {
                            throw new Error(`AI processing failed: ${aiResponse.status}`);
                        }

                        const aiData = await aiResponse.json();
                        const generatedUrls = aiData.data || [];

                        console.log(`✅ Generated ${generatedUrls.length} variations for ${imageFilename}`);

                        // Save to destination Airtable using existing /airtable endpoint
                        if (generatedUrls.length > 0) {
                            const firstImageUrl = generatedUrls[0]?.url;
                            if (firstImageUrl) {
                                const airtableFormData = new FormData();
                                airtableFormData.append('prompt', finalPrompt);
                                airtableFormData.append('imageUrl', firstImageUrl);
                                airtableFormData.append('user', fields.User || 'Automated');
                                airtableFormData.append('email', fields.Email || '');
                                airtableFormData.append('uploadColumn', 'Image_Upload2');

                                const airtableResponse = await fetch(`${env.WORKER_URL || 'https://upload-images-nano-banana-auto.pages.dev'}/airtable`, {
                                    method: 'POST',
                                    body: airtableFormData,
                                });

                                if (!airtableResponse.ok) {
                                    console.error(`⚠️ Failed to save to Airtable for ${imageFilename}`);
                                } else {
                                    console.log(`💾 Saved to destination Airtable for ${imageFilename}`);
                                }
                            }
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
