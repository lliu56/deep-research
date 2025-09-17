import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  generateContactsFromLearnings, 
  writeFinalReport, 
  writeFinalAnswer 
} from '../../src/deep-research';
import { 
  mockContactExtractionResponse, 
  mockReportResponse, 
  mockAnswerResponse,
  mockGenerateObject 
} from '../mocks/openai.mock';
import { mockLearnings, mockVisitedUrls } from '../mocks/data.mock';

// Mock the dependencies
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

describe('Deep Research Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContactsFromLearnings', () => {
    it('should extract contacts from learnings', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockContactExtractionResponse);

      const result = await generateContactsFromLearnings({
        learnings: mockLearnings,
        contactHierarchy: ['CEO', 'CTO'],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'John Doe',
        email: 'john.doe@techcorp.com',
        company: 'TechCorp',
        position: 'CEO',
        source: 'deep-research'
      });
    });

    it('should handle empty learnings', async () => {
      const result = await generateContactsFromLearnings({
        learnings: [],
      });

      expect(result).toEqual([]);
    });

    it('should include contact hierarchy in prompt', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockContactExtractionResponse);

      await generateContactsFromLearnings({
        learnings: mockLearnings,
        contactHierarchy: ['CEO', 'CTO', 'VP'],
      });

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('CEO, CTO, VP')
        })
      );
    });

    it('should pass model configuration', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockContactExtractionResponse);
      
      const modelConfig = {
        variant: 'gpt-5-mini' as const,
        reasoning: { effort: 'high' as const }
      };

      await generateContactsFromLearnings({
        learnings: mockLearnings,
        modelConfig,
      });

      expect(mockGenerateObject).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockGenerateObject.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        generateContactsFromLearnings({
          learnings: mockLearnings,
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('writeFinalReport', () => {
    it('should generate a comprehensive report', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockReportResponse);

      const result = await writeFinalReport({
        prompt: 'Research tech leaders',
        learnings: mockLearnings,
        visitedUrls: mockVisitedUrls,
      });

      expect(result).toContain('San Francisco AI Leadership Research');
      expect(result).toContain('## Sources');
      expect(result).toContain('https://example.com/tech-leaders');
    });

    it('should include all visited URLs in sources', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockReportResponse);

      const result = await writeFinalReport({
        prompt: 'Test prompt',
        learnings: mockLearnings,
        visitedUrls: mockVisitedUrls,
      });

      mockVisitedUrls.forEach(url => {
        expect(result).toContain(url);
      });
    });

    it('should handle empty learnings', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { reportMarkdown: '# Empty Report' }
      });

      const result = await writeFinalReport({
        prompt: 'Test prompt',
        learnings: [],
        visitedUrls: [],
      });

      expect(result).toContain('# Empty Report');
    });
  });

  describe('writeFinalAnswer', () => {
    it('should generate concise answer', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockAnswerResponse);

      const result = await writeFinalAnswer({
        prompt: 'Who is the CEO of TechCorp?',
        learnings: mockLearnings,
      });

      expect(result).toBe('John Doe, CEO of TechCorp (john.doe@techcorp.com)');
    });

    it('should handle empty learnings', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { exactAnswer: 'No information found' }
      });

      const result = await writeFinalAnswer({
        prompt: 'Test question',
        learnings: [],
      });

      expect(result).toBe('No information found');
    });

    it('should pass model configuration', async () => {
      mockGenerateObject.mockResolvedValueOnce(mockAnswerResponse);
      
      const modelConfig = {
        variant: 'gpt-5-mini' as const,
        text: { verbosity: 'low' as const }
      };

      await writeFinalAnswer({
        prompt: 'Test question',
        learnings: mockLearnings,
        modelConfig,
      });

      expect(mockGenerateObject).toHaveBeenCalled();
    });
  });

  describe('Contact Schema Validation', () => {
    it('should validate all required contact fields', async () => {
      const mockResponse = {
        object: {
          contacts: [{
            name: 'Test User',
            email: 'test@example.com',
            company: 'Test Co',
            position: 'CEO',
            city: 'Test City',
            'state-province': 'Test State',
            country: 'Test Country',
            'time zone': 'PST',
            industry: 'Technology',
            priority: 5,
            signal: 'Test signal',
            signal_level: 5,
            compliment: 'Great leader',
            tags: 'tech,ceo',
            links: 'https://test.com',
            source: 'deep-research'
          }]
        }
      };

      mockGenerateObject.mockResolvedValueOnce(mockResponse);

      const result = await generateContactsFromLearnings({
        learnings: ['Test learning'],
      });

      expect(result[0]).toMatchObject({
        name: expect.any(String),
        email: expect.any(String),
        company: expect.any(String),
        position: expect.any(String),
        city: expect.any(String),
        'state-province': expect.any(String),
        country: expect.any(String),
        'time zone': expect.any(String),
        industry: expect.any(String),
        priority: expect.any(Number),
        signal: expect.any(String),
        signal_level: expect.any(Number),
        compliment: expect.any(String),
        tags: expect.any(String),
        links: expect.any(String),
        source: 'deep-research'
      });
    });
  });
});