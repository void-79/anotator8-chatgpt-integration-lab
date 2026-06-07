/**
 * Widget Resource for Anotator8 ChatGPT App
 * Provides an interactive HTML panel in ChatGPT to display project summaries.
 *
 * Communication: ChatGPT injects tool results via postMessage.
 * The widget renders structuredContent from tool responses without any
 * user interaction (read-only display panel).
 *
 * Security:
 * - Only accepts messages from parent iframe (window.parent)
 * - All user data is escaped before DOM insertion (textContent, not innerHTML)
 * - No external resource loading
 */

export const WIDGET_HTML = `
<div id="anotator8-root">
  <div class="header">
    <h2>Anotator8 Project Review</h2>
    <p class="status">Waiting for project data&hellip;</p>
  </div>
  <div class="stats" id="stats"></div>
  <div class="warnings" id="warnings"></div>
</div>
<style>
#anotator8-root { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #333; }
#anotator8-root * { box-sizing: border-box; }
.header { border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 12px; }
.header h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
.status { margin: 0; color: #666; font-size: 13px; }
.stats { margin-top: 12px; }
.stats-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
.stats-item:last-child { border-bottom: none; }
.stats-key { color: #555; }
.stats-val { font-weight: 500; color: #222; }
.warnings { margin-top: 16px; }
.warning { padding: 8px 10px; margin: 4px 0; border-radius: 6px; font-size: 13px; line-height: 1.4; }
.warning.error { background: #fee2e2; color: #991b1b; border-left: 3px solid #dc2626; }
.warning.warning { background: #fef9c3; color: #854d0e; border-left: 3px solid #ca8a04; }
.warning.info { background: #dbeafe; color: #1e40af; border-left: 3px solid #3b82f6; }
</style>
<script type="module">
(function() {
  var root = document.getElementById('anotator8-root');
  var status = root.querySelector('.status');
  var statsDiv = document.getElementById('stats');
  var warningsDiv = document.getElementById('warnings');

  // Escape text to prevent XSS — all user data goes through textContent
  var esc = function(s) {
    var div = document.createElement('div');
    div.textContent = String(s == null ? '' : s);
    return div.innerHTML;
  };

  var update = function(result) {
    if (!result || !result.structuredContent) {
      status.textContent = 'No data received';
      return;
    }
    status.textContent = 'Project loaded';

    var data = result.structuredContent;

    // Render stats
    if (data.stats) {
      statsDiv.innerHTML = '';
      var entries = [
        ['totalAnnotations', 'Total annotations'],
        ['subtitleCueCount', 'Subtitle cues'],
        ['hasTemporalData', 'Has temporal data'],
        ['hasVisualExtensions', 'Has visual extensions'],
      ];
      for (var i = 0; i < entries.length; i++) {
        var key = entries[i][0];
        var label = entries[i][1];
        var val = data.stats[key];
        if (val === undefined) continue;
        var row = document.createElement('div');
        row.className = 'stats-item';
        var keySpan = document.createElement('span');
        keySpan.className = 'stats-key';
        keySpan.textContent = label;
        var valSpan = document.createElement('span');
        valSpan.className = 'stats-val';
        valSpan.textContent = String(val);
        row.appendChild(keySpan);
        row.appendChild(valSpan);
        statsDiv.appendChild(row);
      }
    }

    // Render warnings
    var allWarnings = [].concat(data.warnings || []).concat(data.source && data.source.warnings ? data.source.warnings : []);
    if (allWarnings.length) {
      warningsDiv.innerHTML = '';
      for (var j = 0; j < allWarnings.length; j++) {
        var w = allWarnings[j];
        var div = document.createElement('div');
        div.className = 'warning ' + (w.severity || 'info');
        div.textContent = '[' + (w.code || '') + '] ' + (w.message || '');
        warningsDiv.appendChild(div);
      }
    }
  };

  // Only accept messages from parent iframe
  window.addEventListener('message', function(e) {
    if (e.source !== window.parent) return;
    if (e.data && e.data.method === 'ui/notifications/tool-result') {
      update(e.data.params || e.data);
    }
  }, { passive: true });
})();
</script>
`.trim();
