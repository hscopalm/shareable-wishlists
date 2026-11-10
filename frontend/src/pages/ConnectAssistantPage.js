import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  IconButton,
  TextField,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  DeleteOutline as RevokeIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import {
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
  revokeMcpConnection,
} from '../services/api';
import { colors } from '../theme';

const READ_ONLY_SCOPE = 'wishlists:read';
const FULL_SCOPE = 'wishlists';

const cardSx = {
  backgroundColor: alpha(colors.background.elevated, 0.6),
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  mb: 3,
};

const codeSx = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.85rem',
  backgroundColor: alpha(colors.primary, 0.06),
  border: `1px solid ${colors.border}`,
  borderRadius: '8px',
  p: 1.5,
  m: 0,
  overflowX: 'auto',
  whiteSpace: 'pre',
  color: colors.text.primary,
};

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard can be unavailable (insecure context); the text stays selectable.
    }
  };

  return (
    <Tooltip title={copied ? 'Copied' : label}>
      <IconButton aria-label={label} onClick={handleCopy} size="small" sx={{ color: colors.primary }}>
        {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function CodeBlock({ text, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box component="pre" sx={{ ...codeSx, flex: 1, minWidth: 0 }}>{text}</Box>
      <CopyButton text={text} label={label} />
    </Box>
  );
}

function SetupInstructions({ mcpUrl }) {
  const [tab, setTab] = useState(0);

  const claudeCodeAdd = `claude mcp add --transport http giftguru ${mcpUrl}`;
  const claudeCodeToken = `claude mcp add --transport http giftguru ${mcpUrl} --header "Authorization: Bearer YOUR_TOKEN"`;
  const jsonSnippet = JSON.stringify(
    {
      mcpServers: {
        giftguru: {
          url: mcpUrl,
          headers: { Authorization: 'Bearer YOUR_TOKEN' },
        },
      },
    },
    null,
    2
  );

  const body = [
    <Box key="claude">
      <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 1.5 }}>
        Open Settings, then Connectors, then Add custom connector. Paste the URL above and sign in
        with Gift Guru when asked.
      </Typography>
    </Box>,
    <Box key="chatgpt">
      <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 1.5 }}>
        Turn on developer mode in ChatGPT's connector settings, then add a connector using the URL
        above. Sign in with Gift Guru when asked.
      </Typography>
    </Box>,
    <Box key="code">
      <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 1.5 }}>
        Add the server, then run /mcp inside Claude Code and sign in.
      </Typography>
      <CodeBlock text={claudeCodeAdd} label="Copy command" />
      <Typography variant="body2" sx={{ color: colors.text.secondary, my: 1.5 }}>
        Or skip the sign-in and use a token from below:
      </Typography>
      <CodeBlock text={claudeCodeToken} label="Copy token command" />
    </Box>,
    <Box key="cursor">
      <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 1.5 }}>
        Add this to your MCP config (Cursor: .cursor/mcp.json) with a token from below. VS Code uses
        "servers" instead of "mcpServers" and needs "type": "http".
      </Typography>
      <CodeBlock text={jsonSnippet} label="Copy JSON" />
    </Box>,
  ];

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: `1px solid ${colors.border}` }}
      >
        <Tab label="Claude" />
        <Tab label="ChatGPT" />
        <Tab label="Claude Code" />
        <Tab label="Cursor / VS Code" />
      </Tabs>
      {body[tab]}
    </Box>
  );
}

const scopeLabel = (scopes = []) =>
  scopes.includes(FULL_SCOPE) ? 'Full access' : 'Read-only';

const lastUsed = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : 'never');

