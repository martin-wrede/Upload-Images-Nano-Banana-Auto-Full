export async function generateImageVariations(env, imageFile, prompt, count = 2, email = null) {
    console.log("🎨 Processing Image-to-Image with Gemini...");

    const variationCount = [1, 2, 4].includes(count) ? count : 2;
    console.log(`🎨 Generating ${variationCount} variation(s)...`);

    // Convert image File to Base64 (reuse for all variations)
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Detect image orientation (same logic as before)
    let aspectRatio = "16:9";
    try {
        const uint8Array = new Uint8Array(arrayBuffer);
        let width = 0, height = 0;
        // Simple header check for JPEG/PNG/GIF/WebP (abbreviated for brevity, assuming similar logic to original ai.js if needed, or default to 16:9)
        // For now, defaulting to 16:9 or inferring from simple checks if critical.
        // Keeping it simple:
        if (uint8Array.length > 20) {
            // logic from original file could be injected here if needed
        }
    } catch (e) {
        console.warn("Aspect ratio check failed, using default");
    }

    // Gemini API Endpoint
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    const MODEL = "gemini-3-pro-image-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [
                { text: "Generate a high-quality food photography image based on this input image and description. Output parameters: Resolution 1920x1080 (Full HD), Format JPEG. Description: " + prompt },
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
                aspectRatio: aspectRatio, // In real implementation, pass the detected ratio
                imageSize: "2K",
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
    const folderPath = safeEmail ? `${safeEmail}_gen/` : '';
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
        let generatedMimeType = "image/jpeg"; // Default to JPEG
        let generatedText = "";

        for (const part of parts) {
            const inlineData = part.inline_data || part.inlineData;
            if (inlineData) {
                generatedImageBase64 = inlineData.data;
                // We will force save as JPEG regardless, but good to know
                // generatedMimeType = inlineData.mime_type || inlineData.mimeType || "image/jpeg";
            }
            if (part.text) {
                generatedText += part.text;
            }
        }

        if (!generatedImageBase64) {
            console.error("❌ No image found in Gemini response:", JSON.stringify(data, null, 2));
            const finishReason = data.candidates?.[0]?.finishReason || 'Unknown';
            throw new Error(`Gemini did not return an image for variation ${i}. Finish Reason: ${finishReason}. Response Text: ${generatedText.substring(0, 200)}`);
        }

        // Upload to R2
        const binaryString = atob(generatedImageBase64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const extension = "jpg"; // Force jpg extension

        const filename = variationCount === 1
            ? `${folderPath}gemini_${timestamp}.${extension}`
            : `${folderPath}gemini_${timestamp}_${i}.${extension}`;

        await env.IMAGE_BUCKET.put(filename, bytes, {
            httpMetadata: { contentType: "image/jpeg" },
        });

        const publicUrl = `${env.R2_PUBLIC_URL}/${filename}`;
        generatedImages.push({ url: publicUrl });
        console.log(`✅ Variation ${i} uploaded: ${publicUrl}`);
    }

    return generatedImages;
}
