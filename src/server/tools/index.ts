import { createReviewPlanTool } from "./create-review-plan.js";
import { exportChatgptReportTool } from "./export-chatgpt-report.js";
import { findAnnotationsTool } from "./find-annotations.js";
import { inspectProjectTool } from "./inspect-project.js";
import { listCapabilitiesTool } from "./list-capabilities.js";
import { suggestLabelsTool } from "./suggest-labels.js";
import { summarizeAnnotationsTool } from "./summarize-annotations.js";
import { validateProjectTool } from "./validate-project.js";
import { wrapTool, type ToolModule } from "./tool-types.js";

export const toolRegistry: ToolModule[] = [
  listCapabilitiesTool,
  inspectProjectTool,
  validateProjectTool,
  summarizeAnnotationsTool,
  findAnnotationsTool,
  suggestLabelsTool,
  createReviewPlanTool,
  exportChatgptReportTool,
].map(wrapTool);
