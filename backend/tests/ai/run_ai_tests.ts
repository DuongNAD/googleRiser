/**
 * Milestone 1 AI Engine — Master Test Runner
 * backend/tests/ai/run_ai_tests.ts
 *
 * Runs all Milestone 1 AI test suites and formats metrics for CI/CD and Auditor.
 */

import { runGeminiClientTests } from './geminiClient.test';
import { runBillForensicsTests } from './billForensics.test';
import { runProductStudioTests } from './productStudio.test';
import { runToolsTests } from './tools.test';
import { runVoiceAssistantTests } from './voiceAssistant.test';
import { runAdversarialTests } from './challenger_m1_adversarial.test';
import { runAdversarialTests as runStudioVoiceToolsAdversarialTests } from './adversarial_studio_voice_tools.test';

interface SuiteSummary {
  name: string;
  total: number;
  passed: number;
  failed: number;
  results: { name: string; passed: boolean; error?: string }[];
}

async function runAllAiTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  SME AutoPilot — Milestone 1: Core Multimodal AI Engine Test Runner');
  console.log('  #BuildwithGoogleAI AI Riser Vietnam 2026 Challenge');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  const suites: SuiteSummary[] = [];

  // 1. Gemini Client Suite
  const geminiResults = runGeminiClientTests();
  suites.push({
    name: 'Gemini 2.0 Multimodal Client Suite',
    total: geminiResults.length,
    passed: geminiResults.filter(r => r.passed).length,
    failed: geminiResults.filter(r => !r.passed).length,
    results: geminiResults
  });

  // 2. Bill Forensics Suite
  const billResults = runBillForensicsTests();
  suites.push({
    name: 'VietQR & 25+ Bank Transfer Forensics Suite',
    total: billResults.length,
    passed: billResults.filter(r => r.passed).length,
    failed: billResults.filter(r => !r.passed).length,
    results: billResults
  });

  // 3. Product Studio Suite
  const studioResults = await runProductStudioTests();
  suites.push({
    name: 'Product Studio & Multi-Channel Copywriting Suite',
    total: studioResults.length,
    passed: studioResults.filter(r => r.passed).length,
    failed: studioResults.filter(r => !r.passed).length,
    results: studioResults
  });

  // 4. Function Calling Tools Suite
  const toolsResults = await runToolsTests();
  suites.push({
    name: 'Gemini 2.0 Function Calling Tools Suite',
    total: toolsResults.length,
    passed: toolsResults.filter(r => r.passed).length,
    failed: toolsResults.filter(r => !r.passed).length,
    results: toolsResults
  });

  // 5. Voice Assistant Suite
  const voiceResults = await runVoiceAssistantTests();
  suites.push({
    name: 'Vietnamese Multi-Dialect Voice Assistant Suite',
    total: voiceResults.length,
    passed: voiceResults.filter(r => r.passed).length,
    failed: voiceResults.filter(r => !r.passed).length,
    results: voiceResults
  });

  // 6. Challenger Adversarial & Tampering Stress Suite (Bill Forensics & VietQR)
  const advResults = runAdversarialTests();
  suites.push({
    name: 'Challenger Adversarial & Tampering Stress Suite (M1-1: Forensics & VietQR)',
    total: advResults.length,
    passed: advResults.filter(r => r.passed).length,
    failed: advResults.filter(r => !r.passed).length,
    results: advResults
  });

  // 7. Challenger Adversarial Suite (Product Studio, Voice Assistant, Tools)
  const studioVoiceToolsAdvResults = await runStudioVoiceToolsAdversarialTests();
  suites.push({
    name: 'Challenger Adversarial & Stress Suite (M1-2: Product Studio, Voice, Tools)',
    total: studioVoiceToolsAdvResults.length,
    passed: studioVoiceToolsAdvResults.filter(r => r.passed).length,
    failed: studioVoiceToolsAdvResults.filter(r => !r.passed).length,
    results: studioVoiceToolsAdvResults
  });

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n📦 SUITE: ${suite.name}`);
    console.log('-'.repeat(80));

    for (const res of suite.results) {
      if (res.passed) {
        console.log(`  ✅ [PASS] ${res.name}`);
      } else {
        console.log(`  ❌ [FAIL] ${res.name}`);
        console.log(`     Error: ${res.error}`);
      }
    }

    totalTests += suite.total;
    totalPassed += suite.passed;
    totalFailed += suite.failed;
  }

  const durationMs = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log('  MILESTONE 1 AI TEST SUMMARY:');
  console.log(`  Total Test Cases: ${totalTests}`);
  console.log(`  Passed:           ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Failed:           ${totalFailed}`);
  console.log(`  Execution Time:   ${durationMs}ms`);
  console.log('='.repeat(80) + '\n');

  if (totalFailed > 0) {
    console.error(`❌ Milestone 1 test runner failed with ${totalFailed} failing tests.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL MILESTONE 1 MULTIMODAL AI TESTS PASSED WITH 100% SUCCESS RATE!\n');
    process.exit(0);
  }
}

runAllAiTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
