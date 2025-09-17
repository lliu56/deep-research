#!/usr/bin/env tsx

import { execSync } from 'child_process';

// Import cleanup utilities from clean utility file
import { cleanupTestArtifacts, verifyCleanTestEnvironment } from './utils/cleanup';

async function runAllTests() {
  console.log('🧪 Starting Deep Research Test Suite\n');

  try {
    // Verify clean environment before starting
    console.log('🧹 Verifying clean test environment...');
    await verifyCleanTestEnvironment();
    console.log('✅ Test environment is clean\n');

    // Run unit tests
    console.log('🔬 Running Unit Tests...');
    execSync('npx vitest run test/unit --reporter=verbose', { stdio: 'inherit' });
    console.log('✅ Unit tests completed\n');

    // Clean up after unit tests
    await cleanupTestArtifacts();

    // Run integration tests
    console.log('🔗 Running Integration Tests...');
    execSync('npx vitest run test/integration --reporter=verbose', { stdio: 'inherit' });
    console.log('✅ Integration tests completed\n');

    // Clean up after integration tests
    await cleanupTestArtifacts();

    // Run end-to-end tests
    console.log('🎯 Running End-to-End Tests...');
    execSync('npx vitest run test/e2e --reporter=verbose', { stdio: 'inherit' });
    console.log('✅ End-to-end tests completed\n');

    // Clean up after e2e tests
    await cleanupTestArtifacts();

    // Run error case tests
    console.log('⚠️  Running Error Case Tests...');
    execSync('npx vitest run test/error-cases --reporter=verbose', { stdio: 'inherit' });
    console.log('✅ Error case tests completed\n');

    // Final cleanup
    console.log('🧹 Performing final cleanup...');
    await cleanupTestArtifacts();
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    
    // Attempt cleanup even on failure
    try {
      await cleanupTestArtifacts();
      console.log('🧹 Cleanup completed after failure');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Run with coverage
async function runTestsWithCoverage() {
  console.log('📊 Running tests with coverage analysis...\n');

  try {
    // Clean environment
    await verifyCleanTestEnvironment();

    // Run all tests with coverage
    execSync('npx vitest run --coverage --reporter=verbose', { stdio: 'inherit' });
    
    console.log('\n📈 Coverage report generated!');
    console.log('View coverage report: open coverage/index.html\n');

    // Cleanup
    await cleanupTestArtifacts();

  } catch (error) {
    console.error('❌ Coverage tests failed:', error);
    await cleanupTestArtifacts();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'coverage':
    runTestsWithCoverage();
    break;
  case 'unit':
    console.log('🔬 Running Unit Tests Only...');
    execSync('npx vitest run test/unit --reporter=verbose', { stdio: 'inherit' });
    cleanupTestArtifacts();
    break;
  case 'integration':
    console.log('🔗 Running Integration Tests Only...');
    execSync('npx vitest run test/integration --reporter=verbose', { stdio: 'inherit' });
    cleanupTestArtifacts();
    break;
  case 'e2e':
    console.log('🎯 Running E2E Tests Only...');
    execSync('npx vitest run test/e2e --reporter=verbose', { stdio: 'inherit' });
    cleanupTestArtifacts();
    break;
  case 'errors':
    console.log('⚠️  Running Error Case Tests Only...');
    execSync('npx vitest run test/error-cases --reporter=verbose', { stdio: 'inherit' });
    cleanupTestArtifacts();
    break;
  case 'clean':
    console.log('🧹 Cleaning up test artifacts...');
    cleanupTestArtifacts().then(() => {
      console.log('✅ Cleanup completed');
    });
    break;
  default:
    runAllTests();
}