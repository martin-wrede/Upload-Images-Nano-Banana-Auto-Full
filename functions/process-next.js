import { getPendingRecords, updateRecord } from './lib/airtable';
import { generateImageVariations } from './lib/gemini';

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

        // 3. Prepare Prompt
        const defaultPrompt = env.DEFAULT_FOOD_PROMPT ||
            'Professional food photography, high quality, well-lit, appetizing presentation';
        const clientPrompt = fields.Prompt || '';
        const finalPrompt = (env.USE_DEFAULT_PROMPT !== 'false')
            ? `${defaultPrompt}. ${clientPrompt}`
            : clientPrompt;

        // 4. Get Images
        const imageUpload1 = fields.Image_Upload || [];
        const imageUpload2 = fields.Image_Upload2 || [];
        const allImages = [...imageUpload1, ...imageUpload2];

        if (allImages.length === 0) {
            return new Response(JSON.stringify({ status: 'error', message: 'Record has no images.' }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 5. Process Images (Generating variations)
        const allGeneratedLinks = [];

        for (const img of allImages) {
            console.log(`🖼️ Fetching source image: ${img.url}`);
            if (!img.url) {
                console.error("❌ Image URL is missing for record", record.id);
                continue;
            }

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

        // 6. Update Airtable (Save results)
        if (allGeneratedLinks.length > 0) {
            // We just save the first one to the 'Image_Upload2' column for reference, or all?
            // The original code saved the first one. Let's stick to that for the DB update
            // but return ALL links to the frontend for the email.
            const firstImage = allGeneratedLinks[0];
            await updateRecord(env, record.id, {
                Image_Upload2: [{ url: firstImage.url }]
            });
        }

        // 7. Return Data for Email
        return new Response(JSON.stringify({
            status: 'success',
            email: fields.Email,
            user: fields.User || 'Client',
            links: allGeneratedLinks.map(l => l.url)
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
