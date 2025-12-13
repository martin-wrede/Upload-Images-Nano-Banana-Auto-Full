import { getPendingRecords, updateRecord } from './lib/airtable';
import { generateImageVariations } from './lib/gemini';
import { generateMailtoLink } from './lib/email';

export async function onRequest({ request, env }) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        console.log("🤖 Auto-Runner: Checking for pending work...");

        // 1. Get Pending Records
        const pendingRecords = await getPendingRecords(env);

        if (pendingRecords.length === 0) {
            return new Response(JSON.stringify({ status: 'no_work', message: 'No pending records found.' }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Pick the first one
        const record = pendingRecords[0];
        const fields = record.fields;
        console.log(`🚀 Processing record: ${record.id} (${fields.Email})`);

        let downloadLink = fields.Download_Link;
        let allGeneratedLinks = fields.Image ? fields.Image.map(img => ({ url: img.url })) : [];

        // If we don't have a download link, we need to generate images (if not already done) and the link
        if (!downloadLink) {
            // 3. Prepare Prompt
            const defaultPrompt = env.DEFAULT_FOOD_PROMPT ||
                'Professional food photography, high quality, well-lit, appetizing presentation';
            const clientPrompt = fields.Prompt || '';
            const finalPrompt = (env.USE_DEFAULT_PROMPT !== 'false')
                ? `${defaultPrompt}. ${clientPrompt}`
                : clientPrompt;

            // 4. Get Source Images
            const imageUpload1 = fields.Image_Upload || [];
            const imageUpload2 = fields.Image_Upload2 || [];

            const allImages = [...imageUpload1, ...imageUpload2];

            if (allImages.length === 0) {
                return new Response(JSON.stringify({ status: 'error', message: 'Record has no input images.' }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // 5. Process Images (Generating variations)
            allGeneratedLinks = [];

            for (const img of allImages) {
                console.log(`🖼️ Fetching source image: ${img.url}`);
                if (!img.url) continue;

                let imageResponse;
                try {
                    imageResponse = await fetch(img.url);
                } catch (err) {
                    throw new Error(`Failed to fetch source image at ${img.url}: ${err.message}`);
                }

                if (!imageResponse.ok) {
                    throw new Error(`Failed to download source image ${img.url}: ${imageResponse.status} ${imageResponse.statusText}`);
                }

                const imageBlob = await imageResponse.blob();
                const imageFile = new File([imageBlob], img.filename || 'image.jpg', { type: imageBlob.type });

                const generated = await generateImageVariations(env, imageFile, finalPrompt, 2, fields.Email);
                allGeneratedLinks.push(...generated);
            }

            // 6. Create HTML Download Page
            if (allGeneratedLinks.length > 0) {
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
        ${allGeneratedLinks.map((img, idx) => `
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
                downloadLink = `${baseUrl}/${htmlFilename}`;
                console.log(`📄 Generated Download Page: ${downloadLink}`);

                // 7. Update Airtable
                await updateRecord(env, record.id, {
                    Image: allGeneratedLinks, // Save to main Image field
                    Image_Upload2: allGeneratedLinks, // Also legacy/backup
                    Download_Link: downloadLink
                });
            }
        }

        if (!downloadLink && allGeneratedLinks.length === 0) {
            return new Response(JSON.stringify({ status: 'error', message: 'Failed to generate images or download link.' }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 8. Generate Mailto Link
        const clientName = fields.User || (fields.Email ? fields.Email.split('@')[0] : 'Client');
        const mailtoLink = generateMailtoLink(
            fields.Email,
            clientName,
            downloadLink,
            allGeneratedLinks.length
        );

        // 9. Return Data for Email
        return new Response(JSON.stringify({
            status: 'success',
            email: fields.Email,
            user: fields.User || 'Client',
            mailtoLink: mailtoLink,
            downloadLink: downloadLink
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("❌ Auto-Runner Error:", error);
        return new Response(JSON.stringify({ status: 'error', error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
