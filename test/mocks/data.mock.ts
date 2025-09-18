import type { Contact, ResearchInput, AuditingCriteria, Correction } from '../../src/types';

export const mockResearchInput: ResearchInput = {
  query: 'San Francisco tech CEOs',
  depth: 2,
  breadth: 3,
  outputFormat: 'contacts_db',
  contactHierarchy: ['CEO', 'CTO'],
  modelConfig: {
    variant: 'gpt-5-mini',
    reasoning: { effort: 'medium' },
    text: { verbosity: 'medium' }
  },
  auditingCriteria: {
    sampleSize: 2,
    verificationDepth: 1
  }
};

export const mockContacts: Contact[] = [
  {
    name: 'John Doe',
    email: 'john.doe@techcorp.com',
    company: 'TechCorp',
    position: 'CEO',
    department: 'Executive',
    city: 'San Francisco',
    stateProvince: 'California',
    country: 'United States',
    timeZone: 'PST',
    industry: 'Technology',
    priority: 9,
    signal: 'Actively hiring AI talent',
    signalLevel: '8',
    compliment: 'Visionary leader in AI development',
    tags: ['AI', 'Machine Learning', 'CEO'],
    links: 'https://linkedin.com/in/johndoe, https://techcorp.com',
    number: '(555) 123-4567',
    source: 'deep-research',
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@dataflow.com',
    company: 'DataFlow Inc.',
    position: 'CTO',
    department: 'Engineering',
    city: 'San Francisco',
    stateProvince: 'California',
    country: 'United States',
    timeZone: 'PST',
    industry: 'Technology',
    priority: 8,
    signal: 'Expanding ML team',
    signalLevel: '7',
    compliment: 'Expert in distributed systems',
    tags: ['CTO', 'Machine Learning', 'Engineering'],
    links: 'https://linkedin.com/in/janesmith',
    source: 'deep-research',
  }
];

export const mockCorrections: Correction[] = [
  {
    email: 'john.doe@techcorp.com',
    field: 'position',
    before: 'Chief Executive Officer',
    after: 'CEO',
    reason: 'Verification research found updated information'
  }
];

export const mockLearnings = [
  'John Doe is CEO of TechCorp, based in San Francisco, recently raised $50M',
  'Jane Smith serves as CTO at DataFlow Inc., specializes in ML infrastructure',
  'Mike Johnson is Director of Engineering at CloudTech, planning IPO'
];

export const mockVisitedUrls = [
  'https://example.com/tech-leaders',
  'https://example.com/ai-research',
  'https://example.com/startup-directory'
];

export const mockAuditingCriteria: AuditingCriteria = {
  sampleSize: 2,
  verificationDepth: 1
};

// Test configurations for different scenarios
export const mockEmptyResearchInput: ResearchInput = {
  query: '',
  depth: 1,
  breadth: 1,
  outputFormat: 'answer'
};

export const mockMinimalResearchInput: ResearchInput = {
  query: 'test query'
};

export const mockLargeResearchInput: ResearchInput = {
  query: 'comprehensive research on tech leadership across multiple cities and industries',
  depth: 5,
  breadth: 10,
  outputFormat: 'contacts_db',
  contactHierarchy: ['CEO', 'CTO', 'VP', 'Director', 'Manager'],
  auditingCriteria: {
    sampleSize: 20,
    verificationDepth: 3
  }
};

// Mock file system operations
export const mockFileOperations = {
  'RESEARCH_INPUT.json': JSON.stringify(mockResearchInput, null, 2),
  'RESEARCH_INPUT_TEST.json': JSON.stringify(mockMinimalResearchInput, null, 2),
  'test/mock-output.json': JSON.stringify(mockContacts, null, 2),
  'contacts.json': JSON.stringify(mockContacts, null, 2),
  'corrections.json': JSON.stringify(mockCorrections, null, 2),
  'report.md': '# Test Report\n\nThis is a test report.',
  'answer.md': 'Test answer'
};
