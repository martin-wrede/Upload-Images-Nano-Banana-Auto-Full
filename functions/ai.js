
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
        responseModalities: ["IMAGE"],
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
    // Note: The structure depends on the model's output. 
    // For image generation models, it might be in candidates[0].content.parts
    // But gemini-3-pro-image-preview might return text if it's just describing? 
    // Wait, the docs say "Bildbearbeitung (Text-und-Bild-zu-Bild)" returns an image.

    const parts = data.candidates?.[0]?.content?.parts || [];
    let generatedImageBase64 = null;
    let generatedMimeType = "image/png";

    for (const part of parts) {
      if (part.inline_data) {
        generatedImageBase64 = part.inline_data.data;
        generatedMimeType = part.inline_data.mime_type || "image/png";
        break;
      }
    }

    if (!generatedImageBase64) {
      console.error("No image found in Gemini response:", JSON.stringify(data, null, 2));
      throw new Error("Gemini did not return an image. It might have returned text only.");
    }

    // Upload to R2
    const binaryString = atob(generatedImageBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const filename = `gemini_${Date.now()}.png`;
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
