import { vi } from 'vitest';

// Mock AI responses for different scenarios
export const mockContactExtractionResponse = {
  object: {
    contacts: [
      {
        name: 'John Doe',
        email: 'john.doe@techcorp.com',
        company: 'TechCorp',
        position: 'CEO',
        department: 'Executive',
        city: 'San Francisco',
        'state-province': 'California',
        country: 'United States',
        'time zone': 'PST',
        industry: 'Technology',
        priority: 9,
        signal: 'Actively hiring AI talent',
        signal_level: 8,
        compliment: 'Visionary leader in AI development',
        tags: 'AI, Machine Learning, CEO',
        links: 'https://linkedin.com/in/johndoe, https://techcorp.com',
        number: '(555) 123-4567',
        source: 'deep-research' as const,
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@dataflow.com',
        company: 'DataFlow Inc.',
        position: 'CTO',
        department: 'Engineering',
        city: 'San Francisco',
        'state-province': 'California',
        country: 'United States',
        'time zone': 'PST',
        industry: 'Technology',
        priority: 8,
        signal: 'Expanding ML team',
        signal_level: 7,
        compliment: 'Expert in distributed systems',
        tags: 'CTO, Machine Learning, Engineering',
        links: 'https://linkedin.com/in/janesmith',
        source: 'deep-research' as const,
      }
    ]
  }
};

export const mockSerpQueriesResponse = {
  object: {
    queries: [
      {
        query: 'San Francisco tech CEOs hiring AI engineers',
        researchGoal: 'Find technology company executives actively recruiting AI talent'
      },
      {
        query: 'Bay Area startup founders machine learning',
        researchGoal: 'Identify startup leaders building ML-powered companies'
      }
    ]
  }
};

export const mockLearningsResponse = {
  object: {
    learnings: [
      'John Doe is CEO of TechCorp, based in San Francisco, recently raised $50M',
      'Jane Smith serves as CTO at DataFlow Inc., specializes in ML infrastructure',
      'Mike Johnson is Director of Engineering at CloudTech, planning IPO'
    ],
    followUpQuestions: [
      'What other AI companies are hiring in San Francisco?',
      'Which executives have technical backgrounds in machine learning?'
    ]
  }
};

export const mockReportResponse = {
  object: {
    reportMarkdown: `# San Francisco AI Leadership Research

## Executive Summary
This research identifies key technology leaders in the San Francisco Bay Area who are actively building AI-powered companies and hiring talent.

## Key Findings
- TechCorp under John Doe's leadership has significant funding for AI initiatives
- DataFlow Inc. focuses on ML infrastructure with Jane Smith as technical leader
- Growing demand for AI talent across multiple companies

## Recommendations
- Focus on established companies with recent funding
- Target technical leaders with hands-on AI experience`
  }
};

export const mockAnswerResponse = {
  object: {
    exactAnswer: 'John Doe, CEO of TechCorp (john.doe@techcorp.com)'
  }
};

export const mockFeedbackResponse = {
  object: {
    questions: [
      'What specific AI roles are most in demand?',
      'Which companies have the largest AI budgets?',
      'Are there any remote opportunities available?'
    ]
  }
};

export const mockAuditSummaryResponse = {
  object: {
    summary: `## Audit Summary
- Total contacts: 2
- Sample verified: 1
- Corrections made: 1
- Data quality: Good (minor email correction found)

### Issues Found
- Email format standardization needed
- Position titles required consistency check

### Confidence Level
High confidence in contact accuracy after verification.`
  }
};

// Mock generateObject function
export const mockGenerateObject = vi.fn().mockImplementation(({ prompt }) => {
  if (prompt.includes('extract contact information')) {
    return Promise.resolve(mockContactExtractionResponse);
  }
  if (prompt.includes('generate a list of SERP queries')) {
    return Promise.resolve(mockSerpQueriesResponse);
  }
  if (prompt.includes('generate a list of learnings')) {
    return Promise.resolve(mockLearningsResponse);
  }
  if (prompt.includes('write a final report')) {
    return Promise.resolve(mockReportResponse);
  }
  if (prompt.includes('write a final answer')) {
    return Promise.resolve(mockAnswerResponse);
  }
  if (prompt.includes('follow up questions')) {
    return Promise.resolve(mockFeedbackResponse);
  }
  if (prompt.includes('audit summary')) {
    return Promise.resolve(mockAuditSummaryResponse);
  }
  
  // Default response
  return Promise.resolve({
    object: { result: 'mocked response' }
  });
});

// Mock the createOpenAI function
export const mockCreateOpenAI = vi.fn().mockReturnValue(
  vi.fn().mockReturnValue({
    modelId: 'gpt-4o-mini',
  })
);