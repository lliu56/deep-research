import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mockGenerateObject, mockSerpQueriesResponse, mockLearningsResponse, mockAnswerResponse, mockReportResponse } from '../mocks/openai.mock';
import { mockFirecrawlApp, mockFirecrawlResponse } from '../mocks/firecrawl.mock';

// We'll need to install supertest for API testing
// For now, let's create a simplified version that tests the API logic

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

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Dynamically import the API to ensure mocks are applied
    const apiModule = await import('../../src/api');
    app = apiModule.default;
  });

  describe('POST /api/research', () => {
    it('should handle valid research request', async () => {
      // Setup mocks for full research pipeline
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockAnswerResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'San Francisco tech CEOs',
          depth: 1,
          breadth: 2
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('learnings');
      expect(response.body).toHaveProperty('visitedUrls');
    });

    it('should handle request with model configuration', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockAnswerResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'test query',
          depth: 1,
          breadth: 1,
          modelConfig: {
            variant: 'gpt-5-mini',
            reasoning: { effort: 'high' },
            text: { verbosity: 'low' }
          }
        });

      expect(response.status).toBe(200);
      expect(mockGenerateObject).toHaveBeenCalled();
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/research')
        .send({
          depth: 1,
          breadth: 1
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Query is required');
    });

    it('should use default values for depth and breadth', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockAnswerResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'test query'
          // No depth or breadth specified
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle research failures gracefully', async () => {
      mockGenerateObject.mockRejectedValueOnce(new Error('AI API Error'));

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'test query'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'An error occurred during research');
      expect(response.body).toHaveProperty('message', 'AI API Error');
    });

    it('should handle Firecrawl timeouts', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockSerpQueriesResponse);
      mockFirecrawlApp.search.mockRejectedValueOnce(new Error('Timeout'));

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'test query'
        });

      // Should still return 200 with partial results
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/generate-report', () => {
    it('should generate comprehensive report', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockReportResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/generate-report')
        .send({
          query: 'San Francisco AI companies',
          depth: 2,
          breadth: 3
        });

      expect(response.status).toBe(200);
      // The endpoint currently returns the report directly
      expect(typeof response.body).toBe('string');
      expect(response.body).toContain('San Francisco AI Leadership Research');
    });

    it('should handle model configuration in report generation', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockReportResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/generate-report')
        .send({
          query: 'test query',
          modelConfig: {
            variant: 'gpt-5-mini',
            text: { verbosity: 'high' }
          }
        });

      expect(response.status).toBe(200);
      expect(mockGenerateObject).toHaveBeenCalled();
    });

    it('should return 400 for missing query in report endpoint', async () => {
      const response = await request(app)
        .post('/api/generate-report')
        .send({
          depth: 2,
          breadth: 3
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Query is required');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/research')
        .set('Content-Type', 'application/json')
        .send('{ malformed json }');

      expect(response.status).toBe(400);
    });

    it('should handle very large requests', async () => {
      const largeQuery = 'a'.repeat(100000); // 100KB query

      const response = await request(app)
        .post('/api/research')
        .send({
          query: largeQuery
        });

      // Should either handle it or reject gracefully
      expect([200, 400, 413, 500]).toContain(response.status);
    });

    it('should handle requests with invalid model configuration', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockAnswerResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/research')
        .send({
          query: 'test query',
          modelConfig: {
            variant: 'invalid-model',
            reasoning: { effort: 'invalid-effort' }
          }
        });

      // Should handle gracefully and not crash
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('CORS and Middleware', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/research')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should accept JSON content type', async () => {
      mockGenerateObject
        .mockResolvedValueOnce(mockSerpQueriesResponse)
        .mockResolvedValueOnce(mockLearningsResponse)
        .mockResolvedValueOnce(mockAnswerResponse);

      mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

      const response = await request(app)
        .post('/api/research')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          query: 'test query'
        }));

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle concurrent requests', async () => {
      mockGenerateObject.mockResolvedValue(mockSerpQueriesResponse);
      mockGenerateObject.mockResolvedValue(mockLearningsResponse);
      mockGenerateObject.mockResolvedValue(mockAnswerResponse);
      mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/research')
          .send({ query: 'concurrent test' })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle timeout scenarios', async () => {
      // Mock a very slow response
      mockGenerateObject.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockAnswerResponse), 30000))
      );

      const response = await request(app)
        .post('/api/research')
        .send({ query: 'timeout test' })
        .timeout(5000); // 5 second timeout

      // Should timeout or complete
      expect([200, 408, 500]).toContain(response.status);
    }, 10000);
  });
});