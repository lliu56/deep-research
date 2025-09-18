import { generateObject } from 'ai';
import { z } from 'zod';

import { getModel } from './ai/providers';
import { deepResearch, generateContactsFromLearnings } from './deep-research';
import { systemPrompt } from './prompt';
import { AuditingCriteria, Contact, Correction, ModelConfig } from './types';

function log(...args: any[]) {
  console.log(...args);
}

// Random sampling function
function getRandomSample<T>(array: T[], sampleSize: number): T[] {
  if (array.length <= sampleSize) {
    return array;
  }

  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, sampleSize);
}

// Re-research a specific contact to verify information
async function verifyContact({
  contact,
  originalQuery,
  verificationDepth = 2,
  modelConfig,
}: {
  contact: Contact;
  originalQuery: string;
  verificationDepth: number;
  modelConfig?: ModelConfig;
}): Promise<{ verifiedContact: Contact; corrections: Correction[] }> {
  log(`[Audit] Verifying contact: ${contact.name} at ${contact.company}`);

  // Create a targeted search query for this specific contact
  const verificationQuery = `
Verify information for ${contact.name} at ${contact.company} in ${contact.position} role, with ${contact.email} and ${contact.number}.
Search for: ${contact.name} ${contact.company} ${contact.position} ${contact.email} ${contact.number},
Confirm: email, position, department, location, recent activity
Context: ${originalQuery}
Strict Rules:
  - Back everything you say with actual sources.
  - There are heavy penalties for information that are made up/don't come from an actual source
  - If you are not sure about the factual correctness of a information, leave it blank. 

`;

  try {
    // Re-research this specific contact with shallow depth
    const { learnings } = await deepResearch({
      query: verificationQuery,
      breadth: 2,
      depth: verificationDepth,
      modelConfig,
    });

    // Extract verified contact information
    const verifiedContacts = await generateContactsFromLearnings({
      learnings,
      contactHierarchy: [contact.position],
      modelConfig,
    });

    // Find the most relevant match
    const verifiedContact =
      verifiedContacts.find(
        c =>
          c.name.toLowerCase().includes(contact.name.toLowerCase()) ||
          c.email.toLowerCase() === contact.email.toLowerCase() ||
          (c.company.toLowerCase() === contact.company.toLowerCase() &&
            c.position.toLowerCase().includes(contact.position.toLowerCase())),
      ) || verifiedContacts[0];

    if (!verifiedContact) {
      log(`[Audit] Could not verify contact: ${contact.name}`);
      return { verifiedContact: contact, corrections: [] };
    }

    // Compare and identify corrections
    const corrections: Correction[] = [];
    const fields: (keyof Contact)[] = [
      'name',
      'email',
      'company',
      'position',
      'department',
      'city',
      'stateProvince',
      'country',
      'industry',
      'tags',
    ];

    for (const field of fields) {
      const originalValue = String(contact[field] || '');
      const verifiedValue = String(verifiedContact[field] || '');

      if (originalValue && verifiedValue && originalValue !== verifiedValue) {
        corrections.push({
          email: contact.email,
          field: String(field),
          before: originalValue,
          after: verifiedValue,
          reason: `Verification research found updated information`,
        });
      }
    }

    // Merge the verified information with original data, preferring verified data
    const finalContact: Contact = {
      ...contact,
      ...verifiedContact,
      // Keep original email as primary key unless verification found a better one
      email: verifiedContact.email || contact.email,
    };

    log(
      `[Audit] Verified ${contact.name}: ${corrections.length} corrections found`,
    );
    return { verifiedContact: finalContact, corrections };
  } catch (error) {
    log(`[Audit][Error] Error verifying contact ${contact.name}:`, error);
    return { verifiedContact: contact, corrections: [] };
  }
}

