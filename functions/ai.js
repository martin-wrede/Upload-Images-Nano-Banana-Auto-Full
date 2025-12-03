
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

    // Convert image File to Base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Gemini API Endpoint
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    const MODEL = "gemini-3-pro-image-preview"; // Or "gemini-2.5-flash-image" if preferred/available
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Construct Payload
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
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
      },
    };

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
    // Gemini returns inline data (Base64) or text. We expect an image.

    const parts = data.candidates?.[0]?.content?.parts || [];
    let generatedImageBase64 = null;
    let generatedMimeType = "image/png";

    for (const part of parts) {
      const inlineData = part.inline_data || part.inlineData;
      if (inlineData) {
        generatedImageBase64 = inlineData.data;
        generatedMimeType = inlineData.mime_type || inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!generatedImageBase64) {
      console.error("No image found in Gemini response:", JSON.stringify(data, null, 2));
      throw new Error(`[v4-11:05] Gemini did not return an image. Response: ${JSON.stringify(data)}`);
    }

    // Upload to R2
    const binaryString = atob(generatedImageBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const extension = generatedMimeType.split("/")[1] || "png";

    // Sanitize email and create folder path with _gen suffix
    const safeEmail = email ? email.replace(/[^a-zA-Z0-9]/g, '_') : null;
    const folderPath = safeEmail ? `${safeEmail}_gen/` : '';
    const filename = `${folderPath}gemini_${Date.now()}.${extension}`;

    await env.IMAGE_BUCKET.put(filename, bytes, {
      httpMetadata: { contentType: generatedMimeType },
    });

    const publicUrl = `${env.R2_PUBLIC_URL}/${filename}`;
    console.log("✅ Image uploaded to R2:", publicUrl);

    // Return format matching frontend expectation: { data: [{ url: ... }] }
    return new Response(JSON.stringify({ data: [{ url: publicUrl }] }), {
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
