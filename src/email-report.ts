import { Resend } from 'resend';

import { InsertionResult } from './database';
import { Contact, Correction } from './types';

function log(...args: any[]) {
  console.log(...args);
}

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface ReportStats {
  query: string;
  totalContacts: number;
  inserted: number;
  updated: number;
  rejected: number;
  correctionsCount: number;
  runDate: string;
  runId: string;
}

// Generate HTML report from contacts, corrections, and stats
export function generateHtmlReport({
  stats,
  contacts,
  corrections,
  auditSummary,
}: {
  stats: ReportStats;
  contacts: Contact[];
  corrections: Correction[];
  auditSummary?: string;
}): string {
  const {
    query,
    totalContacts,
    inserted,
    updated,
    rejected,
    correctionsCount,
    runDate,
    runId,
  } = stats;

  // Generate contacts HTML
  const contactsHtml = contacts
    .slice(0, 10) // Show first 10 contacts in email for brevity
    .map((contact, index) => {
      const tagsDisplay = Array.isArray(contact.tags)
        ? contact.tags.join(', ')
        : contact.tags || '';

      return `
    <div class="contact-section">
        <h3>Contact ${index + 1}</h3>
        <ul>
            <li><strong>name:</strong> ${contact.name}</li>
            <li><strong>email:</strong> ${contact.email}</li>
            <li><strong>company:</strong> ${contact.company}</li>
            <li><strong>position:</strong> ${contact.position}</li>
            <li><strong>city:</strong> ${contact.city}</li>
            <li><strong>state-province:</strong> ${contact.stateProvince}</li>
            <li><strong>country:</strong> ${contact.country}</li>
            <li><strong>industry:</strong> ${contact.industry}</li>
            <li><strong>priority:</strong> ${contact.priority}</li>
            <li><strong>signal:</strong> ${contact.signal}</li>
            <li><strong>signal_level:</strong> ${contact.signalLevel}</li>
            <li><strong>tags:</strong> ${tagsDisplay}</li>
            ${contact.department ? `<li><strong>department:</strong> ${contact.department}</li>` : ''}
            ${contact.number ? `<li><strong>number:</strong> ${contact.number}</li>` : ''}
            ${contact.timeZone ? `<li><strong>time zone:</strong> ${contact.timeZone}</li>` : ''}
            <li><strong>links:</strong> ${contact.links ? `<a href="${contact.links}">${contact.links}</a>` : 'N/A'}</li>
            <li><strong>source:</strong> ${contact.source}</li>
        </ul>
    </div>`;
    })
    .join('\n    <hr>\n');

  // Generate corrections HTML
  const correctionsHtml = corrections
    .slice(0, 5) // Show first 5 corrections in email
    .map(
      (correction, index) => `
    <div class="correction-section">
        <h3>Correction ${index + 1}</h3>
        <ul>
            <li><strong>email:</strong> ${correction.email}</li>
            <li><strong>field:</strong> ${correction.field}</li>
            <li><strong>before:</strong> ${correction.before}</li>
            <li><strong>after:</strong> ${correction.after}</li>
            <li><strong>reason:</strong> ${correction.reason}</li>
        </ul>
    </div>`,
    )
    .join('\n');

  // Build audit summary section
  const auditSection = auditSummary
    ? `
    <h2>Audit Summary</h2>
    <div class="summary-stats">
        ${auditSummary.replace(/\n/g, '<br>')}
    </div>
    <hr>
  `
    : '';

  // Add truncation notice if needed
  const truncationNotice =
    contacts.length > 10
      ? `<p><em>Note: Showing first 10 of ${contacts.length} contacts. Full data available in database.</em></p>`
      : '';

  const correctionsTruncationNotice =
    corrections.length > 5
      ? `<p><em>Note: Showing first 5 of ${corrections.length} corrections.</em></p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deep Research Report — Run ${runId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }

        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }

        h2 {
            color: #34495e;
            margin-top: 30px;
        }

        h3 {
            color: #7f8c8d;
        }

        ul {
            padding-left: 20px;
        }

        .contact-section {
            background: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #3498db;
        }

        .correction-section {
            background: #fff3cd;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
        }

        .summary-stats {
            background: #e8f5e8;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }

        .error-section {
            background: #f8d7da;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #dc3545;
        }

        strong {
            color: #2c3e50;
        }

        a {
            color: #3498db;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        hr {
            border: none;
            border-top: 2px solid #ecf0f1;
            margin: 30px 0;
        }
    </style>
</head>

<body>
    <h1>Deep Research Report — Run ${runId} (${runDate})</h1>

    <h2>Query</h2>
    <p>${query}</p>

    <h2>Summary</h2>
    <div class="summary-stats">
        <ul>
            <li><strong>Total contacts found:</strong> ${totalContacts}</li>
            <li><strong>Inserted:</strong> ${inserted}</li>
            <li><strong>Updated:</strong> ${updated}</li>
            <li><strong>Rejected:</strong> ${rejected}</li>
            <li><strong>Corrections made:</strong> ${correctionsCount}</li>
        </ul>
    </div>

    <hr>

    ${auditSection}

    <h2>Contacts</h2>
    ${truncationNotice}

    ${contactsHtml}

    <hr>

    <h2>Corrections Log</h2>
    ${correctionsTruncationNotice}
    
    ${corrections.length > 0 ? correctionsHtml : '<p>No corrections were needed.</p>'}
</body>

</html>`;
}

