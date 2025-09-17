import { vi } from 'vitest';
import type { SearchResponse } from '@mendable/firecrawl-js';

export const mockFirecrawlResponse: SearchResponse = {
  success: true,
  data: [
    {
      url: 'https://example.com/tech-leaders',
      markdown: `# Tech Leaders in San Francisco
      
John Doe is the CEO of TechCorp, a leading AI company based in San Francisco. 
Contact: john.doe@techcorp.com, Phone: (555) 123-4567
TechCorp has raised $50M in Series B funding.

Jane Smith serves as CTO at DataFlow Inc., located in SOMA district.
Email: jane.smith@dataflow.com
The company specializes in machine learning infrastructure.

Mike Johnson is the Director of Engineering at CloudTech.
You can reach him at m.johnson@cloudtech.io
CloudTech recently announced their IPO plans.`,
      title: 'San Francisco Tech Leadership Directory',
      description: 'Directory of technology leaders in the SF Bay Area'
    },
    {
      url: 'https://example.com/ai-research',
      markdown: `# AI Research Centers
      
Dr. Sarah Chen leads the AI Safety Research team at Stanford.
Contact: sarah.chen@stanford.edu
Focus areas: AI alignment, safety protocols

Prof. David Kim heads the Machine Learning Department at UCSF.
Email: dkim@ucsf.edu
Research: Healthcare AI applications`,
      title: 'AI Research Leadership',
      description: 'Academic and research leaders in AI'
    }
  ]
};

export const mockEmptyFirecrawlResponse: SearchResponse = {
  success: true,
  data: []
};

export const mockFirecrawlError = {
  success: false,
  error: 'Rate limit exceeded'
};

// Mock the FirecrawlApp class
export const mockFirecrawlApp = {
  search: vi.fn().mockResolvedValue(mockFirecrawlResponse),
};

// Export a function to create fresh mocks
export const createFirecrawlMock = () => ({
  search: vi.fn().mockResolvedValue(mockFirecrawlResponse),
});