export async function getPendingRecords(env) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID1}/${env.AIRTABLE_TABLE_NAME1}`;

    // Filter: Created in last 24h AND has Order_Package
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
    return data.records || [];
}

export async function updateRecord(env, recordId, fields) {
    const airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID1}/${env.AIRTABLE_TABLE_NAME1}/${recordId}`;

    // We only update Image_Upload2, so we can use PATCH
    const response = await fetch(airtableUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Airtable update failed: ${response.status} - ${errText}`);
    }

    return await response.json();
}