// Retry function with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'operation',
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      log(`[Email][Retry] ${operationName} attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      log(`[Email][Retry] Retrying ${operationName} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Send email report via Resend
export async function sendEmailReport({
  htmlReport,
  stats,
  recipientEmail,
  fromEmail,
}: {
  htmlReport: string;
  stats: ReportStats;
  recipientEmail?: string;
  fromEmail?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if email reporting is enabled
  if (!process.env.RESEND_API_KEY) {
    log('[Email][Config] RESEND_API_KEY not configured, skipping email report');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const to = recipientEmail || process.env.RESEND_TO_EMAIL;
  const from =
    fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@example.com';

  if (!to) {
    log('[Email][Config] No recipient email configured, skipping email report');
    return { success: false, error: 'No recipient email configured' };
  }

  const subject = `Deep Research Report — ${stats.query} (${stats.totalContacts} contacts)`;

  try {
    const result = await withRetry(
      async () => {
        return await resend.emails.send({
          from,
          to,
          subject,
          html: htmlReport,
        });
      },
      3,
      'email send',
    );

    log(
      `[Email] Email report sent successfully to ${to}, message ID: ${result.data?.id}`,
    );
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    const errorMessage = `Failed to send email report: ${(error as Error).message}`;
    log(`[Email][Error] ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// Main function to generate and send email report
export async function generateAndSendReport({
  query,
  contacts,
  corrections,
  insertionResult,
  auditSummary,
  recipientEmail,
  fromEmail,
}: {
  query: string;
  contacts: Contact[];
  corrections: Correction[];
  insertionResult: InsertionResult;
  auditSummary?: string;
  recipientEmail?: string;
  fromEmail?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate run ID and date
    const runDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const runId = Date.now().toString().slice(-6); // Last 6 digits of timestamp

    // Create report stats
    const stats: ReportStats = {
      query,
      totalContacts: contacts.length,
      inserted: insertionResult.inserted,
      updated: insertionResult.updated,
      rejected: insertionResult.rejected,
      correctionsCount: corrections.length,
      runDate,
      runId,
    };

    // Generate HTML report
    log('[Email] Generating HTML email report...');
    const htmlReport = generateHtmlReport({
      stats,
      contacts,
      corrections,
      auditSummary,
    });

    // Send email report
    log('[Email] Sending email report...');
    const emailResult = await sendEmailReport({
      htmlReport,
      stats,
      recipientEmail,
      fromEmail,
    });

    if (emailResult.success) {
      log(`[Email] Email report sent successfully: ${emailResult.messageId}`);
      return { success: true };
    } else {
      return { success: false, error: emailResult.error };
    }
  } catch (error) {
    const errorMessage = `Failed to generate and send report: ${(error as Error).message}`;
    log(`[Email][Error] ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
