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

    // Load configuration on mount
    useEffect(() => {
        loadConfig();
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
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        backgroundColor: detail.status === 'success' ? '#E8F5E9' : '#FFEBEE',
                                        borderRadius: '4px',
                                        borderLeft: `4px solid ${detail.status === 'success' ? '#4CAF50' : '#F44336'}`
                                    }}>
                                        <div style={{ fontWeight: 'bold' }}>{detail.email}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                            {detail.status === 'success'
                                                ? `✅ ${detail.imagesProcessed} images → ${detail.variationsGenerated} variations`
                                                : `❌ ${detail.reason || 'Processing failed'}`
                                            }
                                        </div>
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
