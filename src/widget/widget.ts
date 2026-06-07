/**
 * Widget: Anotator8 Project Summary Panel
 *
 * A read-only display widget for ChatGPT Apps.
 * Renders structured tool results passed via postMessage from the MCP Apps bridge.
 *
 * This widget is NOT a mini editor — it's a review/control panel.
 * It can display project summaries, warnings, and annotation counts,
 * but cannot edit or mutate project data.
 *
 * Usage:
 * 1. ChatGPT calls an MCP tool (e.g., inspect_project)
 * 2. MCP server returns structuredContent in the tool response
 * 3. ChatGPT bridge posts the result to this widget via window.parent.postMessage
 * 4. Widget renders the data (read-only, no edits)
 *
 * Security notes:
 * - No external resource loading (CSP blocks connect/resource domains)
 * - All text escaped via textContent (no innerHTML with user data)
 * - Only accepts messages from window.parent (ChatGPT iframe)
 * - No user interaction that would mutate project data
 */

/**
 * Widget application state
 */
interface WidgetState {
  projectLoaded: boolean;
  structuredContent: Record<string, unknown> | null;
  warnings: IntegrationWarning[];
}

interface IntegrationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

const state: WidgetState = {
  projectLoaded: false,
  structuredContent: null,
  warnings: [],
};

/**
 * Escape text to prevent XSS — data always goes through textContent
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Update the widget DOM from current state
 */
function renderWidget(): void {
  const statusEl = document.querySelector<HTMLElement>('.status');
  const statsEl = document.getElementById('stats');
  const warningsEl = document.getElementById('warnings');

  if (!statusEl || !statsEl || !warningsEl) return;

  if (!state.projectLoaded || !state.structuredContent) {
    statusEl.textContent = 'Waiting for project data…';
    statsEl.innerHTML = '';
    warningsEl.innerHTML = '';
    return;
  }

  statusEl.textContent = 'Project loaded';
  const data = state.structuredContent;

  // Render stats
  statsEl.innerHTML = '';
  if (data.stats) {
    const statEntries: [string, string][] = [
      ['totalAnnotations', 'Total annotations'],
      ['subtitleCueCount', 'Subtitle cues'],
      ['hasTemporalData', 'Has temporal data'],
      ['hasVisualExtensions', 'Has visual extensions'],
    ];

    for (const [key, label] of statEntries) {
      const val = (data.stats as Record<string, unknown>)[key];
      if (val === undefined) continue;

      const row = document.createElement('div');
      row.className = 'stats-item';

      const keySpan = document.createElement('span');
      keySpan.className = 'stats-key';
      keySpan.textContent = label;

      const valSpan = document.createElement('span');
      valSpan.className = 'stats-val';
      valSpan.textContent = String(val);

      row.appendChild(keySpan);
      row.appendChild(valSpan);
      statsEl.appendChild(row);
    }
  }

  // Render warnings
  warningsEl.innerHTML = '';
  const allWarnings: IntegrationWarning[] = [
    ...(state.warnings || []),
    ...((data as Record<string, unknown>).source as Record<string, unknown> | undefined)?.warnings as IntegrationWarning[] | undefined ?? [],
    ...((data as Record<string, unknown>).warnings as IntegrationWarning[] | undefined ?? []),
  ];

  for (const w of allWarnings) {
    const div = document.createElement('div');
    div.className = `warning ${w.severity || 'info'}`;
    div.textContent = `[${w.code || ''}] ${w.message || ''}`;
    warningsEl.appendChild(div);
  }
}

/**
 * Handle incoming postMessage from ChatGPT MCP Apps bridge
 */
function handleMessage(event: MessageEvent): void {
  // Only accept from parent iframe (ChatGPT)
  if (event.source !== window.parent) return;

  const { method, params } = event.data || {};
  if (method !== 'ui/notifications/tool-result') return;

  state.projectLoaded = true;
  state.structuredContent = (params || {}).structuredContent || null;
  state.warnings = ((params || {})._meta || {}).warnings || [];
  renderWidget();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('message', handleMessage, { passive: true });
  renderWidget();
});

export { state, renderWidget, handleMessage };
