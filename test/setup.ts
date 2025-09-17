// Global test setup
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.OPENAI_KEY = 'test-openai-key';
process.env.FIRECRAWL_KEY = 'test-firecrawl-key';
process.env.FIREWORKS_KEY = 'test-fireworks-key';

// Global mocks for external dependencies
vi.mock('@mendable/firecrawl-js');
vi.mock('@ai-sdk/openai');
vi.mock('@ai-sdk/fireworks');

// Cleanup function to run after each test
afterEach(() => {
  // Clean up any generated files
  vi.clearAllMocks();
});