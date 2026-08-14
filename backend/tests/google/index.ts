/**
 * SME AutoPilot — Milestone 2 Google Tests Master Entry Point
 * backend/tests/google/index.ts
 */

import './factory.test';
import './sheets.test';
import './gmail.test';
import './calendar.test';
import './maps.test';
import './firestore.test';
import './seed.test';
import './challenger_m2_adversarial.test';
import { runAllRegisteredSuites, TestSuiteResult } from '../../../tests/harness';

export async function runAllGoogleTests(): Promise<TestSuiteResult[]> {
  return runAllRegisteredSuites();
}
