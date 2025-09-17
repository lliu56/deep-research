import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditContacts } from '../../src/auditing';
import { generateContactsFromLearnings, deepResearch } from '../../src/deep-research';
import { mockContacts, mockAuditingCriteria } from '../mocks/data.mock';
import { mockGenerateObject, mockContactExtractionResponse } from '../mocks/openai.mock';
import { mockFirecrawlApp, mockFirecrawlResponse } from '../mocks/firecrawl.mock';

// Mock all dependencies
vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(() => mockFirecrawlApp)
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject
}));

vi.mock('../../src/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ modelId: 'gpt-4o-mini' }),
  trimPrompt: vi.fn().mockImplementation((text) => text)
}));

vi.mock('../../src/prompt', () => ({
  systemPrompt: vi.fn().mockReturnValue('System prompt')
}));

describe('Audit Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Extraction to Auditing Flow', () => {
    it('should extract contacts and then audit them', async () => {
      // Step 1: Extract contacts from learnings
      mockGenerateObject.mockResolvedValueOnce(mockContactExtractionResponse);

      const contacts = await generateContactsFromLearnings({
        learnings: [
          'John Doe is CEO of TechCorp based in San Francisco',
          'Jane Smith serves as CTO at DataFlow Inc.'
        ],
        contactHierarchy: ['CEO', 'CTO']
      });

      expect(contacts).toHaveLength(2);

      // Step 2: Audit the extracted contacts
      // Mock verification research
      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [{ query: 'verify John Doe TechCorp CEO', researchGoal: 'verify' }] }
      });
      mockGenerateObject.mockResolvedValueOnce({
        object: { learnings: ['John Doe confirmed as CEO'], followUpQuestions: [] }
      });
      mockGenerateObject.mockResolvedValueOnce({
        object: { contacts: [{ ...contacts[0], position: 'Chief Executive Officer' }] }
      });
      
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const auditResult = await auditContacts({
        contacts,
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'Tech leaders in SF'
      });

      expect(auditResult.verifiedContacts).toHaveLength(2);
      expect(auditResult.corrections).toHaveLength(1);
      expect(auditResult.corrections[0]).toMatchObject({
        field: 'position',
        before: 'CEO',
        after: 'Chief Executive Officer'
      });
    });

    it('should handle end-to-end verification flow', async () => {
      const originalContact = mockContacts[0];

      // Mock the re-research for verification
      mockGenerateObject
        // SERP query generation
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'John Doe TechCorp CEO verification', researchGoal: 'verify contact' }] }
        })
        // Learning extraction
        .mockResolvedValueOnce({
          object: { 
            learnings: ['John Doe is CEO of TechCorp, email confirmed as john.doe@techcorp.com'],
            followUpQuestions: ['What other executives work at TechCorp?']
          }
        })
        // Contact extraction from verification
        .mockResolvedValueOnce({
          object: {
            contacts: [{
              ...originalContact,
              department: 'Executive Leadership', // Changed field
              priority: 10 // Changed field
            }]
          }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'San Francisco tech CEOs'
      });

      expect(result.verifiedContacts).toHaveLength(1);
      expect(result.corrections).toHaveLength(2); // department and priority changed
      
      // Verify the corrections are tracked properly
      const correctionFields = result.corrections.map(c => c.field);
      expect(correctionFields).toContain('department');
      expect(correctionFields).toContain('priority');
    });

    it('should preserve contact integrity during verification', async () => {
      const originalContact = mockContacts[0];

      // Mock verification that changes email (should be preserved)
      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'verify contact', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['Contact verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: {
            contacts: [{
              ...originalContact,
              email: 'different.email@techcorp.com' // Different email
            }]
          }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test'
      });

      // Email should be preserved from original
      expect(result.verifiedContacts[0].email).toBe(originalContact.email);
    });
  });

  describe('Verification Research Quality', () => {
    it('should create targeted verification queries', async () => {
      const contact = mockContacts[0];

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'targeted query', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: { contacts: [contact] }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      await auditContacts({
        contacts: [contact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'original query'
      });

      // Verify that deepResearch was called with a targeted query
      const researchCall = mockGenerateObject.mock.calls.find(call => 
        call[0].prompt.includes('Verify information for')
      );
      
      expect(researchCall).toBeDefined();
    });

    it('should use verification depth correctly', async () => {
      const contact = mockContacts[0];

      mockGenerateObject
        .mockResolvedValue({
          object: { queries: [{ query: 'query', researchGoal: 'goal' }] }
        })
        .mockResolvedValue({
          object: { learnings: ['learning'], followUpQuestions: [] }
        })
        .mockResolvedValue({
          object: { contacts: [contact] }
        });

      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      await auditContacts({
        contacts: [contact],
        criteria: { sampleSize: 1, verificationDepth: 3 },
        originalQuery: 'test'
      });

      // Should have called deepResearch with the specified depth
      expect(mockFirecrawlApp.search).toHaveBeenCalled();
    });
  });

  describe('Contact Matching Logic', () => {
    it('should match contacts by name similarity', async () => {
      const originalContact = {
        ...mockContacts[0],
        name: 'John Doe'
      };

      const verifiedContact = {
        ...originalContact,
        name: 'John M. Doe', // Slightly different name
        position: 'Chief Executive Officer'
      };

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'verify', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: { contacts: [verifiedContact] }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test'
      });

      // Should match and update the contact
      expect(result.verifiedContacts[0].name).toBe('John M. Doe');
      expect(result.corrections).toHaveLength(2); // name and position
    });

    it('should match contacts by email exact match', async () => {
      const originalContact = mockContacts[0];

      const verifiedContact = {
        ...originalContact,
        name: 'Completely Different Name',
        // Same email should still match
      };

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'verify', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: { contacts: [verifiedContact] }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test'
      });

      expect(result.corrections).toHaveLength(1); // Only name changed
      expect(result.corrections[0].field).toBe('name');
    });

    it('should match contacts by company and position combination', async () => {
      const originalContact = {
        ...mockContacts[0],
        name: 'Unknown Name',
        email: 'unknown@techcorp.com'
      };

      const verifiedContact = {
        ...originalContact,
        name: 'John Doe',
        // Same company and position should match
      };

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'verify', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: { contacts: [verifiedContact] }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test'
      });

      expect(result.corrections).toHaveLength(1); // name corrected
      expect(result.corrections[0].field).toBe('name');
    });

    it('should handle no match found scenario', async () => {
      const originalContact = mockContacts[0];

      // Return a completely different contact
      const unrelatedContact = {
        ...mockContacts[1],
        name: 'Completely Different Person',
        email: 'different@othercompany.com',
        company: 'Other Company'
      };

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { queries: [{ query: 'verify', researchGoal: 'verify' }] }
        })
        .mockResolvedValueOnce({
          object: { learnings: ['verified'], followUpQuestions: [] }
        })
        .mockResolvedValueOnce({
          object: { contacts: [unrelatedContact] }
        });

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: [originalContact],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test'
      });

      // Should use the first found contact (unrelated) as fallback
      expect(result.verifiedContacts[0].email).toBe(originalContact.email); // Preserves original email
      expect(result.corrections.length).toBeGreaterThan(0); // Multiple fields changed
    });
  });

  describe('Statistical Sampling Validation', () => {
    it('should audit correct sample size', async () => {
      const manyContacts = Array.from({ length: 10 }, (_, i) => ({
        ...mockContacts[0],
        email: `contact${i}@example.com`,
        name: `Contact ${i}`
      }));

      // Mock minimal responses to avoid excessive API calls
      mockGenerateObject.mockResolvedValue({
        object: { queries: [{ query: 'verify', researchGoal: 'verify' }] }
      });
      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['verified'], followUpQuestions: [] }
      });
      mockGenerateObject.mockResolvedValue({
        object: { contacts: [manyContacts[0]] }
      });

      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      const result = await auditContacts({
        contacts: manyContacts,
        criteria: { sampleSize: 3, verificationDepth: 1 },
        originalQuery: 'test'
      });

      // Should return all contacts, but only verify 3
      expect(result.verifiedContacts).toHaveLength(10);
      
      // Should have made exactly 3 verification calls (one per sample)
      const verifyQueries = mockGenerateObject.mock.calls.filter(call =>
        call[0].prompt.includes('Verify information for')
      );
      expect(verifyQueries).toHaveLength(3);
    });
  });
});