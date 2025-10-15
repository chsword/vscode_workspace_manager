/**
 * Phase 1 Implementation - Testing Entry Point
 * 
 * This file demonstrates the basic infrastructure setup:
 * - Result pattern for error handling
 * - Value objects with validation
 * - Error types
 * - Logging system
 * - Dependency injection
 */

import { Result } from './shared/utils/Result';
import { WorkspaceId, WorkspacePath, WorkspaceName } from './core/domain/value-objects/WorkspaceValueObjects';
import { ValidationError } from './shared/errors';
import { LogLevel } from './infrastructure/logging/ILogger';
import { VSCodeLogger } from './infrastructure/logging/VSCodeLogger';

/**
 * Test the Result pattern
 */
export function testResultPattern(): void {
  console.log('=== Testing Result Pattern ===');

  // Success case
  const successResult = Result.ok('Hello, World!');
  console.log('Success:', successResult.isSuccess); // true
  console.log('Value:', successResult.value); // "Hello, World!"

  // Failure case
  const failureResult = Result.fail(new ValidationError('Something went wrong'));
  console.log('Failure:', failureResult.isFailure); // true
  console.log('Error:', failureResult.error.message); // "Something went wrong"

  // Map and flatMap
  const mapped = successResult.map(v => v.toUpperCase());
  console.log('Mapped:', mapped.value); // "HELLO, WORLD!"

  console.log('✅ Result pattern working!\n');
}

/**
 * Test Value Objects
 */
export function testValueObjects(): void {
  console.log('=== Testing Value Objects ===');

  // Valid workspace ID
  const idResult = WorkspaceId.create('123e4567-e89b-12d3-a456-426614174000');
  if (idResult.isSuccess) {
    console.log('Valid ID:', idResult.value.toString());
  }

  // Invalid workspace ID
  const invalidId = WorkspaceId.create('invalid-id');
  if (invalidId.isFailure) {
    console.log('Invalid ID error:', invalidId.error.message);
  }

  // Valid path
  const pathResult = WorkspacePath.create('/home/user/project');
  if (pathResult.isSuccess) {
    console.log('Valid path:', pathResult.value.toString());
    console.log('Filename:', pathResult.value.getFileName());
  }

  // Valid name
  const nameResult = WorkspaceName.create('My Project');
  if (nameResult.isSuccess) {
    console.log('Valid name:', nameResult.value.toString());
  }

  // Empty name (should fail)
  const emptyName = WorkspaceName.create('');
  if (emptyName.isFailure) {
    console.log('Empty name error:', emptyName.error.message);
  }

  console.log('✅ Value objects working!\n');
}

/**
 * Test Logging System
 */
export function testLoggingSystem(): void {
  console.log('=== Testing Logging System ===');

  const logger = new VSCodeLogger();
  logger.setLevel(LogLevel.DEBUG);

  logger.debug('This is a debug message', { foo: 'bar' });
  logger.info('This is an info message');
  logger.warn('This is a warning message', { userId: 123 });
  logger.error('This is an error message', { error: 'Something broke' });

  console.log('✅ Logging system working! Check VS Code Output panel.\n');

  logger.dispose();
}

/**
 * Run all tests
 */
export function runPhase1Tests(): void {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Phase 1 Infrastructure Tests                ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    testResultPattern();
    testValueObjects();
    testLoggingSystem();

    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ All Phase 1 tests passed!                ║');
    console.log('╚═══════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ Phase 1 tests failed:', error);
  }
}
