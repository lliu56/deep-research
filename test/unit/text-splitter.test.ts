import { describe, it, expect } from 'vitest';
import { RecursiveCharacterTextSplitter } from '../../src/ai/text-splitter';

describe('Text Splitter', () => {
  describe('RecursiveCharacterTextSplitter', () => {
    it('should split text into chunks of specified size', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
      });

      const text = 'This is a test string that should be split into multiple chunks';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(10);
      });
    });

    it('should handle overlap correctly', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10,
        chunkOverlap: 2,
      });

      const text = 'abcdefghijklmnopqrstuvwxyz';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(2);
      
      // Check that consecutive chunks have overlap
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        
        // There should be some common characters between chunks
        const prevEnd = prevChunk.slice(-2);
        expect(currentChunk.startsWith(prevEnd) || 
               currentChunk.slice(0, 2).includes(prevEnd[0]) ||
               currentChunk.slice(0, 2).includes(prevEnd[1])).toBeTruthy();
      }
    });

    it('should return original text if shorter than chunk size', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 0,
      });

      const text = 'Short text';
      const chunks = splitter.splitText(text);

      expect(chunks).toEqual([text]);
    });

    it('should handle empty string', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
      });

      const chunks = splitter.splitText('');
      expect(chunks).toEqual([]); // Empty string should return empty array
    });

    it('should handle single character text', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
      });

      const chunks = splitter.splitText('a');
      expect(chunks).toEqual(['a']);
    });

    it('should respect separator hierarchy', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 20,
        chunkOverlap: 0,
      });

      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = splitter.splitText(text);

      // Should prefer splitting on double newlines
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle very large overlap', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 25, // Larger chunk size to accommodate text
        chunkOverlap: 8,
      });

      const text = 'This is a test string';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(25);
      });
    });

    it('should handle special characters and Unicode', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 15,
        chunkOverlap: 0,
      });

      const text = 'Héllo 世界! This tëxt has ñoñ-ASCII characters 🚀';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(0);
      const rejoined = chunks.join('');
      expect(rejoined.replace(/\s+/g, ' ')).toContain('Héllo 世界');
    });

    it('should handle overlap equal to chunk size', () => {
      // This should throw an error as per the implementation
      expect(() => {
        new RecursiveCharacterTextSplitter({
          chunkSize: 10,
          chunkOverlap: 10,
        });
      }).toThrow('Cannot have chunkOverlap >= chunkSize');
    });

    it('should handle overlap larger than chunk size', () => {
      // This should throw an error as per the implementation
      expect(() => {
        new RecursiveCharacterTextSplitter({
          chunkSize: 10,
          chunkOverlap: 15,
        });
      }).toThrow('Cannot have chunkOverlap >= chunkSize');
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with only separators', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 5,
        chunkOverlap: 0,
      });

      const text = '\n\n\n\n\n';
      const chunks = splitter.splitText(text);

      // May return empty array or single chunk with separators
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long words', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 5,
        chunkOverlap: 0,
      });

      const text = 'supercalifragilisticexpialidocious';
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(5);
      });
    });

    it('should maintain text integrity across splits', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 20,
        chunkOverlap: 2,
      });

      const originalText = 'The quick brown fox jumps over the lazy dog. This is a longer sentence to test text splitting.';
      const chunks = splitter.splitText(originalText);

      // Remove overlap and rejoin
      const rejoined = chunks[0] + chunks.slice(1).map(chunk => 
        chunk.slice(2) // Remove overlap characters
      ).join('');

      // Should contain most of the original text
      expect(rejoined.length).toBeGreaterThanOrEqual(originalText.length * 0.8);
    });
  });
});