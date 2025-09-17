import * as fs from 'fs/promises';
import * as path from 'path';
import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { getModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';
import { Contact, ModelConfig } from './types';

function log(...args: any[]) {
  console.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
};

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
  contacts?: Contact[];
};

// increase this if you have higher API rate limits
const ConcurrencyLimit = Number(process.env.FIRECRAWL_CONCURRENCY) || 2;

// Initialize Firecrawl with optional API key and optional base url

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
  modelConfig,
}: {
  query: string;
  numQueries?: number;
  modelConfig?: ModelConfig;

  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
}) {
  const res = await generateObject({
    model: getModel(modelConfig),
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  log(`[Research] Created ${res.object.queries.length} queries`, res.object.queries);

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
  modelConfig,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
  modelConfig?: ModelConfig;
}) {
  const contents = compact(result.data.map(item => item.markdown)).map(
    content => trimPrompt(content, 25_000),
  );
  log(`[Research][SERP] Ran ${query}, found ${contents.length} contents`);

  const res = await generateObject({
    model: getModel(modelConfig),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    schema: z.object({
      learnings: z
        .array(z.string())
        .describe(`List of learnings, max of ${numLearnings}`),
      followUpQuestions: z
        .array(z.string())
        .describe(
          `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
        ),
    }),
  });
  log(
    `[Research] Created ${res.object.learnings.length} learnings`,
    res.object.learnings,
  );

  return res.object;
}

// Extract structured contact data from learnings
export async function generateContactsFromLearnings({
  learnings,
  contactHierarchy,
  modelConfig,
}: {
  learnings: string[];
  contactHierarchy?: string[];
  modelConfig?: ModelConfig;
}): Promise<Contact[]> {
  // Check for bypass mode
  if (process.env.BYPASS_DEEP_RESEARCH === 'true') {
    log('\n[Contacts][Bypass] Using mock contacts from test/mock-output.json\n');

    try {
      const mockDataPath = path.join(process.cwd(), 'test', 'mock-output.json');
      const mockData = await fs.readFile(mockDataPath, 'utf-8');
      return JSON.parse(mockData) as Contact[];
    } catch (error) {
      log('[Contacts][Bypass] Warning: Could not load mock data, returning sample contacts');
      // Return sample contacts if mock file not found
      return [
        {
          name: 'Sample Contact',
          email: 'sample@test.com',
          company: 'Test Company',
          tags: 'test,mock',
          position: 'Test Position',
          city: 'New York',
          'state-province': 'NY',
          country: 'USA',
          number: '555-0100',
          'time zone': 'America/New_York',
          department: 'Technology',
          priority: 1,
          signal: 'Testing',
          signal_level: 1,
          compliment: 'Test compliment',
          industry: 'Education',
          links: 'https://test.com',
          source: 'deep-research',
        },
      ];
    }
  }

  if (learnings.length === 0) {
    return [];
  }

  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const hierarchyPrompt =
    contactHierarchy && contactHierarchy.length > 0
      ? `Focus on finding contacts in these roles: ${contactHierarchy.join(', ')}.`
      : '';

  const res = await generateObject({
    model: getModel(modelConfig),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Extract contact information from the research learnings and structure it for a contacts database. ${hierarchyPrompt}

For each person identified, extract or infer the following information:
- Full name
- Email address (if available, otherwise create a reasonable format based on name and company)
- Company/organization name
- Position/title
- Department (if mentioned)
- City, state/province, country (infer if not explicit)
- Industry type
- Priority level (1-10 based on seniority/relevance)
- Signal strength (1-10 based on hiring activity/relevance)
- Professional compliment (positive note about their role/achievements)
- Time zone (infer from location)
- Tags (comma-separated, relevant keywords)
- Links (comma-separated, any mentioned URLs or social profiles)
- Phone number (if available)

Source all contacts as 'deep-research'.

<learnings>
${learningsString}
</learnings>`,
    ),
    schema: z.object({
      contacts: z.array(
        z.object({
          name: z.string(),
          email: z.string(),
          company: z.string(),
          position: z.string(),
          department: z.string().optional(),
          city: z.string(),
          'state-province': z.string(),
          country: z.string(),
          'time zone': z.string(),
          industry: z.string(),
          priority: z.number().min(1).max(10),
          signal: z.string(),
          signal_level: z.number().min(1).max(10),
          compliment: z.string(),
          tags: z.string(),
          links: z.string(),
          number: z.string().optional(),
          source: z.literal('deep-research'),
        }),
      ),
    }),
  });

  log(`[Contacts] Extracted ${res.object.contacts.length} contacts from learnings`);
  return res.object.contacts as Contact[];
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  modelConfig,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
  modelConfig?: ModelConfig;
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(modelConfig),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      reportMarkdown: z
        .string()
        .describe('Final report on the topic in Markdown'),
    }),
  });

  // Append the visited URLs section to the report
  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return res.object.reportMarkdown + urlsSection;
}

export async function writeFinalAnswer({
  prompt,
  learnings,
  modelConfig,
}: {
  prompt: string;
  learnings: string[];
  modelConfig?: ModelConfig;
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(modelConfig),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence. Try to follow the format specified in the prompt (for example, if the prompt is using Latex, the answer should be in Latex. If the prompt gives multiple answer choices, the answer should be one of the choices).\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      exactAnswer: z
        .string()
        .describe(
          'The final answer, make it short and concise, just the answer, no other text',
        ),
    }),
  });

  return res.object.exactAnswer;
}

export async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  modelConfig,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
  onProgress?: (progress: ResearchProgress) => void;
  modelConfig?: ModelConfig;
}): Promise<ResearchResult> {
  // Check for bypass mode
  if (process.env.BYPASS_DEEP_RESEARCH === 'true') {
    log('\n[Research][Bypass] Using mock learnings and URLs\n');

    // Return mock learnings and URLs
    return {
      learnings: [
        'Mock learning 1: Found several NY private schools looking for CS/AI leaders',
        'Mock learning 2: Riverdale Country School posted a Director of Technology position',
        'Mock learning 3: Hackley School received grant funding for AI programs',
        'Mock learning 4: Trinity School is expanding their computer science department',
      ],
      visitedUrls: [
        'https://riverdale.org/careers',
        'https://hackleyschool.edu/employment',
        'https://trinityschoolnyc.org/about/careers',
      ],
    };
  }
  const progress: ResearchProgress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
    modelConfig,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query,
  });

  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          const result = await firecrawl.search(serpQuery.query, {
            timeout: 15000,
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          });

          // Collect URLs from this search
          const newUrls = compact(result.data.map(item => item.url));
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
            modelConfig,
          });
          const allLearnings = [...learnings, ...newLearnings.learnings];
          const allUrls = [...visitedUrls, ...newUrls];

          if (newDepth > 0) {
            log(
              `[Research] Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`,
            );

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
              modelConfig,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            log(`[Research][Error] Timeout running query: ${serpQuery.query}: `, e);
          } else {
            log(`[Research][Error] Failed running query: ${serpQuery.query}: `, e);
          }
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      }),
    ),
  );

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
  };
}
