import path from 'path';
import fs from 'fs';
import { runAllRegisteredSuites, resetRegistry } from './harness';

async function runStressTest(iterations: number) {
  console.log(`\n================================================================================`);
  console.log(`  🔥 EMPIRICAL CHALLENGER STRESS HARNESS: ${iterations} ITERATIONS`);
  console.log(`================================================================================\n`);

  const tiers = ['tier1_features', 'tier2_boundaries', 'tier3_combinations', 'tier4_scenarios'];
  const startTime = Date.now();
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  for (let iter = 1; iter <= iterations; iter++) {
    const iterStart = Date.now();
    let iterTotal = 0;
    let iterPassed = 0;
    let iterFailed = 0;

    for (const tDir of tiers) {
      const fullDir = path.join(__dirname, tDir);
      if (!fs.existsSync(fullDir)) continue;

      const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort();

      for (const file of files) {
        resetRegistry();
        const fPath = path.join(fullDir, file);
        delete require.cache[require.resolve(fPath)];
        require(fPath);

        const suites = await runAllRegisteredSuites();
        for (const s of suites) {
          iterTotal += s.total;
          iterPassed += s.passed;
          iterFailed += s.failed;
        }
        resetRegistry();
      }
    }

    const iterDuration = Date.now() - iterStart;
    grandTotal += iterTotal;
    grandPassed += iterPassed;
    grandFailed += iterFailed;

    const icon = iterFailed === 0 ? '✅' : '❌';
    console.log(`${icon} Iteration ${String(iter).padStart(2, '0')}/${iterations}: ${iterPassed}/${iterTotal} test cases passed (${iterDuration}ms)`);

    if (iterFailed > 0) {
      console.error(`💥 Flakiness detected at iteration ${iter}! Failed: ${iterFailed}`);
      process.exit(1);
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log('\n================================================================================');
  console.log(`  🎉 STRESS TEST VERDICT: DETERMINISTIC & ZERO FLAKINESS`);
  console.log(`  Total Invocations: ${grandTotal} test cases across ${iterations} iterations`);
  console.log(`  Pass Rate:         100.0% (${grandPassed}/${grandTotal})`);
  console.log(`  Execution Time:    ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('================================================================================\n');
}

runStressTest(10).catch(err => {
  console.error('Fatal stress harness error:', err);
  process.exit(1);
});
