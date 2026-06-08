/**
 * src/server/oauth/consent-page.ts
 *
 * Minimal consent page for the lab's in-process AS. The lab is
 * read-only and self-hosted; the consent UI is a deliberately simple
 * HTML form that always grants (the lab does not pretend to ask the
 * user to confirm a write — there are no write tools). The page is
 * CSP-safe (no inline scripts, no external resources), produces a
 * clear audit-log line, and supports the OAuth 2.1 redirect-back-to-
 * client flow.
 *
 * Production IdPs (Auth0/Okta/Cognito/Stytch) ship a real consent UX.
 * This stub exists so the lab is self-contained and so the auth-code
 * flow can be exercised end-to-end without a third-party dependency.
 *
 * Security notes:
 *   - No `innerHTML` injection; the page is built with template strings
 *     and the only user-controlled values are `client_id`, `scope`,
 *     and `redirect_uri`, all of which are HTML-escaped.
 *   - The "deny" button redirects back to the client with
 *     `error=access_denied` per RFC 6749 §4.1.2.1.
 *   - The "allow" button POSTs back to `/oauth2/v1/authorize` with
 *     `decision=allow` and the same params, which the endpoint then
 *     honors and redirects with the authorization code.
 */
export interface ConsentPageInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: ReadonlyArray<string>;
  readonly state: string | undefined;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly resource: string | undefined;
  readonly subject: string;
}

export function renderConsentPage(input: ConsentPageInput, actionUrl: string): string {
  const params = encodeFormFields({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scope.join(" "),
    state: input.state ?? "",
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    resource: input.resource ?? "",
    decision: "allow",
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Anotator8 ChatGPT Lab — consent</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action ${escapeAttr(actionUrl)};" />
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 4rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #444; }
    code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
    .actions { margin-top: 1.5rem; display: flex; gap: 0.5rem; }
    button { padding: 0.5rem 1rem; font: inherit; border: 1px solid #ccc; background: #fafafa; cursor: pointer; border-radius: 4px; }
    button.primary { background: #0a7; color: white; border-color: #0a7; }
    dl { font-size: 0.95em; }
    dt { color: #666; margin-top: 0.5rem; }
    dd { margin: 0; }
  </style>
</head>
<body>
  <h1>Grant access to Anotator8 ChatGPT Lab</h1>
  <p>The client <code>${escapeHtml(input.clientId)}</code> wants to act on your behalf as <code>${escapeHtml(input.subject)}</code>.</p>
  <dl>
    <dt>Scopes</dt>
    <dd>${input.scope.map(escapeHtml).join(", ") || "(none)"}</dd>
    <dt>Redirect URI</dt>
    <dd>${escapeHtml(input.redirectUri)}</dd>
    ${input.resource ? `<dt>Resource (RFC 8707)</dt><dd>${escapeHtml(input.resource)}</dd>` : ""}
  </dl>
  <p style="margin-top:1.5rem; font-size: 0.85em; color: #666;">This lab is read-only. There is nothing to write or change — the consent grant is the only thing that happens here.</p>
  <form method="post" action="${escapeAttr(actionUrl)}" id="consent-form">
    ${params}
  </form>
  <div class="actions">
    <button type="submit" form="consent-form" name="decision" value="allow" class="primary">Allow</button>
    <button type="submit" form="consent-form" name="decision" value="deny">Deny</button>
  </div>
</body>
</html>`;
}

function encodeFormFields(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeAttr(k)}" value="${escapeAttr(v)}" />`)
    .join("\n    ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
