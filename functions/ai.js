
// functions/ai.js

export async function onRequest({ request, env }) {
  // ✅ CORS Preflight Handling
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // ✅ Only accept POST
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt");
    const imageFile = formData.get("image");
    const email = formData.get("email");

    if (!prompt || !imageFile) {
      return new Response(
        JSON.stringify({ error: "Both 'prompt' and 'image' are required for Image-to-Image." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("🎨 Processing Image-to-Image with Gemini...");

    // Get variation count from request
    const count = parseInt(formData.get("count")) || 1;
    const validCounts = [1, 2, 4];
    const variationCount = validCounts.includes(count) ? count : 1;

    console.log(`🎨 Generating ${variationCount} variation(s)...`);

    // Convert image File to Base64 (do this once, reuse for all variations)
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Detect image orientation for aspect ratio
    // Note: createImageBitmap is not available in Cloudflare Workers
    // We'll read dimensions from image file headers instead
    let aspectRatio = "16:9"; // Default to landscape
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      let width = 0;
      let height = 0;

      // Detect image type and extract dimensions
      if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
        // JPEG
        let offset = 2;
        while (offset < uint8Array.length) {
          if (uint8Array[offset] !== 0xFF) break;
          const marker = uint8Array[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            height = (uint8Array[offset + 5] << 8) | uint8Array[offset + 6];
            width = (uint8Array[offset + 7] << 8) | uint8Array[offset + 8];
            break;
          }
          offset += 2 + ((uint8Array[offset + 2] << 8) | uint8Array[offset + 3]);
        }
      } else if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
        // PNG
        width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19];
        height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23];
      } else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
        // GIF
        width = uint8Array[6] | (uint8Array[7] << 8);
        height = uint8Array[8] | (uint8Array[9] << 8);
      } else if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
        // WebP
        if (uint8Array[12] === 0x56 && uint8Array[13] === 0x50 && uint8Array[14] === 0x38) {
          width = ((uint8Array[26] | (uint8Array[27] << 8) | (uint8Array[28] << 16)) & 0x3FFF) + 1;
          height = ((uint8Array[29] | (uint8Array[30] << 8) | (uint8Array[31] << 16)) & 0x3FFF) + 1;
        }
      }

      if (width > 0 && height > 0) {
        if (height > width) {
          aspectRatio = "9:16"; // Portrait
        } else {
          aspectRatio = "16:9"; // Landscape
        }
        console.log(`📐 Detected image dimensions: ${width}x${height}, using aspect ratio: ${aspectRatio}`);
      } else {
        console.warn("⚠️ Could not detect image dimensions from headers, using default 16:9");
      }
    } catch (error) {
      console.warn("⚠️ Error detecting image dimensions, using default 16:9:", error);
    }

    // Gemini API Endpoint
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    const MODEL = "gemini-3-pro-image-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Construct Payload (reuse for all variations)
    const payload = {
      contents: [
        {
          parts: [
            { text: "Generate a high-quality food photography image based on this input image and description: " + prompt },
            {
              inline_data: {
                mime_type: imageFile.type || "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio,
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

    // Prepare folder path
    const safeEmail = email ? email.replace(/[^a-zA-Z0-9]/g, '_') : null;
    const folderPath = safeEmail ? `${safeEmail}_gen/` : '';
    const timestamp = Date.now();

    // Array to store all generated image URLs
    const generatedImages = [];

    // Loop to generate variations
    for (let i = 1; i <= variationCount; i++) {
      console.log(`🖼️ Generating variation ${i}/${variationCount}...`);

      // Make API call
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error:", data);
        throw new Error(data.error?.message || "Failed to generate image with Gemini.");
      }

      // Extract Image from Response
      const parts = data.candidates?.[0]?.content?.parts || [];
      let generatedImageBase64 = null;
      let generatedMimeType = "image/png";
      let generatedText = "";

      for (const part of parts) {
        const inlineData = part.inline_data || part.inlineData;
        if (inlineData) {
          generatedImageBase64 = inlineData.data;
          generatedMimeType = inlineData.mime_type || inlineData.mimeType || "image/png";
        }
        if (part.text) {
          generatedText += part.text;
        }
      }

      if (!generatedImageBase64) {
        console.error("No image found in Gemini response:", JSON.stringify(data, null, 2));
        const finishReason = data.candidates?.[0]?.finishReason || 'Unknown';
        throw new Error(`Gemini did not return an image for variation ${i}. Finish Reason: ${finishReason}. Response Text: ${generatedText.substring(0, 200)}`);
      }

      // Upload to R2
      const binaryString = atob(generatedImageBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let j = 0; j < len; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      const extension = generatedMimeType.split("/")[1] || "png";

      // Create filename with numbered suffix only for multiple variations
      const filename = variationCount === 1
        ? `${folderPath}gemini_${timestamp}.${extension}`
        : `${folderPath}gemini_${timestamp}_${i}.${extension}`;

      await env.IMAGE_BUCKET.put(filename, bytes, {
        httpMetadata: { contentType: generatedMimeType },
      });

      const publicUrl = `${env.R2_PUBLIC_URL}/${filename}`;
      generatedImages.push({ url: publicUrl });

      console.log(`✅ Variation ${i} uploaded: ${publicUrl}`);
    }

    // Return all generated images
    return new Response(JSON.stringify({ data: generatedImages }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    console.error("❌ Error in /ai function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
