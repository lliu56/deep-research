import * as fs from 'fs/promises';

import { getModel } from './ai/providers';
import { auditContacts, generateAuditSummary } from './auditing';
import {
  closePool,
  initializePool,
  insertContacts,
  testConnection,
} from './database';
import {
  deepResearch,
  generateContactsFromLearnings,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateAndSendReport } from './email-report';
import { generateFeedback } from './feedback';
import { ResearchInput } from './types';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// Load research input configuration from JSON file
async function loadResearchInput(): Promise<ResearchInput> {
  try {
    const data = await fs.readFile('RESEARCH_INPUT.json', 'utf-8');
    return JSON.parse(data) as ResearchInput;
  } catch (error) {
    console.error('Error loading RESEARCH_INPUT.json:', error);
    console.log('Using default configuration...');
    return {
      query: '',
      depth: 2,
      breadth: 4,
      outputFormat: 'contacts_db',
      modelConfig: {
        variant: 'gpt-5-mini',
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' },
      },
    };
  }
}

// run the agent
async function run() {
  // Initialize database connection pool
  initializePool();
  log('[Init] Connection pool initialized');

  // Test database connectivity
  try {
    await testConnection();
  } catch (error) {
    console.error('[Init][Error] Failed to connect to database:', error);
    console.log('[Init] Continuing without database integration...');
    // Continue without database, will fall back to JSON file
  }

  // Load configuration from RESEARCH_INPUT.json
  const config = await loadResearchInput();
  log('[Config] Loaded RESEARCH_INPUT.json');

  if (!config.query) {
    console.error('Error: No query specified in RESEARCH_INPUT.json');
    await closePool(); // Clean up database connection
    process.exit(1);
  }

  console.log('[Config] Using model:', getModel(config.modelConfig).modelId);
  console.log('[Config] Configuration loaded from RESEARCH_INPUT.json');
  console.log('[Config] Query:', config.query);
  console.log('[Config] BYPASS_DEEP_RESEARCH:', process.env.BYPASS_DEEP_RESEARCH);

  const breadth = config.breadth || 4;
  const depth = config.depth || 2;
  const isReport = config.outputFormat !== 'answer';

  let combinedQuery = config.query;

  if (isReport) {
    log(`[Planning] Creating research plan...`);

    // Generate follow-up questions (automated - no user input)
    const followUpQuestions = await generateFeedback({
      query: config.query,
      modelConfig: config.modelConfig,
    });

    log('\n[Planning] Generated follow-up questions for enhanced research context:');
    followUpQuestions.forEach((q: string, i: number) => {
      log(`${i + 1}. ${q}`);
    });

    // For automated mode, we'll enhance the query with research context
    combinedQuery = `
Initial Query: ${config.query}
Research Context: Conduct comprehensive research addressing these key areas:
${followUpQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

Focus Areas: ${config.contactHierarchy?.join(', ') || 'General research'}
Output Format: ${config.outputFormat || 'contacts_db'}
`;
  }

  log('\n[Research] Starting automated research pipeline...\n');

  const { learnings, visitedUrls } = await deepResearch({
    query: combinedQuery,
    breadth,
    depth,
    modelConfig: config.modelConfig,
  });

  log(`\n\n[Research] Learnings:\n\n${learnings.join('\n')}`);
  log(`\n\n[Research] Visited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`);

  // Generate contacts if outputFormat is contacts_db
  let contacts: any[] = [];
  let auditSummary = '';

  if (config.outputFormat === 'contacts_db') {
    log('\n[Contacts] Extracting contacts from research learnings...');

    contacts = await generateContactsFromLearnings({
      learnings,
      contactHierarchy: config.contactHierarchy,
      modelConfig: config.modelConfig,
    });

    log(`\n[Contacts] Extracted ${contacts.length} contacts`);

    // Perform auditing if criteria is provided
    if (config.auditingCriteria && contacts.length > 0) {
      log('\n[Audit] Starting auditing process...');

      const { verifiedContacts, corrections } = await auditContacts({
        contacts,
        criteria: config.auditingCriteria,
        originalQuery: config.query,
        modelConfig: config.modelConfig,
      });

      contacts = verifiedContacts;

      // Generate audit summary
      auditSummary = await generateAuditSummary({
        corrections,
        totalContacts: contacts.length,
        sampleSize: config.auditingCriteria.sampleSize,
        modelConfig: config.modelConfig,
      });

      log(`\n[Audit] Auditing completed: ${corrections.length} corrections made`);

      // Insert contacts into database
      let dbResult;
      try {
        dbResult = await insertContacts(contacts);
        log(
          `\n[Database] Database insertion: ${dbResult.inserted} inserted, ${dbResult.updated} updated, ${dbResult.rejected} rejected`,
        );

        if (dbResult.errors.length > 0) {
          console.warn('[Database][Warn] Some contacts could not be inserted:', dbResult.errors);
        }

        // Send email report after successful database insertion
        log('\n[Email] Generating and sending email report...');
        const emailResult = await generateAndSendReport({
          query: config.query,
          contacts,
          corrections,
          insertionResult: dbResult,
          auditSummary,
        });

        if (emailResult.success) {
          log('[Email] Email report sent successfully');
        } else {
          console.warn('[Email][Error] Failed to send email report:', emailResult.error);
        }
      } catch (dbError) {
        console.error('[Database][Error] Database insertion failed:', dbError);
        console.log('[Database] Falling back to JSON file save...');

        // Still try to send email report even if DB insertion failed
        if (contacts.length > 0) {
          log('\n[Email] Attempting to send email report despite DB failure...');
          const emailResult = await generateAndSendReport({
            query: config.query,
            contacts,
            corrections,
            insertionResult: {
              inserted: 0,
              updated: 0,
              rejected: contacts.length,
              errors: ['Database insertion failed'],
            },
            auditSummary,
          });

          if (emailResult.success) {
            log('[Email] Email report sent successfully despite DB failure');
          } else {
            console.warn('[Email][Error] Failed to send email report:', emailResult.error);
          }
        }
      }

      // Always save contacts to JSON file as backup
      await fs.writeFile(
        'contacts.json',
        JSON.stringify(contacts, null, 2),
        'utf-8',
      );
      log('\n[Output] Contacts have been saved to contacts.json (backup)');

      // Save corrections log
      if (corrections.length > 0) {
        await fs.writeFile(
          'corrections.json',
          JSON.stringify(corrections, null, 2),
          'utf-8',
        );
        log('[Output] Corrections log saved to corrections.json');
      }
    }
  }

  log('\n[Output] Writing final output...');

  if (isReport) {
    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings,
      visitedUrls,
      modelConfig: config.modelConfig,
    });

    // Append contacts and audit summary only when not bypassing
    let finalReport = report;
    const isBypass = process.env.BYPASS_DEEP_RESEARCH === 'true';
    if (!isBypass && config.outputFormat === 'contacts_db' && contacts.length > 0) {
      finalReport += `\n\n## Extracted Contacts\n\nFound ${contacts.length} contacts from research.\n\n`;

      if (auditSummary) {
        finalReport += auditSummary + '\n\n';
      }

      finalReport += `Contact details saved to contacts.json\n`;
    }

    await fs.writeFile('report.md', finalReport, 'utf-8');
    console.log('\n[Output] Report has been saved to report.md');
  } else {
    const answer = await writeFinalAnswer({
      prompt: combinedQuery,
      learnings,
      modelConfig: config.modelConfig,
    });

    await fs.writeFile('answer.md', answer, 'utf-8');
    console.log('\n[Output] Answer has been saved to answer.md');
  }

  console.log('\n[Cleanup] Automated research pipeline completed successfully.');

  // Close database connection pool
  await closePool();
}

run().catch(error => {
  console.error(error);
  // Ensure database connections are closed on error
  closePool().finally(() => process.exit(1));
});
