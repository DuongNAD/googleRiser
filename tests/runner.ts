import fs from 'fs';
import path from 'path';
import { runAllRegisteredSuites, resetRegistry, TestSuiteResult, TierResult } from './harness';

interface RunnerOptions {
  tierFilter?: string;
  patternFilter?: RegExp;
  verbose?: boolean;
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      options.tierFilter = arg.split('=')[1].trim().toLowerCase();
    } else if (arg.startsWith('--filter=')) {
      options.patternFilter = new RegExp(arg.split('=')[1].trim(), 'i');
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

const TIER_DIRECTORIES: { tier: string; dir: string; label: string }[] = [
  { tier: 'tier1', dir: 'tier1_features', label: 'Tier 1: Feature Coverage (F1–F16)' },
  { tier: 'tier2', dir: 'tier2_boundaries', label: 'Tier 2: Boundary & Corner Cases' },
  { tier: 'tier3', dir: 'tier3_combinations', label: 'Tier 3: Pairwise Combinatorial Integration' },
  { tier: 'tier4', dir: 'tier4_scenarios', label: 'Tier 4: Real-World SME Workload Scenarios' },
  { tier: 'tier5', dir: 'tier5_adversarial', label: 'Tier 5: Adversarial & Stress Hardening' },
  { tier: 'google', dir: path.join('..', 'backend', 'tests', 'google'), label: 'Google Cloud Ecosystem & SPI Services (M2)' }
];

async function runTestSuiteFile(filePath: string): Promise<TestSuiteResult[]> {
  resetRegistry();
  // Require / import test file
  try {
    const resolvedPath = path.resolve(filePath);
    delete require.cache[require.resolve(resolvedPath)];
    require(resolvedPath);
    const results = await runAllRegisteredSuites();
    results.forEach(r => {
      r.filePath = path.relative(process.cwd(), filePath);
    });
    return results;
  } catch (err: any) {
    const fileName = path.basename(filePath);
    return [
      {
        name: `File Execution Error: ${fileName}`,
        filePath: path.relative(process.cwd(), filePath),
        total: 1,
        passed: 0,
        failed: 1,
        durationMs: 0,
        testResults: [
          {
            name: `Load & Execute ${fileName}`,
            passed: false,
            error: err?.stack || err?.message || String(err),
            durationMs: 0
          }
        ]
      }
    ];
  } finally {
    resetRegistry();
  }
}

async function main() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log('\n================================================================================');
  console.log('  🚀 SME AutoPilot Master Test Runner (#BuildwithGoogleAI AI Riser 2026)');
  console.log('================================================================================\n');

  const testsDir = path.resolve(__dirname);
  const tierResults: TierResult[] = [];
  let globalTotal = 0;
  let globalPassed = 0;
  let globalFailed = 0;

  for (const { tier, dir, label } of TIER_DIRECTORIES) {
    if (options.tierFilter && options.tierFilter !== 'all' && !options.tierFilter.includes(tier)) {
      continue;
    }

    const fullDirPath = path.join(testsDir, dir);
    if (!fs.existsSync(fullDirPath)) {
      // Tier directory not created yet - skip gracefully
      continue;
    }

    const files = fs
      .readdirSync(fullDirPath)
      .filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts') && f !== 'index.ts')
      .sort();

    if (files.length === 0) {
      continue;
    }

    console.log(`\n📦 ${label}`);
    console.log('─'.repeat(80));

    const tierStartTime = Date.now();
    const suiteResults: TestSuiteResult[] = [];
    let tierTotal = 0;
    let tierPassed = 0;
    let tierFailed = 0;

    for (const file of files) {
      if (options.patternFilter && !options.patternFilter.test(file)) {
        continue;
      }

      const filePath = path.join(fullDirPath, file);
      const suites = await runTestSuiteFile(filePath);

      for (const suite of suites) {
        suiteResults.push(suite);
        tierTotal += suite.total;
        tierPassed += suite.passed;
        tierFailed += suite.failed;

        const icon = suite.failed === 0 ? '✅' : '❌';
        console.log(`  ${icon} [${path.basename(file)}] ${suite.name} (${suite.passed}/${suite.total} passed, ${suite.durationMs}ms)`);

        for (const tr of suite.testResults) {
          if (!tr.passed || options.verbose) {
            const trIcon = tr.passed ? '    ✓' : '    ✗';
            console.log(`${trIcon} ${tr.name} (${tr.durationMs}ms)`);
            if (tr.error) {
              console.log(`      Error: ${tr.error.split('\n').join('\n      ')}`);
            }
          }
        }
      }
    }

    const tierDuration = Date.now() - tierStartTime;
    tierResults.push({
      tierName: label,
      suites: suiteResults,
      total: tierTotal,
      passed: tierPassed,
      failed: tierFailed,
      durationMs: tierDuration
    });

    globalTotal += tierTotal;
    globalPassed += tierPassed;
    globalFailed += tierFailed;
  }

  const totalDuration = Date.now() - startTime;

  // ==========================================
  // SUMMARY REPORT TABLES
  // ==========================================
  console.log('\n\n================================================================================');
  console.log('                           📊 TEST EXECUTION SUMMARY                            ');
  console.log('================================================================================');

  console.log(
    'Tier / Category'.padEnd(50) +
    'Total'.padStart(8) +
    'Passed'.padStart(8) +
    'Failed'.padStart(8) +
    'Rate'.padStart(8)
  );
  console.log('─'.repeat(82));

  for (const tr of tierResults) {
    const rate = tr.total > 0 ? ((tr.passed / tr.total) * 100).toFixed(1) + '%' : 'N/A';
    console.log(
      tr.tierName.padEnd(50) +
      String(tr.total).padStart(8) +
      String(tr.passed).padStart(8) +
      String(tr.failed).padStart(8) +
      rate.padStart(8)
    );
  }

  console.log('─'.repeat(82));
  const globalRate = globalTotal > 0 ? ((globalPassed / globalTotal) * 100).toFixed(1) + '%' : '0.0%';
  console.log(
    'TOTAL'.padEnd(50) +
    String(globalTotal).padStart(8) +
    String(globalPassed).padStart(8) +
    String(globalFailed).padStart(8) +
    globalRate.padStart(8)
  );
  console.log('================================================================================');
  console.log(`⏱ Total Duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  if (globalFailed > 0 || globalTotal === 0) {
    console.error(`❌ TEST RUN FAILED: ${globalFailed} failed out of ${globalTotal} total test cases.`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL TESTS PASSED! (${globalPassed}/${globalTotal} passed with 100% success rate)`);
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}
