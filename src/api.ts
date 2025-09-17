import cors from 'cors';
import express, { Request, Response } from 'express';

import { auditContacts } from './auditing';
import { checkDatabaseHealth, insertContacts } from './database';
import {
  deepResearch,
  generateContactsFromLearnings,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { AuditingCriteria, Correction, ModelConfig } from './types';

const app = express();
const port = process.env.PORT || 3051;

// TypeScript interfaces for request bodies
interface ResearchRequestBody {
  query: string;
  depth?: number;
  breadth?: number;
  modelConfig?: ModelConfig;
  auditingCriteria?: AuditingCriteria;
  contactHierarchy?: string[];
}

interface ResearchContactsRequestBody extends ResearchRequestBody {
  skipDatabase?: boolean;
  sendEmail?: boolean;
}

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const {
      query,
      depth = 3,
      breadth = 3,
      modelConfig,
      auditingCriteria,
      contactHierarchy,
    }: ResearchRequestBody = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('\nStarting research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
      modelConfig,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    const answer = await writeFinalAnswer({
      prompt: query,
      learnings,
      modelConfig,
    });

    // Extract contacts from learnings if requested (backward compatible)
    const contacts = await generateContactsFromLearnings({
      learnings,
      contactHierarchy,
      modelConfig,
    });

    // Run auditing if criteria provided
    let auditResults = {
      verifiedContacts: contacts,
      corrections: [] as Correction[],
    };
    if (auditingCriteria) {
      auditResults = await auditContacts({
        contacts,
        criteria: auditingCriteria,
        originalQuery: query,
        modelConfig,
      });
    }

    // Return the results with optional contact data
    return res.json({
      success: true,
      answer,
      learnings,
      visitedUrls,
      contacts: auditResults.verifiedContacts,
      corrections: auditResults.corrections,
      statistics: {
        totalContacts: auditResults.verifiedContacts.length,
        totalCorrections: auditResults.corrections.length,
      },
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// New complete contact research pipeline API endpoint
app.post('/api/research-contacts', async (req: Request, res: Response) => {
  try {
    const {
      query,
      depth = 3,
      breadth = 3,
      modelConfig,
      auditingCriteria,
      contactHierarchy,
      skipDatabase = false,
      sendEmail = false,
    }: ResearchContactsRequestBody = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('\nStarting contact research pipeline...\n');

    // 1. Run deep research
    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
      modelConfig,
    });

    log(`\n\nLearnings (${learnings.length}):\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    // 2. Extract contacts
    const contacts = await generateContactsFromLearnings({
      learnings,
      contactHierarchy,
      modelConfig,
    });

    log(`\n\nExtracted ${contacts.length} contacts\n`);

    // 3. Audit contacts if criteria provided
    let verifiedContacts = contacts;
    let corrections: Correction[] = [];

    if (auditingCriteria) {
      log('\nStarting audit process...\n');
      const auditResults = await auditContacts({
        contacts,
        criteria: auditingCriteria,
        originalQuery: query,
        modelConfig,
      });
      verifiedContacts = auditResults.verifiedContacts;
      corrections = auditResults.corrections;
      log(`\nAudit completed: ${corrections.length} corrections applied\n`);
    }

    // 4. Insert into database (unless skipped for testing)
    let dbResults = { inserted: 0, updated: 0, rejected: 0, errors: [] };
    if (!skipDatabase && verifiedContacts.length > 0) {
      log('\nInserting contacts into database...\n');
      dbResults = await insertContacts(verifiedContacts);

      // If DB insertion failed completely, return error
      if (dbResults.inserted === 0 && dbResults.updated === 0) {
        return res.status(500).json({
          error: 'Database insertion failed',
          details: dbResults.errors,
        });
      }

      log(
        `\nDatabase insertion completed: ${dbResults.inserted} inserted, ${dbResults.updated} updated, ${dbResults.rejected} rejected\n`,
      );
    } else if (skipDatabase) {
      log('\nDatabase insertion skipped per request\n');
    }

    // 5. Send email report if requested (Phase 5 integration point)
    if (sendEmail && !skipDatabase) {
      // TODO: Call sendEmailReport() when Phase 5 is complete
      log('Email report requested but not yet implemented');
    }

    // 6. Return comprehensive results
    return res.json({
      success: true,
      contacts: verifiedContacts,
      corrections,
      database: dbResults,
      statistics: {
        learnings: learnings.length,
        urlsVisited: visitedUrls.length,
        contactsExtracted: contacts.length,
        contactsVerified: verifiedContacts.length,
        correctionsApplied: corrections.length,
        dbInserted: dbResults.inserted,
        dbUpdated: dbResults.updated,
        dbRejected: dbResults.rejected,
      },
      metadata: {
        query,
        depth,
        breadth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error in research-contacts API:', error);
    return res.status(500).json({
      error: 'An error occurred during the contact research pipeline',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// generate report API
app.post('/api/generate-report', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3, modelConfig } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    log('\n Starting research...\n');
    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
      modelConfig,
    });
    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );
    const report = await writeFinalReport({
      prompt: query,
      learnings,
      visitedUrls,
      modelConfig,
    });

    return report;
  } catch (error: unknown) {
    console.error('Error in generate report API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Health check endpoint for monitoring
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    return res.json({
      status: 'healthy',
      database: dbHealth,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
    });
  } catch (error: unknown) {
    console.error('Error in health check:', error);
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
