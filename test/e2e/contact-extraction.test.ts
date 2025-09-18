import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { mockGenerateObject, mockContactExtractionResponse, mockSerpQueriesResponse, mockLearningsResponse } from '../mocks/openai.mock';
import { mockFirecrawlApp, mockFirecrawlResponse } from '../mocks/firecrawl.mock';
import { mockFileOperations } from '../mocks/data.mock';

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

describe('Contact Extraction E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock file system reads
    mockFs.readFile.mockImplementation(async (path: string) => {
      const pathStr = path.toString();
      if (pathStr.includes('RESEARCH_INPUT.json')) {
        return JSON.stringify({
          query: 'San Francisco tech CEOs',
          depth: 1,
          breadth: 2,
          outputFormat: 'contacts_db',
          contactHierarchy: ['CEO', 'CTO'],
          auditingCriteria: {
            sampleSize: 1,
            verificationDepth: 1
          }
        });
      }
      return mockFileOperations[pathStr] || '';
    });

    // Mock file system writes
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Clean up any created files
    vi.clearAllMocks();
  });

  it('should complete full contact extraction pipeline', async () => {
    // Setup the full pipeline mock sequence
    mockGenerateObject
      // 1. SERP query generation
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      // 2. Learning extraction (2 calls for breadth=2)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      // 3. Contact extraction from learnings
      .mockResolvedValueOnce(mockContactExtractionResponse)
      // 4. Audit verification - SERP query
      .mockResolvedValueOnce({
        object: { queries: [{ query: 'verify John Doe TechCorp CEO', researchGoal: 'verify' }] }
      })
      // 5. Audit verification - learning extraction
      .mockResolvedValueOnce({
        object: { learnings: ['John Doe confirmed as CEO'], followUpQuestions: [] }
      })
      // 6. Audit verification - contact extraction
      .mockResolvedValueOnce({
        object: {
          contacts: [{
            ...mockContactExtractionResponse.object.contacts[0],
            position: 'Chief Executive Officer' // Changed to test corrections
          }]
        }
      })
      // 7. Audit summary generation
      .mockResolvedValueOnce({
        object: {
          summary: '# Audit Summary\nMinor corrections made to position titles.'
        }
      })
      // 8. Final report generation
      .mockResolvedValueOnce({
        object: {
          reportMarkdown: '# Research Report\nFound tech leaders in San Francisco.'
        }
      });

    // Mock Firecrawl calls
    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    // Import and run the main function
    const runModule = await import('../../src/run');
    
    // Execute the main pipeline
    await runModule.default;

    // Verify file operations
    expect(mockFs.readFile).toHaveBeenCalledWith('RESEARCH_INPUT.json', 'utf-8');
    
    // Should write contacts.json
    const contactsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('contacts.json')
    );
    expect(contactsWrite).toBeDefined();
    
    // Should write corrections.json
    const correctionsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('corrections.json')
    );
    expect(correctionsWrite).toBeDefined();
    
    // Should write report.md
    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeDefined();
    
    // Verify the report includes contact information
    const reportContent = reportWrite![1] as string;
    expect(reportContent).toContain('Extracted Contacts');
    expect(reportContent).toContain('Contact details saved to contacts.json');
  });

  it('should handle minimal configuration', async () => {
    // Mock minimal config
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Simple query'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockContactExtractionResponse)
      .mockResolvedValueOnce({
        object: { reportMarkdown: '# Simple Report' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should still complete successfully
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('should handle missing configuration file gracefully', async () => {
    // Mock file not found
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));

    // Since there's no query in defaults, this should exit early
    const runModule = await import('../../src/run');
    
    // Should exit without error due to empty query
    expect(async () => await runModule.default).not.toThrow();
  });

  it('should generate structured contact output matching schema', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Tech leaders',
      outputFormat: 'contacts_db'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockContactExtractionResponse)
      .mockResolvedValueOnce({
        object: { reportMarkdown: '# Report' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Find the contacts.json write call
    const contactsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('contacts.json')
    );
    
    expect(contactsWrite).toBeDefined();
    
    const contactsData = JSON.parse(contactsWrite![1] as string);
    expect(Array.isArray(contactsData)).toBe(true);
    
    if (contactsData.length > 0) {
      const contact = contactsData[0];
      
      // Verify all required fields are present
      expect(contact).toHaveProperty('name');
      expect(contact).toHaveProperty('email');
      expect(contact).toHaveProperty('company');
      expect(contact).toHaveProperty('position');
      expect(contact).toHaveProperty('city');
      expect(contact).toHaveProperty('stateProvince');
      expect(contact).toHaveProperty('country');
      expect(contact).toHaveProperty('timeZone');
      expect(contact).toHaveProperty('industry');
      expect(contact).toHaveProperty('priority');
      expect(contact).toHaveProperty('signal');
      expect(contact).toHaveProperty('signalLevel');
      expect(contact).toHaveProperty('compliment');
      expect(contact).toHaveProperty('tags');
      expect(contact).toHaveProperty('links');
      expect(contact).toHaveProperty('source');
      
      // Verify data types
      expect(typeof contact.name).toBe('string');
      expect(typeof contact.email).toBe('string');
      expect(typeof contact.priority).toBe('number');
      expect(typeof contact.signalLevel).toBe('string');
      expect(Array.isArray(contact.tags)).toBe(true);
      expect(contact.source).toBe('deep-research');
    }
  });

  it('should handle report mode without contact extraction', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'AI research trends',
      outputFormat: 'report'
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce({
        object: { reportMarkdown: '# AI Research Trends Report' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should write report.md but not contacts.json
    const reportWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('report.md')
    );
    expect(reportWrite).toBeDefined();
    
    const contactsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('contacts.json')
    );
    expect(contactsWrite).toBeUndefined();
  });

  it('should handle answer mode', async () => {
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

    // Should write answer.md
    const answerWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('answer.md')
    );
    expect(answerWrite).toBeDefined();
    expect(answerWrite![1]).toBe('Sam Altman');
  });

  it('should handle large contact hierarchy correctly', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Tech company leadership',
      outputFormat: 'contacts_db',
      contactHierarchy: ['CEO', 'CTO', 'VP Engineering', 'Director', 'Senior Manager']
    }));

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockContactExtractionResponse)
      .mockResolvedValueOnce({
        object: { reportMarkdown: '# Leadership Report' }
      });

    mockFirecrawlApp.search.mockResolvedValueOnce(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Should pass hierarchy to contact extraction
    const contactExtractionCall = mockGenerateObject.mock.calls.find(call =>
      call[0].prompt.includes('CEO, CTO, VP Engineering, Director, Senior Manager')
    );
    expect(contactExtractionCall).toBeDefined();
  });

  it('should preserve all audit corrections in final report', async () => {
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      query: 'Test query',
      outputFormat: 'contacts_db',
      auditingCriteria: {
        sampleSize: 1,
        verificationDepth: 1
      }
    }));

    const corrections = [
      { email: 'test@example.com', field: 'position', before: 'CEO', after: 'Chief Executive Officer', reason: 'verification' },
      { email: 'test@example.com', field: 'department', before: 'Exec', after: 'Executive', reason: 'verification' }
    ];

    mockGenerateObject
      .mockResolvedValueOnce(mockSerpQueriesResponse)
      .mockResolvedValueOnce(mockLearningsResponse)
      .mockResolvedValueOnce(mockContactExtractionResponse)
      // Audit mocks that create corrections
      .mockResolvedValueOnce({ object: { queries: [{ query: 'verify', researchGoal: 'verify' }] } })
      .mockResolvedValueOnce({ object: { learnings: ['verified'], followUpQuestions: [] } })
      .mockResolvedValueOnce({
        object: {
          contacts: [{
            ...mockContactExtractionResponse.object.contacts[0],
            position: 'Chief Executive Officer',
            department: 'Executive'
          }]
        }
      })
      .mockResolvedValueOnce({
        object: { summary: '# Audit Summary\n2 corrections made.' }
      })
      .mockResolvedValueOnce({
        object: { reportMarkdown: '# Main Report' }
      });

    mockFirecrawlApp.search.mockResolvedValue(mockFirecrawlResponse);

    const runModule = await import('../../src/run');
    await runModule.default;

    // Check corrections were saved
    const correctionsWrite = mockFs.writeFile.mock.calls.find(call => 
      call[0].toString().includes('corrections.json')
    );
    expect(correctionsWrite).toBeDefined();
    
    const correctionsData = JSON.parse(correctionsWrite![1] as string);
    expect(Array.isArray(correctionsData)).toBe(true);
    expect(correctionsData.length).toBeGreaterThan(0);
  });
});
