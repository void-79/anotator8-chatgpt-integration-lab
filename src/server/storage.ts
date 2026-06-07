import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectInput } from "../shared/types.js";
import { IntegrationError } from "./errors.js";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const fixturePaths = {
  "sample-project": resolve(root, "fixtures", "sample-project.anotator8.json"),
} as const;

export async function loadProjectInput(input: ProjectInput): Promise<unknown> {
  if ("projectData" in input && input.projectData !== undefined) return input.projectData;
  if ("fixtureId" in input && input.fixtureId) {
    const path = fixturePaths[input.fixtureId];
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as unknown;
  }
  throw new IntegrationError("missing_field", "Provide projectData or fixtureId.", "projectData");
}

export function listFixtureIds(): string[] {
  return Object.keys(fixturePaths);
}
