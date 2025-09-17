import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModel, trimPrompt } from '../../src/ai/providers';
import { mockCreateOpenAI } from '../mocks/openai.mock';

// Mock external dependencies
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI
}));

vi.mock('@ai-sdk/fireworks', () => ({
  createFireworks: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({
      modelId: 'deepseek-r1'
    })
  )
}));

vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn().mockReturnValue({
    modelId: 'deepseek-r1-wrapped'
  }),
  extractReasoningMiddleware: vi.fn()
}));

vi.mock('js-tiktoken', () => ({
  getEncoding: vi.fn().mockReturnValue({
    encode: vi.fn().mockImplementation((text: string) => 
      new Array(Math.ceil(text.length / 4)) // Rough approximation: 4 chars per token
    )
  })
}));

describe('AI Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.CUSTOM_MODEL;
    delete process.env.FIREWORKS_KEY;
    process.env.OPENAI_KEY = 'test-key';
  });

  describe('getModel', () => {
    it('should return default model when no config provided', () => {
      const model = getModel();
      expect(model).toBeDefined();
      expect(model.modelId).toBeDefined();
    });

    it('should handle different model variants', () => {
      const variants = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'] as const;
      
      variants.forEach(variant => {
        const model = getModel({
          variant,
          reasoning: { effort: 'medium' },
          text: { verbosity: 'medium' }
        });
        
        expect(model).toBeDefined();
      });
    });

    it('should use custom model when CUSTOM_MODEL is set', () => {
      process.env.CUSTOM_MODEL = 'custom-model-id';
      
      const model = getModel();
      expect(model).toBeDefined();
    });

    it('should prefer Fireworks R1 when available', () => {
      process.env.FIREWORKS_KEY = 'test-fireworks-key';
      
      const model = getModel();
      expect(model).toBeDefined();
    });

    it('should throw error when no API key provided', () => {
      delete process.env.OPENAI_KEY;
      delete process.env.FIREWORKS_KEY;
      delete process.env.CUSTOM_MODEL;
      
      expect(() => getModel()).toThrow('No model found');
    });

    it('should handle model configuration parameters', () => {
      const modelConfig = {
        variant: 'gpt-5-mini' as const,
        reasoning: { effort: 'high' as const },
        text: { verbosity: 'low' as const }
      };
      
      const model = getModel(modelConfig);
      expect(model).toBeDefined();
    });
  });

  describe('trimPrompt', () => {
    it('should return original prompt if within context size', () => {
      const prompt = 'Short prompt';
      const result = trimPrompt(prompt, 1000);
      
      expect(result).toBe(prompt);
    });

    it('should trim prompt if exceeds context size', () => {
      const longPrompt = 'a'.repeat(1000);
      const result = trimPrompt(longPrompt, 100); // Much smaller context
      
      expect(result.length).toBeLessThan(longPrompt.length);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty prompt', () => {
      const result = trimPrompt('', 1000);
      expect(result).toBe('');
    });

    it('should handle very small context size', () => {
      const prompt = 'This is a test prompt that is longer than the minimum chunk size';
      const result = trimPrompt(prompt, 10);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(prompt.length);
    });

    it('should use default context size when not specified', () => {
      const prompt = 'Test prompt';
      const result = trimPrompt(prompt);
      
      expect(result).toBe(prompt); // Should fit in default 128k context
    });

    it('should handle recursive trimming correctly', () => {
      // Create a prompt that's way too long
      const veryLongPrompt = 'word '.repeat(50000); // ~250k characters
      const result = trimPrompt(veryLongPrompt, 1000);
      
      expect(result.length).toBeLessThan(veryLongPrompt.length);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should preserve text structure when trimming', () => {
      const structuredPrompt = `
        This is a structured prompt.
        
        Section 1: Important information
        Section 2: More details
        Section 3: Final thoughts
      `.repeat(100);
      
      const result = trimPrompt(structuredPrompt, 500);
      
      expect(result.length).toBeLessThan(structuredPrompt.length);
      expect(result.trim()).toBeTruthy();
    });

    it('should handle minimum chunk size constraint', () => {
      const prompt = 'Test prompt for minimum chunk size';
      const result = trimPrompt(prompt, 1); // Impossibly small context
      
      // Should return at least the minimum chunk size (140 chars)
      expect(result.length).toBeGreaterThanOrEqual(Math.min(140, prompt.length));
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed model configuration', () => {
      const badConfig = {
        variant: 'invalid-model' as any,
        reasoning: { effort: 'invalid' as any }
      };
      
      // Should not throw, should fallback gracefully
      expect(() => getModel(badConfig)).not.toThrow();
    });

    it('should handle undefined model configuration', () => {
      expect(() => getModel(undefined)).not.toThrow();
    });

    it('should handle null values in configuration', () => {
      const configWithNulls = {
        variant: null as any,
        reasoning: null as any,
        text: null as any
      };
      
      expect(() => getModel(configWithNulls)).not.toThrow();
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing OPENAI_KEY gracefully when other options available', () => {
      delete process.env.OPENAI_KEY;
      process.env.FIREWORKS_KEY = 'test-key';
      
      expect(() => getModel()).not.toThrow();
    });

    it('should handle custom endpoints', () => {
      process.env.OPENAI_ENDPOINT = 'https://custom-endpoint.com/v1';
      
      const model = getModel();
      expect(model).toBeDefined();
    });

    it('should respect context size environment variable', () => {
      process.env.CONTEXT_SIZE = '50000';
      
      const longPrompt = 'a'.repeat(60000);
      const result = trimPrompt(longPrompt);
      
      expect(result.length).toBeLessThan(longPrompt.length);
    });
  });
});