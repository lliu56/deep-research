import * as fs from 'fs/promises';
import * as path from 'path';

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
      await fs.rm(dir, { recursive: true, force: true });
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
      if (content.length === 0) {
        throw new Error(`Expected output file ${file} is empty`);
      }
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