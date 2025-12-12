// functions/api/get-client-records.js
// Fetch client records from Airtable for admin management

export async function onRequest({ request, env }) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const since = body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID1}/${env.AIRTABLE_TABLE_NAME1}`;

        // Filter: Created since the specified time
        const filterFormula = `IS_AFTER({Timestamp}, '${since}')`;
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
        
        return new Response(JSON.stringify({ records: data.records || [] }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        console.error('Error fetching client records:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