// Main auditing function
export async function auditContacts({
  contacts,
  criteria,
  originalQuery,
  modelConfig,
}: {
  contacts: Contact[];
  criteria: AuditingCriteria;
  originalQuery: string;
  modelConfig?: ModelConfig;
}): Promise<{ verifiedContacts: Contact[]; corrections: Correction[] }> {
  if (contacts.length === 0) {
    log('[Audit] No contacts to audit');
    return { verifiedContacts: [], corrections: [] };
  }

  // Check for bypass mode and generate mock corrections
  if (process.env.BYPASS_DEEP_RESEARCH === 'true') {
    log('[Audit][Bypass] Generating mock audit corrections');

    const mockCorrections: Correction[] = [
      {
        email: contacts[0]?.email || 'test@example.com',
        field: 'position',
        before: 'Director',
        after: 'Head of Technology',
        reason: 'Mock verification found updated title',
      },
      {
        email: contacts[1]?.email || 'test2@example.com',
        field: 'department',
        before: 'IT',
        after: 'Computer Science',
        reason: 'Mock audit found more specific department',
      },
    ];

    log(
      `[Audit][Bypass] Mock audit completed: ${mockCorrections.length} mock corrections generated`,
    );
    return {
      verifiedContacts: contacts,
      corrections: mockCorrections,
    };
  }

  log(`[Audit] Starting audit process for ${contacts.length} contacts`);
  log(
    `[Audit] Sample size: ${criteria.sampleSize}, Verification depth: ${criteria.verificationDepth}`,
  );

  // Get random sample of contacts to verify
  const sampleContacts = getRandomSample(contacts, criteria.sampleSize);
  log(`[Audit] Selected ${sampleContacts.length} contacts for verification`);

  const allCorrections: Correction[] = [];
  const verifiedContactsMap = new Map<string, Contact>();

  // Initialize with all original contacts
  contacts.forEach(contact => {
    verifiedContactsMap.set(contact.email, contact);
  });

  // Verify each contact in the sample
  for (const contact of sampleContacts) {
    try {
      const { verifiedContact, corrections } = await verifyContact({
        contact,
        originalQuery,
        verificationDepth: criteria.verificationDepth,
        modelConfig,
      });

      // Update the contact with verified information
      verifiedContactsMap.set(contact.email, verifiedContact);
      allCorrections.push(...corrections);
    } catch (error) {
      log(`[Audit][Error] Failed to verify contact ${contact.name}:`, error);
    }
  }

  const verifiedContacts = Array.from(verifiedContactsMap.values());

  log(
    `[Audit] Audit completed: ${allCorrections.length} total corrections made`,
  );

  return {
    verifiedContacts,
    corrections: allCorrections,
  };
}

// Generate audit report summary
export async function generateAuditSummary({
  corrections,
  totalContacts,
  sampleSize,
  modelConfig,
}: {
  corrections: Correction[];
  totalContacts: number;
  sampleSize: number;
  modelConfig?: ModelConfig;
}): Promise<string> {
  if (corrections.length === 0) {
    return `
## Audit Summary
- Total contacts: ${totalContacts}
- Sample verified: ${sampleSize}
- Corrections made: 0
- Data quality: Excellent (no corrections needed)
`;
  }

  const correctionsByField = corrections.reduce(
    (acc, correction) => {
      acc[correction.field] = (acc[correction.field] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const res = await generateObject({
    model: getModel(modelConfig),
    system: systemPrompt(),
    prompt: `Generate a concise audit summary report based on these corrections made during contact verification:

Total contacts: ${totalContacts}
Sample size verified: ${sampleSize}
Total corrections: ${corrections.length}

Corrections by field: ${JSON.stringify(correctionsByField, null, 2)}

Recent corrections examples:
${corrections
        .slice(0, 5)
        .map(c => `- ${c.field}: "${c.before}" → "${c.after}" (${c.reason})`)
        .join('\n')}

Create a brief summary highlighting data quality, main issues found, and confidence level.`,
    schema: z.object({
      summary: z.string().describe('Concise audit summary in markdown format'),
    }),
  });

  return res.object.summary;
}
