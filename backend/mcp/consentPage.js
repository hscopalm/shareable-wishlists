// Server-rendered consent screen for /api/oauth/consent. Plain HTML, no
// scripts. Every dynamic value goes through escapeHtml.

const SCOPE_TEXT = {
  wishlists: 'View and manage your wishlists, share lists, and claim gifts on lists shared with you.',
  'wishlists:read': 'View your wishlists and the lists shared with you (read-only).'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hostOf(uri) {
  try {
    const u = new URL(uri);
    return u.host || u.protocol;
  } catch {
    return uri;
  }
}

const STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f3fa; color: #1f1b2e; margin: 0; padding: 32px 16px; }
  main { max-width: 440px; margin: 0 auto; background: #fff; border-radius: 12px;
    padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  h1 { font-size: 20px; margin: 0 0 4px; color: #6b46c1; }
  h2 { font-size: 17px; margin: 16px 0 8px; }
  p, li { line-height: 1.5; }
  .muted { color: #5f5a6e; font-size: 14px; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; padding: 12px; font-size: 15px; border-radius: 8px; cursor: pointer;
    border: 1px solid #6b46c1; }
  .approve { background: #6b46c1; color: #fff; }
  .deny { background: #fff; color: #6b46c1; }
  code { word-break: break-all; }
`;

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function renderConsentPage({ clientName, redirectUri, scopes, userEmail, csrfToken }) {
  const scopeItems = scopes
    .map(s => `<li>${escapeHtml(SCOPE_TEXT[s] || s)}</li>`)
    .join('');
  return layout('Authorize access - Gift Guru', `
  <h1>Gift Guru</h1>
  <p class="muted">Signed in as <strong>${escapeHtml(userEmail)}</strong></p>
  <h2>${escapeHtml(clientName || 'An application')} wants to access your Gift Guru account</h2>
  <p class="muted">(name provided by the app, not verified by Gift Guru)</p>
  <p>After you approve, you'll be sent to: <strong>${escapeHtml(hostOf(redirectUri))}</strong></p>
  <ul>${scopeItems}</ul>
  <p class="muted">It will never see who claimed gifts on your own lists.</p>
  <p class="muted">Only approve apps you trust. You can disconnect it any time from Gift Guru.</p>
  <form method="post" action="/api/oauth/consent">
    <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
    <div class="actions">
      <button class="deny" type="submit" name="decision" value="deny">Deny</button>
      <button class="approve" type="submit" name="decision" value="approve">Approve</button>
    </div>
  </form>`);
}

function renderErrorPage(message) {
  return layout('Authorization error - Gift Guru', `
  <h1>Gift Guru</h1>
  <h2>Something went wrong</h2>
  <p>${escapeHtml(message)}</p>
  <p class="muted">Return to the app you were connecting and try again.</p>`);
}

module.exports = { renderConsentPage, renderErrorPage, escapeHtml };
