import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { mockGenerateObject, mockSerpQueriesResponse, mockLearningsResponse, mockAnswerResponse } from '../mocks/openai.mock';
import { mockFirecrawlApp, mockFirecrawlResponse } from '../mocks/firecrawl.mock';

// Mock file system operations
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

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

describe('Answer Mode E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  it('should provide concise answer for direct questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Who is the CEO of OpenAI?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Sam Altman' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('Sam Altman');
  });

  it('should handle mathematical questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What is 15% of $2.5 million?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: '$375,000' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('$375,000');
  });

  it('should handle yes/no questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Is GPT-4 more advanced than GPT-3?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Yes' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('Yes');
  });

  it('should handle multiple choice questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Which company developed ChatGPT? A) Google B) Meta C) OpenAI D) Microsoft',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'C) OpenAI' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('C) OpenAI');
  });

  it('should handle contact lookup questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What is the email address of the CEO of TechCorp?',
      outputFormat: 'answer'
    }));

    const techCorpLearnings = {
      object: {
        learnings: [
          'John Doe is the CEO of TechCorp',
          'John Doe can be reached at john.doe@techcorp.com',
          'TechCorp is headquartered in San Francisco'
        ],
        followUpQuestions: []
      }
    };

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(techCorpLearnings)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'john.doe@techcorp.com' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('john.doe@techcorp.com');
  });

  it('should handle date-based questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'When was OpenAI founded?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'December 11, 2015' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('December 11, 2015');
  });

  it('should handle questions with no definitive answer', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What is the meaning of life according to Douglas Adams?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: '42' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('42');
  });

  it('should handle insufficient information gracefully', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What is the secret recipe for Coca-Cola?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce({
        object: {
          learnings: ['Coca-Cola recipe is a trade secret', 'Recipe is kept in a vault'],
          followUpQuestions: []
        }
      })
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Information not publicly available' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('Information not publicly available');
  });

  it('should use minimal research depth for quick answers', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What color is the sky?',
      outputFormat: 'answer',
      depth: 1, // Minimal depth for simple questions
      breadth: 1
    }));

    mockGenerateObject
      .mockResolvedValueOnce({
        object: { queries: [{ query: 'sky color', researchGoal: 'find sky color' }] }
      })
      .mockResolvedValueOnce({
        object: { learnings: ['The sky appears blue during the day'], followUpQuestions: [] }
      })
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Blue' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should make minimal API calls for simple questions
    expect(mockFirecrawlApp.search).toHaveBeenCalledTimes(1);
    
    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('Blue');
  });

  it('should handle LaTeX formatted questions', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'What is the integral of x^2 dx? Format answer in LaTeX.',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: '\\frac{x^3}{3} + C' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('\\frac{x^3}{3} + C');
  });

  it('should handle model configuration in answer mode', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Quick factual question',
      outputFormat: 'answer',
      modelConfig: {
        variant: 'gpt-5-mini',
        text: { verbosity: 'low' } // Low verbosity for concise answers
      }
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Concise answer' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Model configuration should be passed through
    expect(mockGenerateObject).toHaveBeenCalled();
    
    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
  });

  it('should not generate contacts or reports in answer mode', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Who leads Google AI?',
      outputFormat: 'answer'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { exactAnswer: 'Demis Hassabis' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should only write answer.md
    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();

    // Should NOT write contacts.json or report.md
    const contactsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('contacts.json')
    );
    expect(contactsWrite).toBeUndefined();

    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeUndefined();
  });
});