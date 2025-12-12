// functions/api/update-client-prompt.js
// Update a client's prompt in Airtable

export async function onRequest({ request, env }) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { recordId, prompt } = body;

        if (!recordId) {
            return new Response(JSON.stringify({ error: 'recordId is required' }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID1}/${env.AIRTABLE_TABLE_NAME1}/${recordId}`;

        const response = await fetch(airtableUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fields: {
                    Prompt: prompt || ''
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Airtable update failed: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        return new Response(JSON.stringify({ success: true, record: data }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        console.error('Error updating client prompt:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
