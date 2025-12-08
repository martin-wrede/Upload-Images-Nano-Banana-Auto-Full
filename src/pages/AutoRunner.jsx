import React, { useState, useEffect } from 'react';

function AutoRunner() {
    const [status, setStatus] = useState('Idle');
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [lastRun, setLastRun] = useState(null);

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    };

    const runProcess = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setStatus('Checking for work...');
        addLog('Checking for pending records...');

        try {
            const response = await fetch('/process-next', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'no_work') {
                setStatus('No pending work found.');
                addLog('No pending work found.');
            } else if (data.status === 'success') {
                setStatus('Processing complete! Opening email...');
                addLog(`Processed record for ${data.email}. Found ${data.links.length} images.`);

                // Open Email
                openEmailClient(data.email, data.user, data.links);
            } else {
                setStatus('Error: ' + data.error);
                addLog('Error: ' + (data.error || data.message));
            }

        } catch (error) {
            console.error(error);
            setStatus('Network Error');
            addLog('Network Error: ' + error.message);
        } finally {
            setIsRunning(false);
            setLastRun(new Date());
        }
    };

    const openEmailClient = (email, user, links) => {
        const subject = encodeURIComponent("Your High-End AI Food Photos are Ready! 📸✨");

        let body = `Hi ${user},\n\n`;
        body += `Your AI-enhanced food photos are ready! We have processed them to look professional and appetizing.\n\n`;
        body += `Here are your download links:\n\n`;

        links.forEach((link, index) => {
            body += `Image ${index + 1}: ${link}\n`;
        });

        body += `\n\nEnjoy your new images!\nBest regards,\nThe Automation Team`;

        const mailtoLink = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`;

        // Open in new window/tab to trigger local client
        window.location.href = mailtoLink;
    };

    // Auto-start on load (optional, currently manual start button for safety)
    // useEffect(() => { runProcess(); }, []);

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
            <h1>🤖 Auto Runner</h1>

            <div style={{ padding: '1rem', border: '2px solid #333', marginBottom: '1rem', borderRadius: '8px' }}>
                <h3>Status: <span style={{ color: isRunning ? 'orange' : 'green' }}>{status}</span></h3>
                <p>Last Run: {lastRun ? lastRun.toLocaleTimeString() : 'Never'}</p>

                <button
                    onClick={runProcess}
                    disabled={isRunning}
                    style={{
                        padding: '1rem 2rem',
                        fontSize: '1.2rem',
                        backgroundColor: isRunning ? '#ccc' : '#2196F3',
                        color: 'white',
                        border: 'none',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        borderRadius: '4px'
                    }}
                >
                    {isRunning ? 'Running...' : '🚀 Run Now'}
                </button>
            </div>

            <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '8px', height: '400px', overflowY: 'auto' }}>
                <h4 style={{ marginTop: 0 }}>Execution Log:</h4>
                {logs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #ddd', padding: '0.25rem 0' }}>{log}</div>
                ))}
            </div>
        </div>
    );
}

export default AutoRunner;
