import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepResearch } from '../../src/deep-research';
import { mockFirecrawlResponse, mockFirecrawlApp } from '../mocks/firecrawl.mock';
import { mockGenerateObject, mockSerpQueriesResponse, mockLearningsResponse } from '../mocks/openai.mock';

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

describe('Research Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deepResearch', () => {
    it('should complete full research pipeline with depth=1', async () => {
      // Mock the SERP query generation
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      
      // Mock the learning extraction
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      
      // Mock Firecrawl search
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await deepResearch({
        query: 'San Francisco tech CEOs',
        breadth: 2,
        depth: 1,
      });

      expect(result.learnings).toHaveLength(3);
      expect(result.visitedUrls).toHaveLength(2);
      
      // Verify the pipeline called all expected functions
      expect(mockGenerateObject).toHaveBeenCalledTimes(3); // SERP queries + learnings
      expect(mockFirecrawlApp.search).toHaveBeenCalledTimes(2); // Based on breadth=2
    });

    it('should handle recursive research with depth=2', async () => {
      // First level - SERP queries
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      
      // First level - learnings extraction (2 calls for breadth=2)
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      
      // Second level - SERP queries for recursive calls
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      
      // Second level - learnings extraction
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);

      // Mock Firecrawl responses
      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      const result = await deepResearch({
        query: 'San Francisco tech CEOs',
        breadth: 2,
        depth: 2,
      });

      expect(result.learnings.length).toBeGreaterThan(0);
      expect(result.visitedUrls.length).toBeGreaterThan(0);
      
      // Should have made multiple API calls due to recursion
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('San Francisco tech CEOs')
        })
      );
    });

    it('should pass model configuration through the pipeline', async () => {
      const modelConfig = {
        variant: 'gpt-5-mini' as const,
        reasoning: { effort: 'high' as const }
      };

      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
        modelConfig,
      });

      // Verify model configuration was passed to AI calls
      expect(mockGenerateObject).toHaveBeenCalled();
    });

    it('should handle progress callbacks correctly', async () => {
      const progressCallback = vi.fn();

      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentDepth: expect.any(Number),
          totalDepth: expect.any(Number),
          currentBreadth: expect.any(Number),
          totalBreadth: expect.any(Number)
        })
      );
    });

    it('should accumulate learnings from previous research', async () => {
      const existingLearnings = ['Previous learning 1', 'Previous learning 2'];

      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
        learnings: existingLearnings,
      });

      expect(result.learnings).toEqual(
        expect.arrayContaining(existingLearnings)
      );
    });

    it('should deduplicate URLs across research calls', async () => {
      const existingUrls = ['https://example.com/tech-leaders'];

      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValueOnce(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 1,
        visitedUrls: existingUrls,
      });

      // Should not have duplicate URLs
      const uniqueUrls = [...new Set(result.visitedUrls)];
      expect(result.visitedUrls.length).toBe(uniqueUrls.length);
    });

    it('should handle concurrency limits correctly', async () => {
      // Set up multiple queries to test concurrency
      const largeQueryResponse = {
        object: {
          queries: Array.from({ length: 10 }, (_, i) => ({
            query: `Query ${i}`,
            researchGoal: `Goal ${i}`
          }))
        }
      };

      mockGenerateObject.mockResolvedValueOnce(largeQueryResponse);
      mockGenerateObject.mockResolvedValue(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      const startTime = Date.now();

      await deepResearch({
        query: 'test query',
        breadth: 10,
        depth: 1,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take some time due to concurrency limits (not instant)
      expect(duration).toBeGreaterThan(100);
      
      // All search calls should have been made
      expect(mockFirecrawlApp.search).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial failures in parallel searches', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValue(mockLearningsResponse);
      
      // First search succeeds, second fails
      mockFirecrawlApp.search
        .mockResolvedValueOnce(mockFirecrawlResponse)
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await deepResearch({
        query: 'test query',
        breadth: 2,
        depth: 1,
      });

      // Should return results from successful searches
      expect(result.learnings.length).toBeGreaterThan(0);
      expect(result.visitedUrls.length).toBeGreaterThan(0);
    });

    it('should handle timeout errors gracefully', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValue(mockLearningsResponse);
      
      // Mock timeout error
      mockFirecrawlApp.search.mockRejectedValueOnce(
        new Error('Timeout: Request took too long')
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

    it('should handle AI generation failures', async () => {
      // First call (SERP queries) succeeds, second (learnings) fails
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockRejectedValueOnce(new Error('AI API Error'));

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      await expect(
        deepResearch({
          query: 'test query',
          breadth: 1,
          depth: 1,
        })
      ).rejects.toThrow('AI API Error');
    });
  });

  describe('Performance Characteristics', () => {
    it('should respect breadth parameter', async () => {
      const customSerpResponse = {
        object: {
          queries: Array.from({ length: 5 }, (_, i) => ({
            query: `Query ${i}`,
            researchGoal: `Goal ${i}`
          }))
        }
      };

      mockGenerateObject.mockResolvedValueOnce(customSerpResponse);
      mockGenerateObject.mockResolvedValue(mockLearningsResponse);
      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      await deepResearch({
        query: 'test query',
        breadth: 3, // Should limit to 3 even though we have 5 queries
        depth: 1,
      });

      expect(mockFirecrawlApp.search).toHaveBeenCalledTimes(3);
    });

    it('should reduce breadth in recursive calls', async () => {
      // Mock multiple levels of calls
      mockGenerateObject.mockResolvedValue(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      await deepResearch({
        query: 'test query',
        breadth: 4,
        depth: 2,
      });

      // Should make calls with reduced breadth at deeper levels
      expect(mockFirecrawlApp.search).toHaveBeenCalled();
    });
  });
});