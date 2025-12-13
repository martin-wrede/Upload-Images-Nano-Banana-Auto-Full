// functions/lib/email.js
// Email service using mailto links (no external email service required)

/**
 * Generate mailto link with pre-filled email content
 * @param {string} toEmail - Recipient email address
 * @param {string} clientName - Client name (optional)
 * @param {string} downloadLink - R2 download page URL
 * @param {number} imageCount - Number of generated images
 * @returns {string} Mailto link
 */
export function generateMailtoLink(toEmail, clientName, downloadLink, imageCount = 0) {
    const greeting = clientName ? `Hello ${clientName}` : 'Hello';
    const imageText = imageCount > 0 
        ? `We've generated ${imageCount} high-quality image${imageCount > 1 ? 's' : ''} for you.`
        : 'Your images are ready for download.';

    const subject = 'Your AI-Generated Images are Ready! 🎨';
    
    const body = `${greeting},

Great news! Your AI-generated images have been processed and are ready for download.

${imageText}

🔗 Download Link:
${downloadLink}

What's next?
• Click the link above to view and download all your images
• Each image can be downloaded individually
• Your download link is available for 30 days

If you have any questions or need assistance, feel free to reach out to us.

Best regards,
Your AI Image Team

---
This is an automated message.
© ${new Date().getFullYear()} AI Image Processing Service`;

    // URL encode the subject and body
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);

    return `mailto:${toEmail}?subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Send email by triggering system email client via fetch API
 * This will return the mailto link for use in the UI or logs
 * @param {object} env - Environment variables
 * @param {string} toEmail - Recipient email address
 * @param {string} clientName - Client name (optional)
 * @param {string} downloadLink - R2 download page URL
 * @param {number} imageCount - Number of generated images
 * @returns {Promise<object>} Object with mailto link and success status
 */
export async function sendDownloadLinkEmail(env, toEmail, clientName, downloadLink, imageCount = 0) {
    try {
        const mailtoLink = generateMailtoLink(toEmail, clientName, downloadLink, imageCount);
        
        console.log(`📧 Email prepared for ${toEmail}`);
        console.log(`📎 Mailto link: ${mailtoLink}`);
        
        // Return the mailto link for use in the response
        return {
            success: true,
            mailtoLink: mailtoLink,
            recipient: toEmail
        };

    } catch (error) {
        console.error(`❌ Failed to prepare email for ${toEmail}:`, error.message);
        return {
            success: false,
            error: error.message,
            recipient: toEmail
        };
    }
}
