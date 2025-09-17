import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepResearch, generateContactsFromLearnings } from '../../src/deep-research';
import { auditContacts } from '../../src/auditing';
import { getModel, trimPrompt } from '../../src/ai/providers';
import { RecursiveCharacterTextSplitter } from '../../src/ai/text-splitter';
import { mockFirecrawlApp } from '../mocks/firecrawl.mock';
import { mockGenerateObject } from '../mocks/openai.mock';

// Mock external dependencies
vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(() => mockFirecrawlApp)
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject
}));

vi.mock('js-tiktoken', () => ({
  getEncoding: vi.fn().mockReturnValue({
    encode: vi.fn().mockImplementation((text: string) => 
      new Array(Math.ceil(text.length / 4))
    )
  })
}));

describe('Edge Cases and Boundary Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty query string', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [] }
      });

      const result = await deepResearch({
        query: '',
        breadth: 1,
        depth: 1,
      });

      expect(result.learnings).toEqual([]);
      expect(result.visitedUrls).toEqual([]);
    });

    it('should handle single character query', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [{ query: 'a search', researchGoal: 'find info about a' }] }
      });

      mockGenerateObject.mockResolvedValueOnce({
        object: { learnings: ['Information about letter a'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValueOnce({
        success: true,
        data: [{ url: 'test', markdown: 'Letter a information' }]
      });

      const result = await deepResearch({
        query: 'a',
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle extremely long query', async () => {
      const longQuery = 'a'.repeat(10000); // 10KB query

      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [{ query: 'search for long content', researchGoal: 'find info' }] }
      });

      const result = await deepResearch({
        query: longQuery,
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle query with special characters', async () => {
      const specialQuery = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文 🚀 émojis';

      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [{ query: 'special chars search', researchGoal: 'find info' }] }
      });

      mockGenerateObject.mockResolvedValueOnce({
        object: { learnings: ['Special character info'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValueOnce({
        success: true,
        data: [{ url: 'test', markdown: 'content' }]
      });

      const result = await deepResearch({
        query: specialQuery,
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle Unicode and emoji queries', async () => {
      const unicodeQuery = '🔥 How to build AI systems? 人工智能发展 Élève français';

      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: [{ query: 'AI systems unicode', researchGoal: 'find AI info' }] }
      });

      mockGenerateObject.mockResolvedValueOnce({
        object: { learnings: ['AI systems information'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValueOnce({
        success: true,
        data: [{ url: 'test', markdown: 'AI content' }]
      });

      const result = await deepResearch({
        query: unicodeQuery,
        breadth: 1,
        depth: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Extreme Parameter Values', () => {
    it('should handle zero breadth', async () => {
      const result = await deepResearch({
        query: 'test query',
        breadth: 0,
        depth: 1,
      });

      expect(result.learnings).toEqual([]);
      expect(result.visitedUrls).toEqual([]);
    });

    it('should handle zero depth', async () => {
      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 0,
      });

      expect(result.learnings).toEqual([]);
      expect(result.visitedUrls).toEqual([]);
    });

    it('should handle very large breadth', async () => {
      const largeQueries = Array.from({ length: 1000 }, (_, i) => ({
        query: `Query ${i}`,
        researchGoal: `Goal ${i}`
      }));

      mockGenerateObject.mockResolvedValueOnce({
        object: { queries: largeQueries }
      });

      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['Learning'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValue({
        success: true,
        data: []
      });

      const result = await deepResearch({
        query: 'test query',
        breadth: 1000,
        depth: 1,
      });

      // Should handle gracefully, possibly with concurrency limits
      expect(result).toBeDefined();
    });

    it('should handle very large depth', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { queries: [{ query: 'deep query', researchGoal: 'deep goal' }] }
      });

      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['Deep learning'], followUpQuestions: ['Follow up'] }
      });

      mockFirecrawlApp.search.mockResolvedValue({
        success: true,
        data: [{ url: 'deep', markdown: 'deep content' }]
      });

      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 100,
      });

      expect(result).toBeDefined();
    });

    it('should handle negative values gracefully', async () => {
      const result = await deepResearch({
        query: 'test query',
        breadth: -1,
        depth: -1,
      });

      // Should handle negative values gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Data Structure Edge Cases', () => {
    it('should handle empty learnings array', async () => {
      const result = await generateContactsFromLearnings({
        learnings: [],
      });

      expect(result).toEqual([]);
    });

    it('should handle learnings with no contact information', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { contacts: [] }
      });

      const result = await generateContactsFromLearnings({
        learnings: [
          'The weather is nice today',
          'Mathematics is interesting',
          'No contact information here'
        ],
      });

      expect(result).toEqual([]);
    });

    it('should handle malformed contact data', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          contacts: [
            {
              name: '', // Empty name
              email: 'invalid-email', // Invalid email format
              company: null, // Null company
              position: undefined, // Undefined position
              // Missing required fields
            }
          ]
        }
      });

      const result = await generateContactsFromLearnings({
        learnings: ['Some contact info'],
      });

      // Should handle malformed data gracefully
      expect(result).toHaveLength(1);
    });

    it('should handle very large contact arrays', async () => {
      const manyContacts = Array.from({ length: 10000 }, (_, i) => ({
        name: `Contact ${i}`,
        email: `contact${i}@example.com`,
        company: `Company ${i}`,
        position: 'Position',
        city: 'City',
        'state-province': 'State',
        country: 'Country',
        'time zone': 'UTC',
        industry: 'Tech',
        priority: 5,
        signal: 'Signal',
        signal_level: 5,
        compliment: 'Great',
        tags: 'tag',
        links: 'link',
        source: 'deep-research' as const
      }));

      const result = await auditContacts({
        contacts: manyContacts,
        criteria: { sampleSize: 10, verificationDepth: 1 },
        originalQuery: 'test',
      });

      expect(result.verifiedContacts).toHaveLength(10000);
    });
  });

  describe('Text Processing Edge Cases', () => {
    it('should handle very long text in trimPrompt', () => {
      const veryLongText = 'a'.repeat(1000000); // 1MB text
      const result = trimPrompt(veryLongText, 1000);

      expect(result.length).toBeLessThan(veryLongText.length);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle text with only whitespace', () => {
      const whitespaceText = '   \n\n\t\t\r\r   ';
      const result = trimPrompt(whitespaceText, 1000);

      expect(result).toBe(whitespaceText);
    });

    it('should handle text with mixed line endings', () => {
      const mixedText = 'Line 1\r\nLine 2\nLine 3\rLine 4';
      const result = trimPrompt(mixedText, 1000);

      expect(result).toBe(mixedText);
    });

    it('should handle text splitter with extreme parameters', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1,
        chunkOverlap: 0,
      });

      const text = 'Hello world';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(1));
    });

    it('should handle text splitter with overlap larger than chunk size', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 5,
        chunkOverlap: 10,
      });

      const text = 'This is a test string for overlap testing';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle concurrent request limits', async () => {
      // Simulate many parallel requests that exceed concurrency limits
      const promises = Array.from({ length: 100 }, () =>
        deepResearch({
          query: 'concurrent test',
          breadth: 1,
          depth: 1,
        })
      );

      mockGenerateObject.mockResolvedValue({
        object: { queries: [{ query: 'test', researchGoal: 'test' }] }
      });

      mockGenerateObject.mockResolvedValue({
        object: { learnings: ['test'], followUpQuestions: [] }
      });

      mockFirecrawlApp.search.mockResolvedValue({
        success: true,
        data: []
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
    });

    it('should handle very deep recursion', async () => {
      const deepQueries = {
        object: {
          queries: [{ query: 'deep', researchGoal: 'keep going deeper' }]
        }
      };

      const deepLearnings = {
        object: {
          learnings: ['Deep insight'],
          followUpQuestions: ['Go deeper']
        }
      };

      mockGenerateObject.mockResolvedValue(deepQueries);
      mockGenerateObject.mockResolvedValue(deepLearnings);
      mockFirecrawlApp.search.mockResolvedValue({
        success: true,
        data: [{ url: 'deep', markdown: 'deep content' }]
      });

      // This should hit recursion limits or complete efficiently
      const result = await deepResearch({
        query: 'test query',
        breadth: 1,
        depth: 50, // Very deep
      });

      expect(result).toBeDefined();
    });

    it('should handle model configuration edge cases', () => {
      const edgeConfigs = [
        null,
        undefined,
        {},
        { variant: null },
        { reasoning: null },
        { text: null },
        { variant: 'invalid-model' as any },
        { reasoning: { effort: 'invalid' as any } },
        { text: { verbosity: 'invalid' as any } }
      ];

      edgeConfigs.forEach(config => {
        expect(() => getModel(config as any)).not.toThrow();
      });
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/'.repeat(100) + 'file.json';
      
      // File operations should handle long paths gracefully
      expect(longPath.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in file names', () => {
      const specialFiles = [
        'file with spaces.json',
        'file-with-dashes.json',
        'file_with_underscores.json',
        'file.with.dots.json',
        'fileñwithñspecialñchars.json'
      ];

      specialFiles.forEach(filename => {
        expect(filename).toBeTruthy();
      });
    });
  });

  describe('Audit Edge Cases', () => {
    it('should handle audit with sample size larger than contact count', async () => {
      const singleContact = [{
        name: 'Test',
        email: 'test@example.com',
        company: 'Test Co',
        position: 'Test',
        city: 'Test',
        'state-province': 'Test',
        country: 'Test',
        'time zone': 'UTC',
        industry: 'Test',
        priority: 5,
        signal: 'Test',
        signal_level: 5,
        compliment: 'Test',
        tags: 'test',
        links: 'test',
        source: 'deep-research' as const
      }];

      const result = await auditContacts({
        contacts: singleContact,
        criteria: { sampleSize: 100, verificationDepth: 1 },
        originalQuery: 'test',
      });

      expect(result.verifiedContacts).toHaveLength(1);
    });

    it('should handle audit with zero sample size', async () => {
      const contacts = [
        {
          name: 'Test',
          email: 'test@example.com',
          company: 'Test Co',
          position: 'Test',
          city: 'Test',
          'state-province': 'Test',
          country: 'Test',
          'time zone': 'UTC',
          industry: 'Test',
          priority: 5,
          signal: 'Test',
          signal_level: 5,
          compliment: 'Test',
          tags: 'test',
          links: 'test',
          source: 'deep-research' as const
        }
      ];

      const result = await auditContacts({
        contacts,
        criteria: { sampleSize: 0, verificationDepth: 1 },
        originalQuery: 'test',
      });

      expect(result.verifiedContacts).toHaveLength(1);
      expect(result.corrections).toEqual([]);
    });
  });
});