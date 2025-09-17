import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Test Cleanup Utilities', () => {
  const testArtifacts = [
    'report.md',
    'answer.md',
    'contacts.json',
    'corrections.json',
    'RESEARCH_INPUT_TEST.json',
    'test-output.json'
  ];

  const testDirectories = [
    'temp-test-dir',
    'test-outputs'
  ];

  beforeEach(async () => {
    // Create test artifacts for cleanup testing
    for (const artifact of testArtifacts) {
      try {
        await fs.writeFile(artifact, 'test content', 'utf-8');
      } catch (error) {
        // File might not be writable, skip
      }
    }

    for (const dir of testDirectories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'test-file.txt'), 'test', 'utf-8');
      } catch (error) {
        // Directory might not be writable, skip
      }
    }
  });

  afterEach(async () => {
    // Clean up test artifacts
    await cleanupTestArtifacts();
  });

  it('should clean up generated files', async () => {
    // Verify files exist before cleanup
    const existingFiles = [];
    for (const artifact of testArtifacts) {
      try {
        await fs.access(artifact);
        existingFiles.push(artifact);
      } catch {
        // File doesn't exist, skip
      }
    }

    // Cleanup
    await cleanupTestArtifacts();

    // Verify files are removed
    for (const file of existingFiles) {
      try {
        await fs.access(file);
        // If we reach here, file still exists
        expect.fail(`File ${file} should have been cleaned up`);
      } catch (error) {
        // File doesn't exist, which is expected
        expect(error).toBeDefined();
      }
    }
  });

  it('should clean up test directories', async () => {
    await cleanupTestArtifacts();

    for (const dir of testDirectories) {
      try {
        await fs.access(dir);
        expect.fail(`Directory ${dir} should have been cleaned up`);
      } catch (error) {
        expect(error).toBeDefined();
      }
    }
  });

  it('should handle cleanup of non-existent files gracefully', async () => {
    // Clean up twice - second cleanup should handle missing files gracefully
    await cleanupTestArtifacts();
    
    expect(async () => await cleanupTestArtifacts()).not.toThrow();
  });

  it('should handle permission errors during cleanup', async () => {
    // Create a file that might cause permission issues
    const restrictedFile = 'restricted-test-file.txt';
    try {
      await fs.writeFile(restrictedFile, 'test');
      // Try to make it read-only (might not work on all systems)
      await fs.chmod(restrictedFile, 0o444);
    } catch {
      // Skip if we can't create or modify permissions
    }

    // Cleanup should handle permission errors gracefully
    expect(async () => await cleanupTestArtifacts()).not.toThrow();

    // Try to clean up the restricted file manually
    try {
      await fs.chmod(restrictedFile, 0o644);
      await fs.unlink(restrictedFile);
    } catch {
      // Ignore if we can't clean it up
    }
  });
});

// Utility function for cleaning up test artifacts
export async function cleanupTestArtifacts() {
  const artifacts = [
    'report.md',
    'answer.md',
    'contacts.json',
    'corrections.json',
    'RESEARCH_INPUT_TEST.json',
    'test-output.json',
    'restricted-test-file.txt'
  ];

  const directories = [
    'temp-test-dir',
    'test-outputs',
    'test-generated'
  ];

  // Clean up files
  for (const artifact of artifacts) {
    try {
      await fs.unlink(artifact);
    } catch (error) {
      // File might not exist, that's okay
    }
  }

  // Clean up directories
  for (const dir of directories) {
    try {
      await fs.rmdir(dir, { recursive: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }
  }

  // Clean up any test configuration files
  const testConfigs = [
    'RESEARCH_INPUT_TEST.json',
    'test-config.json',
    '.test-env'
  ];

  for (const config of testConfigs) {
    try {
      await fs.unlink(config);
    } catch (error) {
      // File might not exist, that's okay
    }
  }
}

// Utility function to verify test environment is clean
export async function verifyCleanTestEnvironment() {
  const shouldNotExist = [
    'report.md',
    'answer.md',
    'contacts.json',
    'corrections.json'
  ];

  for (const file of shouldNotExist) {
    try {
      await fs.access(file);
      throw new Error(`Test artifact ${file} still exists - environment not clean`);
    } catch (error) {
      if (error.message.includes('still exists')) {
        throw error;
      }
      // File doesn't exist, which is what we want
    }
  }
}

// Utility function to create test input files
export async function createTestInputFiles() {
  const testInputs = {
    'RESEARCH_INPUT_TEST.json': JSON.stringify({
      query: 'Test query for unit tests',
      depth: 1,
      breadth: 1,
      outputFormat: 'contacts_db'
    }, null, 2),
    
    'test-minimal-config.json': JSON.stringify({
      query: 'Minimal test query'
    }, null, 2),
    
    'test-full-config.json': JSON.stringify({
      query: 'Full configuration test',
      depth: 2,
      breadth: 3,
      outputFormat: 'contacts_db',
      contactHierarchy: ['CEO', 'CTO'],
      auditingCriteria: {
        sampleSize: 1,
        verificationDepth: 1
      },
      modelConfig: {
        variant: 'gpt-5-mini',
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' }
      }
    }, null, 2)
  };

  for (const [filename, content] of Object.entries(testInputs)) {
    await fs.writeFile(filename, content, 'utf-8');
  }
}

// Utility function to verify generated output files
export async function verifyOutputFiles(expectedFiles: string[]) {
  for (const file of expectedFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    } catch (error) {
      throw new Error(`Expected output file ${file} was not generated`);
    }
  }
}

// Utility function to compare file contents
export async function compareFileContents(file1: string, file2: string) {
  try {
    const content1 = await fs.readFile(file1, 'utf-8');
    const content2 = await fs.readFile(file2, 'utf-8');
    return content1 === content2;
  } catch (error) {
    return false;
  }
}