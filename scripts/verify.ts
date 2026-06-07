/**
 * scripts/verify.ts — end-to-end smoke for the lab.
 *
 * Runs build + test + smoke + demo:stdio + verify:dev + validate:canonical +
 * validate:truth-passport in sequence. Exits 0 if all pass, 1 if any fail.
 *
 * `verify:dev` is the headless, non-interactive equivalent of `npm run inspect`
 * (which opens the MCP Inspector UI in a browser). It is included here so CI
 * hosts without a browser still get an inspector-style roundtrip proof.
 *
 * Use this as the "is this thing actually working?" command.
 * `npm run verify`
 */
import { spawnSync } from "node:child_process";

const steps: Array<{ name: string; script: string }> = [
  { name: "build", script: "build" },
  { name: "test", script: "test" },
  { name: "smoke", script: "smoke" },
  { name: "demo:stdio", script: "demo:stdio" },
  { name: "verify:dev", script: "verify:dev" },
  { name: "validate:canonical", script: "validate:canonical" },
  { name: "validate:truth-passport", script: "validate:truth-passport" },
];

let pass = 0;
let fail = 0;
const failed: string[] = [];

for (const step of steps) {
  process.stderr.write(`\n=== [${step.name}] npm run ${step.script} ===\n`);
  const r = spawnSync("npm", ["run", step.script], {
    stdio: "inherit",
    // shell: true works on Windows (cmd via npm), macOS, and Linux
    // (/bin/sh via npm). Required so npm is found on Windows.
    shell: true,
  });
  if (r.status === 0) {
    pass += 1;
    process.stderr.write(`--- [${step.name}] OK ---\n`);
  } else {
    fail += 1;
    failed.push(step.name);
    process.stderr.write(`--- [${step.name}] FAIL (exit ${r.status}) ---\n`);
    // Continue so the user sees the final tally even if a middle
    // step fails (useful for partial diagnostics).
  }
}

process.stderr.write(`\n=== verify summary ===\n`);
process.stderr.write(`passed: ${pass}/${steps.length}\n`);
if (fail > 0) {
  process.stderr.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
process.stderr.write("all checks passed\n");
process.exit(0);
