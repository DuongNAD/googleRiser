/**
 * SME AutoPilot — Backend REST & SSE API Test Runner
 * backend/tests/api/run_api_tests.ts
 */

import { runApiRoutesTests } from './api_routes.test';

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  SME AutoPilot — Milestone 3: Backend REST & SSE Engine Test Runner');
  console.log('  #BuildwithGoogleAI AI Riser Vietnam 2026 Challenge');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  const results = await runApiRoutesTests();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('📦 SUITE: Backend Express REST & SSE Integration Suite');
  console.log('-'.repeat(80));

  for (const res of results) {
    if (res.passed) {
      console.log(`  ✅ [PASS] ${res.name} (${res.durationMs}ms)`);
    } else {
      console.log(`  ❌ [FAIL] ${res.name} (${res.durationMs}ms)`);
      console.log(`     Error: ${res.error}`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log('  MILESTONE 3 BACKEND API TEST SUMMARY:');
  console.log(`  Total Test Cases: ${total}`);
  console.log(`  Passed:           ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Execution Time:   ${durationMs}ms`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    console.error(`❌ Backend API test runner failed with ${failed} failing tests.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL BACKEND REST & SSE API INTEGRATION TESTS PASSED WITH 100% SUCCESS RATE!\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error in API test runner:', err);
    process.exit(1);
  });
}
