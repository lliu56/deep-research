import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { mockGenerateObject, mockSerpQueriesResponse, mockLearningsResponse, mockReportResponse, mockFeedbackResponse } from '../mocks/openai.mock';
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

describe('Report Generation E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock file system writes
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  it('should generate comprehensive research report', async () => {
    // Mock configuration for report mode
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'AI safety research landscape',
      depth: 2,
      breadth: 3,
      outputFormat: 'report'
    }));

    // Setup full report generation pipeline
    mockGenerateObject
      // 1. Feedback questions generation
      .mockResolvedValueOnce(mockFeedbackResponse)
      // 2. SERP query generation
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      // 3. Learning extraction (multiple calls for breadth=3)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      // 4. Recursive calls for depth=2 (simplified)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      // 5. Final report generation
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Verify report was written
    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeDefined();
    
    const reportContent = reportWrite![1] as string;
    expect(reportContent).toContain('San Francisco AI Leadership Research');
    expect(reportContent).toContain('## Sources');
    expect(reportContent).toContain('https://example.com/tech-leaders');
  });

  it('should include follow-up questions in enhanced research context', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Machine learning trends',
      outputFormat: 'report'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Verify feedback questions were generated
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('follow up questions')
      })
    );

    // Check that the enhanced query includes the feedback context
    const deepResearchCall = mockGenerateObject.mock.calls.find(call =>
      call[0].prompt.includes('Research Context: Conduct comprehensive research')
    );
    expect(deepResearchCall).toBeDefined();
  });

  it('should handle very deep research correctly', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Deep AI research',
      depth: 3,
      breadth: 2,
      outputFormat: 'report'
    }));

    // Mock extensive call chain for depth=3
    mockGenerateObject
      .mockResolvedValue(mockFeedbackResponse) // Feedback
      .mockResolvedValue(mockSerpQueriesResponse) // SERP queries
      .mockResolvedValue(mockLearningsResponse) // Learnings
      .mockResolvedValue(mockReportResponse); // Final report

    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should have made multiple levels of research calls
    expect(mockFirecrawlApp.search).toHaveBeenCalled();
    expect(mockGenerateObject).toHaveBeenCalled();
  });

  it('should accumulate learnings across research depth', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Comprehensive tech analysis',
      depth: 2,
      breadth: 2,
      outputFormat: 'report'
    }));

    const learnings1 = {
      object: {
        learnings: ['Learning 1', 'Learning 2'],
        followUpQuestions: ['Question 1', 'Question 2']
      }
    };
    
    const learnings2 = {
      object: {
        learnings: ['Learning 3', 'Learning 4'],
        followUpQuestions: ['Question 3', 'Question 4']
      }
    };

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(learnings1)
      .mockResolvedValueOnce(learnings2)
      // Recursive depth=2 calls
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(learnings1)
      .mockResolvedValueOnce(learnings2)
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Verify final report generation includes accumulated learnings
    const reportGenerationCall = mockGenerateObject.mock.calls.find(call =>
      call[0].prompt.includes('write a final report')
    );
    
    expect(reportGenerationCall).toBeDefined();
    // Should contain learnings from multiple research phases
    expect(reportGenerationCall![0].prompt).toContain('<learnings>');
  });

  it('should handle model configuration in report mode', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'AI models comparison',
      outputFormat: 'report',
      modelConfig: {
        variant: 'gpt-5-mini',
        reasoning: { effort: 'high' },
        text: { verbosity: 'high' }
      }
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // All AI calls should have been made (model config is passed internally)
    expect(mockGenerateObject).toHaveBeenCalled();
  });

  it('should include all visited URLs in sources section', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Tech ecosystem analysis',
      depth: 1,
      breadth: 3,
      outputFormat: 'report'
    }));

    // Mock multiple different search results
    const multipleUrls = {
      success: true,
      data: [
        { url: 'https://example.com/page1', markdown: 'Content 1', title: 'Page 1' },
        { url: 'https://example.com/page2', markdown: 'Content 2', title: 'Page 2' },
        { url: 'https://example.com/page3', markdown: 'Content 3', title: 'Page 3' }
      ]
    };

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce({
        object: {
          queries: [
            { query: 'Query 1', researchGoal: 'Goal 1' },
            { query: 'Query 2', researchGoal: 'Goal 2' },
            { query: 'Query 3', researchGoal: 'Goal 3' }
          ]
        }
      })
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValue(multipleUrls);

    const runModule = await import('../../src/run');
    await runModule.default;

    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    
    const reportContent = reportWrite![1] as string;
    
    // Should include all unique URLs in sources
    expect(reportContent).toContain('## Sources');
    expect(reportContent).toContain('https://example.com/page1');
    expect(reportContent).toContain('https://example.com/page2');
    expect(reportContent).toContain('https://example.com/page3');
  });

  it('should handle very broad research correctly', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Broad industry analysis',
      depth: 1,
      breadth: 8,
      outputFormat: 'report'
    }));

    // Mock generation of many queries
    const manyQueries = {
      object: {
        queries: Array.from({ length: 8 }, (_, i) => ({
          query: `Query ${i + 1}`,
          researchGoal: `Research goal ${i + 1}`
        }))
      }
    };

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce(manyQueries)
      .mockResolvedValue(mockLearningsResponse) // Multiple learning calls
      .mockResolvedValueOnce(mockReportResponse);

    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should have made 8 search calls for breadth=8
    expect(mockFirecrawlApp.search).toHaveBeenCalledTimes(8);
  });

  it('should generate report even with some failed searches', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Resilient research test',
      depth: 1,
      breadth: 3,
      outputFormat: 'report'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce({
        object: {
          queries: [
            { query: 'Query 1', researchGoal: 'Goal 1' },
            { query: 'Query 2', researchGoal: 'Goal 2' },
            { query: 'Query 3', researchGoal: 'Goal 3' }
          ]
        }
      })
      .mockResolvedValueOnce(mockLearningsResponse) // Only one succeeds
      .mockResolvedValueOnce(mockReportResponse);

    // Mock partial failures
    mockFirecrawlApp.search
      .mockResolvedValueOnce(mockFirecrawlResponse) // First succeeds
      .mockRejectedValueOnce(new Error('Network error')) // Second fails
      .mockRejectedValueOnce(new Error('Timeout')); // Third fails

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should still generate a report with available data
    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeDefined();
  });

  it('should handle empty research results gracefully', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Obscure topic with no results',
      outputFormat: 'report'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockFeedbackResponse)
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce({
        object: {
          learnings: [], // Empty learnings
          followUpQuestions: []
        }
      })
      .mockResolvedValueOnce({
        object: {
          reportMarkdown: '# Research Report\n\nNo significant findings available for this topic.'
        }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce({
      success: true,
      data: [] // Empty search results
    });

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should still generate a report
    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeDefined();
    
    const reportContent = reportWrite![1] as string;
    expect(reportContent).toContain('No significant findings');
  });
});