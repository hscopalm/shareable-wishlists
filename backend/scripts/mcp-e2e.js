// End-to-end check against docker-compose (http://localhost via nginx). Needs DEV_AUTO_LOGIN=true,
// MCP_ENABLED=true and seeded data (npm run seed). Run: npm run mcp:e2e
// Simulates a browser through OAuth (DEV_AUTO_LOGIN), then uses the real SDK client.
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const B = path.join(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/cjs');
const { Client } = require(path.join(B, 'client/index.js'));
const { StreamableHTTPClientTransport } = require(path.join(B, 'client/streamableHttp.js'));

const BASE = process.env.MCP_E2E_BASE || 'http://localhost';
const REDIRECT = 'http://127.0.0.1:8976/callback';
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failures++; };

const jar = {};
async function browser(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.cookie = cookie;
  const res = await fetch(url, { ...opts, headers, redirect: 'manual' });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  return res;
}

async function oauthToken() {
  const reg = await fetch(`${BASE}/api/oauth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'E2E Test Client', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] })
  }).then(r => r.json());
  ok(!!reg.client_id, 'dynamic client registration');

  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'wishlists', resource: `${BASE}/api/mcp` });
  let res = await browser(`${BASE}/api/oauth/authorize?${q}`);
  ok(res.status === 302 && res.headers.get('location').endsWith('/api/auth/google'), `authorize redirects to login (${res.status} ${res.headers.get('location')})`);
  res = await browser(`${BASE}/api/auth/google`);
  ok(res.headers.get('location') === '/api/oauth/consent', `login returns to consent (${res.headers.get('location')})`);
  res = await browser(`${BASE}/api/oauth/consent`);
  const html = await res.text();
  ok(res.status === 200 && html.includes('E2E Test Client') && html.includes('127.0.0.1'), 'consent page shows client name and redirect host');
  const csrf = /name="csrf_token" value="([^"]+)"/.exec(html)?.[1];
  ok(!!csrf, 'consent page has CSRF token');
  res = await browser(`${BASE}/api/oauth/consent`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf_token: csrf, decision: 'approve' }) });
  const loc = new URL(res.headers.get('location'));
  ok(loc.origin + loc.pathname === REDIRECT && loc.searchParams.get('state') === 'xyz', 'approve redirects to client with state');
  const code = loc.searchParams.get('code');

  const tok = await fetch(`${BASE}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: REDIRECT, resource: `${BASE}/api/mcp` }) }).then(r => r.json());
  ok(!!tok.access_token && !!tok.refresh_token, 'token exchange with PKCE');
  const reuse = await fetch(`${BASE}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: REDIRECT }) });
  ok(reuse.status === 400, 'authorization code cannot be reused');
  const ref = await fetch(`${BASE}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: reg.client_id }) }).then(r => r.json());
  ok(!!ref.access_token, 'refresh token rotation issues new access token');
  return ref.access_token;
}

async function connect(token) {
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const call = async (c, name, args = {}) => {
  const r = await c.callTool({ name, arguments: args });
  return { ...r, json: JSON.stringify(r) };
};

(async () => {
  const aliceToken = await oauthToken();
  const alice = await connect(aliceToken);
  const tools = (await alice.listTools()).tools;
  ok(tools.length === 21, `tools/list returns 21 tools (${tools.length})`);
  const who = await call(alice, 'whoami');
  ok(who.structuredContent?.email === 'alice.johnson@example.com' || who.json.includes('alice.johnson'), 'whoami is alice');

  const list = await call(alice, 'create_list', { name: 'E2E Birthday', description: 'test' });
  const listId = list.structuredContent?.list?.id || list.structuredContent?.id;
  ok(!!listId, `create_list (${listId})`);
  const item = await call(alice, 'add_item', { listId, title: 'Espresso machine', price: 199, priority: 5 });
  const itemId = item.structuredContent?.item?.id || item.structuredContent?.id;
  ok(!!itemId, 'add_item');
  const share = await call(alice, 'share_list', { listId, email: 'bob.smith@example.com', notify: false });
  ok(!share.isError, 'share_list with notify:false');

  const bobToken = execSync('npm run -s mcp:token -- --email bob.smith@example.com --name e2e', { cwd: path.join(__dirname, '..'), env: { ...process.env, MONGODB_URI: 'mongodb://localhost:27017/wishlist' } }).toString().match(/gg_\S+/)?.[0];
  ok(!!bobToken, 'mcp:token script mints a PAT for bob');
  const bob = await connect(bobToken);
  const shared = await call(bob, 'list_shared_with_me');
  ok(shared.json.includes('E2E Birthday'), 'bob sees the shared list');
  const claim = await call(bob, 'claim_item', { listId, itemId });
  ok(!claim.isError, 'bob claims the item');
  const mine = await call(bob, 'get_my_claims');
  ok(mine.json.includes('Espresso machine'), 'get_my_claims shows the claim');
  const bobEdit = await call(bob, 'update_item', { itemId, title: 'hacked' });
  ok(bobEdit.isError === true, 'bob cannot edit alice\'s item');

  const ownerView = await call(alice, 'get_list', { listId });
  ok(!/bob|Bob Smith|claimedBy|claimedAt/i.test(ownerView.json), 'SPOILER CHECK: owner get_list has no claim info');
  const ownerLists = await call(alice, 'list_my_lists');
  ok(!/bob|claimed/i.test(ownerLists.json), 'SPOILER CHECK: owner list_my_lists has no claim info');
  const bobView = await call(bob, 'get_list', { listId });
  ok(/claim/i.test(bobView.json), 'shared viewer sees claim state');

  await call(alice, 'delete_list', { listId });
  const gone = await call(bob, 'get_list', { listId });
  ok(gone.isError === true, 'deleted list gone for bob');

  await alice.close(); await bob.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL E2E CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('E2E crashed:', e); process.exit(1); });
