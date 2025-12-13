import React, { useState, useEffect } from 'react';

function AdminAutomation() {
    // Configuration state
    const [config, setConfig] = useState({
        enabled: false,
        defaultPrompt: 'Professional food photography, high quality, well-lit, appetizing presentation, restaurant quality',
        useDefaultPrompt: true,
        variationCount: 2,
        schedule: 6, // hours
    });

    // Processing state
    const [processing, setProcessing] = useState(false);
    const [lastRun, setLastRun] = useState(null);
    const [processingResults, setProcessingResults] = useState(null);

    // Client prompts state
    const [clientRecords, setClientRecords] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState(null);

    // Load configuration on mount
    useEffect(() => {
        loadConfig();
        loadClients();
    }, []);

    const loadConfig = async () => {
        // For now, use local state. In production, fetch from API
        const saved = localStorage.getItem('automationConfig');
        if (saved) {
            setConfig(JSON.parse(saved));
        }
    };

    const saveConfig = () => {
        localStorage.setItem('automationConfig', JSON.stringify(config));
        alert('✅ Configuration saved!');
    };

    const loadClients = async () => {
        setLoadingClients(true);
        try {
            // Fetch last 24 hours of records with prompts
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const response = await fetch('/api/get-client-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ since: twentyFourHoursAgo })
            });

            if (response.ok) {
                const data = await response.json();
                // Add active state to each record (default true)
                const recordsWithState = data.records.map(record => ({
                    ...record,
                    active: record.fields.Active !== false // default true unless explicitly false
                }));
                setClientRecords(recordsWithState);
            } else {
                console.error('Failed to load client records');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoadingClients(false);
        }
    };

    const updateClientPrompt = async (recordId, newPrompt) => {
        try {
            const response = await fetch('/api/update-client-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId, prompt: newPrompt })
            });

            if (response.ok) {
                // Update local state
                setClientRecords(prev => prev.map(record => 
                    record.id === recordId 
                        ? { ...record, fields: { ...record.fields, Prompt: newPrompt } }
                        : record
                ));
                setEditingPrompt(null);
                alert('✅ Client prompt updated!');
            } else {
                alert('❌ Failed to update prompt');
            }
        } catch (error) {
            console.error('Error updating prompt:', error);
            alert('❌ Error updating prompt: ' + error.message);
        }
    };

    const toggleClientActive = (recordId) => {
        setClientRecords(prev => prev.map(record => 
            record.id === recordId 
                ? { ...record, active: !record.active }
                : record
        ));
    };

    const manualTrigger = async () => {
        if (!confirm('Run automated processing now? This will process all new records from the last 24 hours.')) {
            return;
        }

        setProcessing(true);
        setProcessingResults(null);

        try {
            const response = await fetch('/scheduled-processor', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Processing failed');
            }

            const results = await response.json();
            setProcessingResults(results);
            setLastRun(new Date().toISOString());

            alert(`✅ Processing complete!\n\nRecords found: ${results.recordsFound}\nSuccessfully processed: ${results.successCount}\nErrors: ${results.errorCount}`);

        } catch (error) {
            console.error('Error triggering processing:', error);
            alert('❌ Failed to trigger processing: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'Arial', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>⚙️ Admin Automation Control</h1>
            <p>Configure and control automated image processing</p>

            {/* Configuration Panel */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid #FF9800', borderRadius: '8px', backgroundColor: '#FFF3E0' }}>
                <h2 style={{ marginTop: 0 }}>🔧 Configuration</h2>

                {/* Enable/Disable */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '1.1rem' }}>
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                            style={{ width: '20px', height: '20px', marginRight: '0.5rem' }}
                        />
                        <strong>Enable Automated Processing</strong>
                    </label>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1.7rem', marginTop: '0.25rem' }}>
                        When enabled, the system will automatically process new records every {config.schedule} hours
                    </p>
                </div>

                {/* Schedule */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        Processing Schedule:
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="schedule"
                                value={6}
                                checked={config.schedule === 6}
                                onChange={(e) => setConfig({ ...config, schedule: parseInt(e.target.value) })}
                            />
                            {' '}Every 6 hours
                        </label>
                        <label style={{ cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="schedule"
                                value={24}
                                checked={config.schedule === 24}
                                onChange={(e) => setConfig({ ...config, schedule: parseInt(e.target.value) })}
                            />
                            {' '}Every 24 hours
                        </label>
                    </div>
                </div>

                {/* Variation Count */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        Variations per Image:
                    </label>
                    <select
                        value={config.variationCount}
                        onChange={(e) => setConfig({ ...config, variationCount: parseInt(e.target.value) })}
                        style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        <option value={1}>1 variation</option>
                        <option value={2}>2 variations (recommended)</option>
                        <option value={4}>4 variations</option>
                    </select>
                </div>

                {/* Default Prompt */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={config.useDefaultPrompt}
                            onChange={(e) => setConfig({ ...config, useDefaultPrompt: e.target.checked })}
                            style={{ width: '18px', height: '18px', marginRight: '0.5rem' }}
                        />
                        <strong>Use Default Food Photo Prompt</strong>
                    </label>
                    <textarea
                        value={config.defaultPrompt}
                        onChange={(e) => setConfig({ ...config, defaultPrompt: e.target.value })}
                        disabled={!config.useDefaultPrompt}
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '0.95rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            opacity: config.useDefaultPrompt ? 1 : 0.5,
                            backgroundColor: config.useDefaultPrompt ? 'white' : '#f5f5f5'
                        }}
                        placeholder="Enter default prompt for food photos..."
                    />
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                        {config.useDefaultPrompt
                            ? '✅ This prompt will be combined with each client\'s custom prompt'
                            : '⏭️ Only client prompts will be used'}
                    </p>
                </div>

                {/* Save Button */}
                <button
                    onClick={saveConfig}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                    }}
                >
                    💾 Save Configuration
                </button>
            </div>

            {/* Client Prompts Management */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid #9C27B0', borderRadius: '8px', backgroundColor: '#F3E5F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>📄 Client Prompts (Last 24h)</h2>
                    <button
                        onClick={loadClients}
                        disabled={loadingClients}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: loadingClients ? '#ccc' : '#9C27B0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loadingClients ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        {loadingClients ? '⏳ Loading...' : '🔄 Refresh'}
                    </button>
                </div>

                {loadingClients ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        Loading client records...
                    </div>
                ) : clientRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666', backgroundColor: 'white', borderRadius: '4px' }}>
                        No client records found in the last 24 hours.
                    </div>
                ) : (
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {clientRecords.map((record) => (
                            <div
                                key={record.id}
                                style={{
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: `2px solid ${record.active ? '#9C27B0' : '#ccc'}`,
                                    opacity: record.active ? 1 : 0.6
                                }}
                            >
                                {/* Header with email and toggle */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={record.active}
                                                onChange={() => toggleClientActive(record.id)}
                                                style={{ width: '18px', height: '18px', marginRight: '0.5rem' }}
                                            />
                                            <strong style={{ fontSize: '1rem' }}>{record.fields.Email}</strong>
                                        </label>
                                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                            ({record.active ? '✅ Active' : '❌ Inactive'})
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                        {record.fields.Timestamp ? new Date(record.fields.Timestamp).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>

                                {/* Prompt editor */}
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#9C27B0' }}>
                                        Client Prompt:
                                    </label>
                                    {editingPrompt === record.id ? (
                                        <div>
                                            <textarea
                                                defaultValue={record.fields.Prompt || ''}
                                                id={`prompt-${record.id}`}
                                                rows={3}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    fontSize: '0.9rem',
                                                    borderRadius: '4px',
                                                    border: '2px solid #9C27B0',
                                                    fontFamily: 'Arial, sans-serif'
                                                }}
                                                placeholder="Enter client's custom prompt..."
                                            />
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <button
                                                    onClick={() => {
                                                        const newPrompt = document.getElementById(`prompt-${record.id}`).value;
                                                        updateClientPrompt(record.id, newPrompt);
                                                    }}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: '#4CAF50',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    ✅ Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingPrompt(null)}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: '#999',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    ❌ Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div
                                                style={{
                                                    padding: '0.75rem',
                                                    backgroundColor: '#f5f5f5',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem',
                                                    fontStyle: record.fields.Prompt ? 'normal' : 'italic',
                                                    color: record.fields.Prompt ? '#333' : '#999',
                                                    minHeight: '60px',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {record.fields.Prompt || 'No custom prompt set'}
                                            </div>
                                            <button
                                                onClick={() => setEditingPrompt(record.id)}
                                                style={{
                                                    marginTop: '0.5rem',
                                                    padding: '0.5rem 1rem',
                                                    backgroundColor: '#9C27B0',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                ✏️ Edit Prompt
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem', marginBottom: 0 }}>
                    ℹ️ <strong>Note:</strong> Use the checkbox to activate/deactivate each client. Only active clients will be processed during automation.
                </p>
            </div>

            {/* Manual Control */}
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid #2196F3', borderRadius: '8px', backgroundColor: '#E3F2FD' }}>
                <h2 style={{ marginTop: 0 }}>🎮 Manual Control</h2>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        onClick={manualTrigger}
                        disabled={processing}
                        style={{
                            padding: '1rem 2rem',
                            backgroundColor: processing ? '#ccc' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: processing ? 'not-allowed' : 'pointer',
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {processing ? '⏳ Processing...' : '▶️ Run Now'}
                    </button>

                    {lastRun && (
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            Last run: {new Date(lastRun).toLocaleString()}
                        </div>
                    )}
                </div>

                <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
                    Manually trigger processing for all new records from the last 24 hours
                </p>
            </div>

            {/* Processing Results */}
            {processingResults && (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid #4CAF50', borderRadius: '8px', backgroundColor: '#E8F5E9' }}>
                    <h2 style={{ marginTop: 0 }}>📊 Last Processing Results</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196F3' }}>
                                {processingResults.recordsFound}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>Records Found</div>
                        </div>
                        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>
                                {processingResults.successCount}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>Successful</div>
                        </div>
                        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#F44336' }}>
                                {processingResults.errorCount}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>Errors</div>
                        </div>
                        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF9800' }}>
                                {processingResults.durationMs ? (processingResults.durationMs / 1000).toFixed(1) : 'N/A'}s
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>Duration</div>
                        </div>
                    </div>

                    {/* Details */}
                    {processingResults.details && processingResults.details.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h3>Processing Details:</h3>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
                                {processingResults.details.map((detail, index) => (
                                    <div key={index} style={{
                                        padding: '1rem',
                                        marginBottom: '0.75rem',
                                        backgroundColor: detail.status === 'success' ? '#E8F5E9' : '#FFEBEE',
                                        borderRadius: '4px',
                                        borderLeft: `4px solid ${detail.status === 'success' ? '#4CAF50' : '#F44336'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{detail.email}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                    {detail.status === 'success'
                                                        ? `✅ ${detail.imagesProcessed} images → ${detail.variationsGenerated || 0} variations`
                                                        : `❌ ${detail.reason || detail.note || 'Processing failed'}`
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Show action buttons only for successful processing with download link */}
                                        {detail.status === 'success' && detail.downloadLink && (
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                                {/* Send Email Button (mailto link) */}
                                                {detail.mailtoLink && (
                                                    <a
                                                        href={detail.mailtoLink}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            backgroundColor: '#9C27B0',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            textDecoration: 'none',
                                                            display: 'inline-block',
                                                            fontWeight: 'bold'
                                                        }}
                                                        title="Open email client to send download link"
                                                    >
                                                        📧 Send Email
                                                    </a>
                                                )}
                                                
                                                {/* View Download Page Button */}
                                                <a
                                                    href={detail.downloadLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: '#2196F3',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        textDecoration: 'none',
                                                        display: 'inline-block'
                                                    }}
                                                    title="View download page"
                                                >
                                                    🔗 View Download Page
                                                </a>
                                                
                                                {/* Copy Link Button */}
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(detail.downloadLink);
                                                        alert('✅ Download link copied to clipboard!');
                                                    }}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: '#FF9800',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem'
                                                    }}
                                                    title="Copy download link to clipboard"
                                                >
                                                    📋 Copy Link
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Errors */}
                    {processingResults.errors && processingResults.errors.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h3 style={{ color: '#F44336' }}>Errors:</h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#FFEBEE', padding: '1rem', borderRadius: '4px' }}>
                                {processingResults.errors.map((error, index) => (
                                    <div key={index} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <strong>{error.email || error.type}:</strong> {error.error}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div style={{ padding: '1rem', backgroundColor: '#FFF9C4', border: '1px solid #FBC02D', borderRadius: '4px' }}>
                <strong>ℹ️ How it works:</strong>
                <ul style={{ marginBottom: 0, paddingLeft: '1.5rem' }}>
                    <li>System checks for new Airtable records every {config.schedule} hours (when enabled)</li>
                    <li>Only processes records from the last 24 hours with Order_Package</li>
                    <li>Records must have Image_Upload but no Image_Upload2</li>
                    <li>Generated images are saved to Image_Upload2 field</li>
                    <li>Use "Run Now" to manually trigger processing at any time</li>
                </ul>
            </div>
        </div>
    );
}

export default AdminAutomation;
