import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PASSPORT_DIR = path.resolve(__dirname, "../truth-passport");

interface ValidationIssue {
  file: string;
  severity: "error" | "warning";
  message: string;
}

const issues: ValidationIssue[] = [];
let filesChecked = 0;

function addIssue(file: string, severity: "error" | "warning", message: string) {
  issues.push({ file, severity, message });
}

const REQUIRED_TP_FIELDS = [
  "object_id",
  "object_type",
  "title",
  "current_answer_ceiling",
  "ceiling_calculation",
  "weakest_link",
  "vehicle_scope",
  "capability_scope",
  "decision_refs",
  "safety_status",
  "evidence_status",
  "implementation_status",
  "release_readiness",
  "privacy_status",
  "source_snapshot_state",
  "confidence",
  "risk_level",
  "completeness",
  "known",
  "unknown",
  "not_proven",
  "allowed_next_steps",
  "forbidden_shortcuts",
  "required_artifacts_to_upgrade",
  "related_sources",
  "related_gaps",
  "last_reviewed",
  "review_due",
];

function checkPassportFile(filePath: string) {
  const rel = path.relative(PASSPORT_DIR, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const doc = yaml.load(raw);
    if (!doc || typeof doc !== "object") {
      addIssue(rel, "error", "YAML document is empty or not an object");
      return;
    }
    const keys = Object.keys(doc);
    if (keys.length === 0) {
      addIssue(rel, "error", "YAML document has no top-level keys");
      return;
    }
    const topKey = keys[0];
    if (topKey !== "truth_passport") {
      addIssue(rel, "error", `Top-level key is '${topKey}'; expected 'truth_passport'`);
      return;
    }
    const tp = doc[topKey] as Record<string, unknown>;
    for (const field of REQUIRED_TP_FIELDS) {
      if (!(field in tp)) {
        addIssue(rel, "error", `Missing required field: ${field}`);
      }
    }
    const objectType = tp.object_type;
    if (objectType !== "TRUTH_PASSPORT") {
      addIssue(rel, "error", `object_type is '${objectType}'; expected 'TRUTH_PASSPORT'`);
    }
    const ceiling = tp.current_answer_ceiling;
    if (typeof ceiling !== "string" || ceiling.length === 0) {
      addIssue(rel, "error", "current_answer_ceiling must be a non-empty string");
    }
    const weakestLink = tp.weakest_link;
    if (typeof weakestLink !== "string" || weakestLink.length === 0) {
      addIssue(rel, "error", "weakest_link must be a non-empty string");
    }
    const confidence = tp.confidence;
    const validConfidence = ["HIGH", "MEDIUM-HIGH", "MEDIUM", "MEDIUM-LOW", "LOW"];
    if (typeof confidence !== "string" || !validConfidence.includes(confidence)) {
      addIssue(rel, "warning", `confidence '${confidence}' not in enum [HIGH, MEDIUM-HIGH, MEDIUM, MEDIUM-LOW, LOW]`);
    }
    const completeness = tp.completeness;
    if (typeof completeness !== "number" || completeness < 0 || completeness > 1) {
      addIssue(rel, "warning", `completeness ${completeness} is not a number between 0 and 1`);
    }
    const known = tp.known;
    if (!Array.isArray(known) || known.length === 0) {
      addIssue(rel, "warning", "known is empty or not an array");
    }
    const unknown = tp.unknown;
    if (!Array.isArray(unknown)) {
      addIssue(rel, "warning", "unknown is not an array");
    }
    const notProven = tp.not_proven;
    if (!Array.isArray(notProven)) {
      addIssue(rel, "warning", "not_proven is not an array");
    }
    const forbidden = tp.forbidden_shortcuts;
    if (!Array.isArray(forbidden) || forbidden.length === 0) {
      addIssue(rel, "warning", "forbidden_shortcuts is empty or not an array");
    }
    const relatedGaps = tp.related_gaps;
    if (!Array.isArray(relatedGaps) || relatedGaps.length === 0) {
      addIssue(rel, "warning", "related_gaps is empty or not an array");
    }
    filesChecked++;
  } catch (err) {
    addIssue(rel, "error", `Failed to parse YAML: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (!fs.existsSync(PASSPORT_DIR)) {
  process.stderr.write("truth-passport/ directory not found\n");
  process.exit(1);
}

for (const entry of fs.readdirSync(PASSPORT_DIR, { withFileTypes: true })) {
  if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
    checkPassportFile(path.join(PASSPORT_DIR, entry.name));
  }
}

const errorCount = issues.filter((i) => i.severity === "error").length;
const warningCount = issues.filter((i) => i.severity === "warning").length;

process.stderr.write(`\n=== validate-truth-passports ===\n`);
process.stderr.write(`files checked: ${filesChecked}\n`);
process.stderr.write(`errors: ${errorCount}\n`);
process.stderr.write(`warnings: ${warningCount}\n`);

for (const issue of issues) {
  const prefix = issue.severity === "error" ? "ERROR" : "WARN";
  process.stderr.write(`  [${prefix}] ${issue.file}: ${issue.message}\n`);
}

if (errorCount > 0) {
  process.stderr.write(`FAIL: ${errorCount} error(s)\n`);
  process.exit(1);
}
process.stderr.write(`PASS: all truth passports validated\n`);
process.exit(0);
