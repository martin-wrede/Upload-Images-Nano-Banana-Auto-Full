export const IMAGE_CONFIG = {
    // Target resolution for the downloadable images
    width: 1920,
    height: 1080,
    quality: 80, // JPEG Quality (1-100)
    // Quality hint for the prompt (e.g., "High Quality", "Efficient Compression")
    qualityHint: "High Quality, Efficient JPEG",
    // Folder suffix for the downloadable images
    folderSuffix: '_down'
};

export async function generateImageVariations(env, imageFile, prompt, count = 2, email = null) {
    console.log("🎨 Processing Image-to-Image with Gemini...");

    const variationCount = [1, 2, 4].includes(count) ? count : 2;
    console.log(`🎨 Generating ${variationCount} variation(s)...`);

    // Convert image File to Base64 (reuse for all variations)
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Detect image orientation (simple check)
    let aspectRatio = "16:9";
    try {
        const uint8Array = new Uint8Array(arrayBuffer);
        if (uint8Array.length > 20) {
            // Placeholder for real orientation check if needed
        }
    } catch (e) {
        console.warn("Aspect ratio check failed, using default");
    }

    // Gemini API Endpoint
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    const MODEL = "gemini-3-pro-image-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Construct precise prompt with config
    const resolutionText = `Resolution ${IMAGE_CONFIG.width}x${IMAGE_CONFIG.height}`;
    const qualityText = IMAGE_CONFIG.qualityHint;
    const fullSystemPrompt = `Generate a food photography image based on input. Output parameters: ${resolutionText}, ${qualityText}, Format JPEG. Description: ${prompt}`;

    const payload = {
        contents: [{
            parts: [
                { text: fullSystemPrompt },
                {
                    inline_data: {
                        mime_type: imageFile.type || "image/jpeg",
                        data: base64Image,
                    },
                },
            ],
        }],
        generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: "2K", // Requesting high res base
            },
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    const safeEmail = email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'anonymous';
    // Original generation folder
    const genFolderPath = safeEmail ? `${safeEmail}_gen/` : '';
    // Downloadable folder
    const downFolderPath = safeEmail ? `${safeEmail}${IMAGE_CONFIG.folderSuffix}/` : `anonymous${IMAGE_CONFIG.folderSuffix}/`;

    const timestamp = Date.now();
    const generatedImages = [];

    for (let i = 1; i <= variationCount; i++) {
        console.log(`🖼️ Generating variation ${i}/${variationCount}...`);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`Gemini API Failed: ${response.status} ${response.statusText}`);
            console.error("Gemini Error Body:", JSON.stringify(data, null, 2));
            throw new Error(`Gemini API Error: ${response.status} - ${data.error?.message || response.statusText}`);
        }

        // Extract Image
        const parts = data.candidates?.[0]?.content?.parts || [];
        let generatedImageBase64 = null;
        let generatedText = "";

        for (const part of parts) {
            const inlineData = part.inline_data || part.inlineData;
            if (inlineData) {
                generatedImageBase64 = inlineData.data;
            }
            if (part.text) {
                generatedText += part.text;
            }
        }

        if (!generatedImageBase64) {
            console.error("❌ No image found in Gemini response:", JSON.stringify(data, null, 2));
            const finishReason = data.candidates?.[0]?.finishReason || 'Unknown';
            throw new Error(`Gemini did not return an image for variation ${i}. Finish Reason: ${finishReason}.`);
        }

        // Decode initial bytes
        const binaryString = atob(generatedImageBase64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const extension = "jpg";

        // 1. Save Original to _gen (Backup/Reference)
        const filenameGen = variationCount === 1
            ? `${genFolderPath}gemini_${timestamp}.${extension}`
            : `${genFolderPath}gemini_${timestamp}_${i}.${extension}`;

        await env.IMAGE_BUCKET.put(filenameGen, bytes, {
            httpMetadata: { contentType: "image/jpeg" },
        });
        console.log(`✅ Saved backup to: ${filenameGen}`);

        // 2. Resize/Compress for _down (Downloadable)
        let processedBytes = bytes;
        try {
            console.log(`📐 Resizing to ${IMAGE_CONFIG.width}x${IMAGE_CONFIG.height} @ ${IMAGE_CONFIG.quality}% quality...`);

            // Dynamic import of Jimp to avoid top-level require issues if bundling behaves oddly
            const Jimp = (await import('jimp')).default;

            // Read buffer
            const image = await Jimp.read(Buffer.from(bytes));

            image.resize(IMAGE_CONFIG.width, IMAGE_CONFIG.height);   // Resize
            image.quality(IMAGE_CONFIG.quality);                     // Set JPEG quality

            const resizedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
            processedBytes = new Uint8Array(resizedBuffer);

            console.log(`✅ Resize successful. Size: ${bytes.length} -> ${processedBytes.length} bytes`);
        } catch (resizeError) {
            console.error("⚠️ Resizing failed, falling back to original:", resizeError);
            // We print stack to see WHY it failed if it does
            if (resizeError.stack) console.error(resizeError.stack);
        }

        const filenameDown = variationCount === 1
            ? `${downFolderPath}image_${timestamp}.${extension}`
            : `${downFolderPath}image_${timestamp}_${i}.${extension}`;

        await env.IMAGE_BUCKET.put(filenameDown, processedBytes, {
            httpMetadata: { contentType: "image/jpeg" },
        });

        const publicUrl = `${env.R2_PUBLIC_URL}/${filenameDown}`;
        generatedImages.push({ url: publicUrl }); // Return the DOWNLOAD url
        console.log(`✅ Variation ${i} uploaded to Download folder: ${publicUrl}`);
    }

    return generatedImages;
}
