export interface ModelConfig {
  variant?: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning?: {
    effort?: 'minimal' | 'low' | 'medium' | 'high';
  };
  text?: {
    verbosity?: 'low' | 'medium' | 'high';
  };
}

export interface AuditingCriteria {
  sampleSize: number;
  verificationDepth: number;
}

export interface ResearchInput {
  query: string;
  depth?: number;
  breadth?: number;
  modelConfig?: ModelConfig;
  auditingCriteria?: AuditingCriteria;
  outputFormat?: string;
  contactHierarchy?: string[];
}

export interface Contact {
  name: string;
  email: string; // unique
  company: string;
  tags: string[]; // array as per DB schema
  position: string;
  city: string;
  stateProvince: string; // camelCase but maps to state_province in DB
  country: string;
  number?: string;
  timeZone: string; // camelCase but maps to time_zone in DB
  department?: string;
  priority: number;
  signal: string;
  signalLevel: string; // text type in DB, not integer
  compliment: string;
  industry: string;
  links: string; // kept as string (can be comma-separated URLs)
  source: 'deep-research';
}

export interface Correction {
  email: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}
