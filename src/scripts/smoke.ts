/**
 * Smoke test for Anotator8 ChatGPT Integration Lab
 * Verifies server starts and basic functionality works
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Anotator8Adapter } from '../server/anotator8-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '..', '..', 'fixtures', 'sample-project.anatator8.json');

async function main() {
  console.log('=== Anotator8 ChatGPT Integration Lab - Smoke Test ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Load fixture
  console.log('[1/6] Loading fixture project...');
  try {
    const fixtureContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const projectData = JSON.parse(fixtureContent);
    console.log('  ✓ Fixture loaded successfully');
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to load fixture: ${e}`);
    failed++;
    process.exit(1);
  }

  // Test 2: Parse project
  console.log('\n[2/6] Parsing project data...');
  try {
    const adapter = new Anotator8Adapter();
    const normalized = adapter.normalize(JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')));
    console.log(`  ✓ Project parsed: ${normalized.stats.totalAnnotations} annotations`);
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to parse project: ${e}`);
    failed++;
  }

  // Test 3: Validate project
  console.log('\n[3/6] Validating project...');
  try {
    const adapter = new Anotator8Adapter();
    const validation = adapter.validate(JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')));
    console.log(`  ✓ Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
    if (validation.errors.length > 0) {
      console.log(`    Errors: ${validation.errors.length}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`    Warnings: ${validation.warnings.length}`);
    }
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to validate: ${e}`);
    failed++;
  }

  // Test 4: Check annotation types
  console.log('\n[4/6] Checking annotation types...');
  try {
    const adapter = new Anotator8Adapter();
    const normalized = adapter.normalize(JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')));
    const types = (Object.entries(normalized.stats.annotationTypes) as [string, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    console.log(`  ✓ Annotation types found: ${types || 'none'}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to check types: ${e}`);
    failed++;
  }

  // Test 5: Check subtitle tracks
  console.log('\n[5/6] Checking subtitle tracks...');
  try {
    const adapter = new Anotator8Adapter();
    const normalized = adapter.normalize(JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')));
    console.log(`  ✓ Subtitle tracks: ${normalized.subtitleTracks.length}`);
    console.log(`  ✓ Subtitle cues: ${normalized.stats.subtitleCueCount}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to check subtitles: ${e}`);
    failed++;
  }

  // Test 6: Server module loads
  console.log('\n[6/6] Testing server module...');
  try {
    const { createServer } = await import('../server/index.js');
    const server = createServer();
    console.log('  ✓ Server created successfully');
    passed++;
  } catch (e) {
    console.log(`  ✗ Failed to create server: ${e}`);
    failed++;
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log('\n❌ Smoke test FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests PASSED');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Smoke test error:', e);
  process.exit(1);
});
