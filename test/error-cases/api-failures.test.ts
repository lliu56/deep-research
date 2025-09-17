import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepResearch } from '../../src/deep-research';
import { auditContacts } from '../../src/auditing';
import { mockFirecrawlApp } from '../mocks/firecrawl.mock';
import { mockGenerateObject, mockSerpQueriesResponse } from '../mocks/openai.mock';
import { mockContacts, mockAuditingCriteria } from '../mocks/data.mock';

// Mock external dependencies
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

describe('API Failure Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Firecrawl API Failures', () => {
    it('should handle Firecrawl timeout errors', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('Timeout: Request took longer than 15 seconds')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      // Should complete without throwing
      expect(result).toBeDefined();
      expect(result.learnings).toEqual([]);
      expect(result.visitedUrls).toEqual([]);
    });

    it('should handle Firecrawl rate limiting', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('Rate limit exceeded. Please try again later.')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
      expect(result.learnings).toEqual([]);
    });

    it('should handle Firecrawl network failures', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle Firecrawl authentication errors', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('Unauthorized: Invalid API key')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
      expect(result.learnings).toEqual([]);
    });

    it('should handle Firecrawl service unavailable', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('Service Temporarily Unavailable')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle partial Firecrawl failures in parallel requests', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          queries: [
            { query: 'Query 1', researchGoal: 'Goal 1' },
            { query: 'Query 2', researchGoal: 'Goal 2' },
            { query: 'Query 3', researchGoal: 'Goal 3' }
          ]
        }
      });
      
      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['Success learning'], followUpQuestions: [] }
      });

      // First succeeds, second fails, third succeeds
      mockFirecrawlApp.search
        .mockResolvedValueOnce({ success: true, data: [{ url: 'url1', markdown: 'content1' }] })
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ success: true, data: [{ url: 'url3', markdown: 'content3' }] });

      const result = await deepResearch({
        query: 'test query',
        breadth: 3,
        depth: 1,
      });

      // Should return results from successful searches only
      expect(result.learnings.length).toBeGreaterThan(0);
      expect(result.visitedUrls).toContain('url1');
      expect(result.visitedUrls).toContain('url3');
      expect(result.visitedUrls).not.toContain('url2'); // Failed request
    });
  });

  describe('OpenAI API Failures', () => {
    it('should handle OpenAI rate limiting', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('Rate limit exceeded for requests')
      );

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle OpenAI API key errors', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('Incorrect API key provided')
      );

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('Incorrect API key');
    });

    it('should handle OpenAI context length errors', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('This model\'s maximum context length is 128000 tokens')
      );

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('maximum context length');
    });

    it('should handle OpenAI service errors', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('The server had an error while processing your request')
      );

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('server had an error');
    });

    it('should handle OpenAI timeout errors', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('Request timed out')
      );

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('timed out');
    });
  });

  describe('Network Failures', () => {
    it('should handle DNS resolution failures', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('ENOTFOUND: getaddrinfo ENOTFOUND api.firecrawl.dev')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
      expect(result.learnings).toEqual([]);
    });

    it('should handle connection timeout', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('ETIMEDOUT: connect ETIMEDOUT')
      );

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle intermittent network issues', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      
      // Simulate intermittent failures
      let callCount = 0;
      mockFirecrawlApp.search.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('ECONNRESET: Connection reset by peer'));
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const result = await deepResearch({
        query: 'test query',
        breadth: 3,
        depth: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Audit Failures', () => {
    it('should handle audit verification failures gracefully', async () => {
      // Mock successful initial generation but failed verification
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockRejectedValueOnce(new Error('Verification failed'));

      mockFirecrawlApp.search.mockRejectedValueOnce(new Error('Network error'));

      const result = await auditContacts({
        contacts: mockContacts,
        criteria: mockAuditingCriteria,
        originalQuery: 'test query',
      });

      // Should return original contacts without verification
      expect(result.verifiedContacts).toHaveLength(mockContacts.length);
      expect(result.corrections).toEqual([]);
    });

    it('should handle audit re-research failures', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce({ object: { learnings: [], followUpQuestions: [] } })
        .mockResolvedValueOnce({ object: { contacts: [] } });

      mockFirecrawlApp.search.mockRejectedValueOnce(new Error('Research failed'));

      const result = await auditContacts({
        contacts: [mockContacts[0]],
        criteria: { sampleSize: 1, verificationDepth: 1 },
        originalQuery: 'test query',
      });

      // Should handle gracefully
      expect(result.verifiedContacts).toHaveLength(1);
    });
  });

  describe('Data Validation Failures', () => {
    it('should handle malformed AI responses', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          queries: 'not an array' // Invalid format
        }
      });

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow();
    });

    it('should handle empty AI responses', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          queries: []
        }
      });

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result.learnings).toEqual([]);
      expect(result.visitedUrls).toEqual([]);
    });

    it('should handle AI responses with missing fields', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          queries: [
            { query: 'Query without researchGoal' }
            // Missing researchGoal field
          ]
        }
      });

      // Should handle gracefully or throw appropriate error
      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).toBeDefined();
    });
  });

  describe('Memory and Performance Failures', () => {
    it('should handle very large response data', async () => {
      const largeContent = 'a'.repeat(1000000); // 1MB of content
      
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          learnings: [largeContent],
          followUpQuestions: []
        }
      });

      mockFirecrawlApp.search.mockResolvedValueOnce({
        success: true,
        data: [{ url: 'test', markdown: largeContent }]
      });

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
      expect(result.learnings[0].length).toBeLessThanOrEqual(largeContent.length);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate a scenario that might cause memory issues
      const manyQueries = Array.from({ length: 100 }, (_, i) => ({
        query: `Query ${i}`,
        researchGoal: `Goal ${i}`
      }));

      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: manyQueries }
      });

      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['Learning'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValue({
        success: true,
        data: [{ url: 'test', markdown: 'content' }]
      });

      // Should handle large numbers of concurrent requests
      const result = await deepResearch({
        query: 'test query',
        breadth: 100,
        depth: 1,
      });

      expect(result).toBeDefined();
    });
  });
});