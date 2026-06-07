import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANONICAL_DIR = path.resolve(__dirname, "../canonical");

interface ValidationIssue {
  file: string;
  severity: "error" | "warning";
  message: string;
}

const issues: ValidationIssue[] = [];
let filesChecked = 0;
let filesSkipped = 0;

function addIssue(file: string, severity: "error" | "warning", message: string) {
  issues.push({ file, severity, message });
}

function checkYamlFile(filePath: string) {
  const rel = path.relative(CANONICAL_DIR, filePath);
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
    if (keys.length > 1) {
      addIssue(rel, "warning", `YAML document has ${keys.length} top-level keys; expected 1 canonical object`);
    }
    const topKey = keys[0];
    const validTopKeys = [
      "active_canonical_index",
      "product_dossier",
      "runtime_record",
      "discovery_lead",
      "source_radar",
      "unknown_unknown",
      "regulatory_record",
      "threat_record",
      "assurance_case_record",
      "official_doc_record",
      "tool_record",
      "decision_record",
    ];
    if (!validTopKeys.includes(topKey)) {
      addIssue(rel, "warning", `Top-level key '${topKey}' not in canonical object enum`);
    }
    filesChecked++;
  } catch (err) {
    addIssue(rel, "error", `Failed to parse YAML: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function walkDir(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      checkYamlFile(fullPath);
    } else {
      filesSkipped++;
    }
  }
}

if (!fs.existsSync(CANONICAL_DIR)) {
  process.stderr.write("canonical/ directory not found\n");
  process.exit(1);
}

walkDir(CANONICAL_DIR);

const errorCount = issues.filter((i) => i.severity === "error").length;
const warningCount = issues.filter((i) => i.severity === "warning").length;

process.stderr.write(`\n=== validate-canonical ===\n`);
process.stderr.write(`files checked: ${filesChecked}\n`);
process.stderr.write(`files skipped (non-YAML): ${filesSkipped}\n`);
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
process.stderr.write(`PASS: all canonical YAML files parsed successfully\n`);
process.exit(0);
