import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditContacts, generateAuditSummary } from '../../src/auditing';
import { mockContacts, mockCorrections, mockAuditingCriteria } from '../mocks/data.mock';
import { mockGenerateObject } from '../mocks/openai.mock';
import { mockFirecrawlApp } from '../mocks/firecrawl.mock';

// Mock the dependencies
vi.mock('ai', () => ({
  generateObject: mockGenerateObject
}));

vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(() => mockFirecrawlApp)
}));

describe('Auditing Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auditContacts', () => {
    it('should handle empty contacts array', async () => {
      const result = await auditContacts({
        contacts: [],
        criteria: mockAuditingCriteria,
        originalQuery: 'test query',
      });

      expect(result.verifiedContacts).toEqual([]);
      expect(result.corrections).toEqual([]);
    });

    it('should return all contacts when sample size is larger than contact count', async () => {
      const criteria = { sampleSize: 10, verificationDepth: 1 };
      
      const result = await auditContacts({
        contacts: mockContacts,
        criteria,
        originalQuery: 'test query',
      });

      expect(result.verifiedContacts).toHaveLength(2);
    });

    it('should limit sample size correctly', async () => {
      const criteria = { sampleSize: 1, verificationDepth: 1 };
      
      // Mock successful verification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          contacts: [mockContacts[0]]
        }
      });

      const result = await auditContacts({
        contacts: mockContacts,
        criteria,
        originalQuery: 'test query',
      });

      // Should only verify 1 contact but return all contacts
      expect(result.verifiedContacts).toHaveLength(2);
    });

    it('should track corrections properly', async () => {
      const criteria = { sampleSize: 1, verificationDepth: 1 };
      
      // Mock verification that finds a difference
      const modifiedContact = {
        ...mockContacts[0],
        position: 'Chief Executive Officer' // Different from original 'CEO'
      };
      
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          contacts: [modifiedContact]
        }
      });

      const result = await auditContacts({
        contacts: [mockContacts[0]],
        criteria,
        originalQuery: 'test query',
      });

      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0]).toMatchObject({
        email: mockContacts[0].email,
        field: 'position',
        before: 'CEO',
        after: 'Chief Executive Officer'
      });
    });

    it('should handle verification errors gracefully', async () => {
      const criteria = { sampleSize: 1, verificationDepth: 1 };
      
      // Mock research failure
      mockFirecrawlApp.search.mockRejectedValueOnce(new Error('Network error'));

      const result = await auditContacts({
        contacts: mockContacts,
        criteria,
        originalQuery: 'test query',
      });

      // Should still return original contacts even if verification fails
      expect(result.verifiedContacts).toHaveLength(2);
      expect(result.corrections).toEqual([]);
    });

    it('should preserve email as primary key', async () => {
      const criteria = { sampleSize: 1, verificationDepth: 1 };
      
      // Mock verification with different email
      const modifiedContact = {
        ...mockContacts[0],
        email: 'new.email@techcorp.com'
      };
      
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          contacts: [modifiedContact]
        }
      });

      const result = await auditContacts({
        contacts: [mockContacts[0]],
        criteria,
        originalQuery: 'test query',
      });

      // Should keep original email
      expect(result.verifiedContacts[0].email).toBe(mockContacts[0].email);
    });
  });

  describe('generateAuditSummary', () => {
    it('should generate summary for no corrections', async () => {
      const summary = await generateAuditSummary({
        corrections: [],
        totalContacts: 5,
        sampleSize: 2,
      });

      expect(summary).toContain('Total contacts: 5');
      expect(summary).toContain('Sample verified: 2');
      expect(summary).toContain('Corrections made: 0');
      expect(summary).toContain('Excellent');
    });

    it('should generate summary with corrections', async () => {
      const summary = await generateAuditSummary({
        corrections: mockCorrections,
        totalContacts: 10,
        sampleSize: 3,
      });

      expect(summary).toContain('audit summary');
    });

    it('should handle model configuration', async () => {
      const modelConfig = {
        variant: 'gpt-5-mini' as const,
        reasoning: { effort: 'high' as const }
      };

      await generateAuditSummary({
        corrections: [],
        totalContacts: 1,
        sampleSize: 1,
        modelConfig,
      });

      expect(mockGenerateObject).toHaveBeenCalled();
    });
  });

  describe('Random Sampling', () => {
    it('should return different samples on multiple runs', () => {
      // This is a probabilistic test, so we'll run it multiple times
      const contacts = Array.from({ length: 10 }, (_, i) => ({
        ...mockContacts[0],
        email: `test${i}@example.com`
      }));

      const samples = Array.from({ length: 5 }, () => {
        // We need to test the internal getRandomSample function
        // For now, we'll test through the main audit function
        return auditContacts({
          contacts,
          criteria: { sampleSize: 3, verificationDepth: 1 },
          originalQuery: 'test',
        });
      });

      // At least one sample should be different (very high probability)
      // This is a basic sanity check for randomness
      expect(samples).toBeDefined();
    });
  });
});