function ConnectAssistantPage() {
  const mcpUrl = `${window.location.origin}/api/mcp`;

  const [tokens, setTokens] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newToken, setNewToken] = useState(null);
  // { kind: 'token' | 'connection', id, label }
  const [toRevoke, setToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listMcpTokens();
      setTokens(data?.tokens || []);
      setConnections(data?.connections || []);
      setLoadError('');
    } catch (e) {
      setLoadError(
        e?.response?.status === 404
          ? "Connecting AI assistants isn't switched on yet."
          : 'Could not load your tokens and connected apps.'
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await createMcpToken(name.trim(), readOnly ? READ_ONLY_SCOPE : FULL_SCOPE);
      setNewToken(result);
      setName('');
      setReadOnly(false);
      await load();
    } catch (err) {
      setCreateError(err?.response?.data?.message || err?.response?.data?.error || 'Could not create the token.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      if (toRevoke.kind === 'token') {
        await revokeMcpToken(toRevoke.id);
      } else {
        await revokeMcpConnection(toRevoke.id);
      }
      if (newToken && toRevoke.kind === 'token' && newToken.id === toRevoke.id) {
        setNewToken(null);
      }
      setToRevoke(null);
      await load();
    } catch (err) {
      setLoadError('Could not revoke. Try again.');
      setToRevoke(null);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 700, color: colors.text.primary, mb: 1 }}
      >
        Connect an AI assistant
      </Typography>
      <Typography variant="body1" sx={{ color: colors.text.secondary, mb: 3 }}>
        Let an assistant like Claude read your lists, add items, and claim gifts for you. It can't
        see who claimed items on your own lists.
      </Typography>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Server URL
          </Typography>
          <CodeBlock text={mcpUrl} label="Copy URL" />
          <Box sx={{ mt: 3 }}>
            <SetupInstructions mcpUrl={mcpUrl} />
          </Box>
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Access tokens
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 2 }}>
            For tools that can't sign in with Gift Guru. Treat a token like a password.
          </Typography>

          {newToken && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNewToken(null)}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Copy your new token now. It won't be shown again.
              </Typography>
              <CodeBlock text={newToken.token} label="Copy token" />
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleCreate}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1.5,
              mb: 2,
            }}
          >
            <TextField
              size="small"
              label="Token name"
              placeholder="e.g. Claude Code laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 60 }}
              sx={{ flex: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                />
              }
              label="Read-only"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={creating || !name.trim()}
            >
              Create token
            </Button>
          </Box>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          {loadError && <Alert severity={loadError.includes('switched on') ? 'info' : 'error'} sx={{ mb: 2 }}>{loadError}</Alert>}

          {tokens.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.text.muted }}>
              No tokens yet.
            </Typography>
          ) : (
            tokens.map((t) => (
              <Box
                key={t.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  py: 1.25,
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.text.muted }}>
                    {t.prefix}... · {scopeLabel(t.scopes)} · last used {lastUsed(t.lastUsedAt)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="error"
                  startIcon={<RevokeIcon />}
                  onClick={() => setToRevoke({ kind: 'token', id: t.id, label: t.name })}
                  aria-label={`Revoke ${t.name}`}
                >
                  Revoke
                </Button>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Connected apps
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.secondary, mb: 2 }}>
            Apps you signed in to with Gift Guru.
          </Typography>
          {connections.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.text.muted }}>
              No connected apps.
            </Typography>
          ) : (
            connections.map((c) => (
              <Box
                key={c.clientId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  py: 1.25,
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {c.clientName || 'Unnamed app'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.text.muted }}>
                    {scopeLabel(c.scopes)} · last used {lastUsed(c.lastUsedAt)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="error"
                  startIcon={<RevokeIcon />}
                  onClick={() =>
                    setToRevoke({
                      kind: 'connection',
                      id: c.clientId,
                      label: c.clientName || 'this app',
                    })
                  }
                  aria-label={`Revoke ${c.clientName || 'app'}`}
                >
                  Revoke
                </Button>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(toRevoke)} onClose={() => !revoking && setToRevoke(null)} fullWidth maxWidth="xs">
        <DialogTitle>Revoke access?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toRevoke?.label} will stop working immediately. You can connect it again later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToRevoke(null)} disabled={revoking}>
            Cancel
          </Button>
          <Button onClick={handleRevoke} color="error" variant="contained" disabled={revoking}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConnectAssistantPage;
