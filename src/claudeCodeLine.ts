import { MCP_URL, SITE_ORIGIN } from "../shared/urls";

/** Name the MCP server gets inside Claude Code (`claude mcp list`). */
export const MCP_SERVER_NAME = "dearkarl";

/** Session key for the token generated during signup or on the account page,
    so the account page can show the filled line again in the same session
    (only while that token is still active). */
export const TOKEN_KEY = "dk_mcp_token";

/** Where MCP clients connect: /mcp on the origin this page came from, so a
    local or preview copy hands out a line that points at itself (its tokens
    exist only there). Falls back to production outside a browser. */
export function mcpUrl(): string {
  return typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}/mcp`
    : MCP_URL;
}

/** The `claude mcp add` line that wires Claude Code to Karl, carrying a
    Personal Access Token in the Authorization header. `--scope user` makes
    it work in every project, not just the folder the line was pasted in. */
export function connectCommand(token: string): string {
  return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${mcpUrl()} --header "Authorization: Bearer ${token}"`;
}

export function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Session storage may be unavailable; the token still shows this visit.
  }
}

/** How often, at most, a session re-checks for new mail mid-session. */
export const CHECK_EVERY_MINUTES = 30;

/** The hook script, kept in this repo at public/claude-code/ and served
    as a static file. Always the production copy: it is the same everywhere,
    and users should only ever be pointed at the published one. */
export const CHECK_SCRIPT_URL = `${SITE_ORIGIN}/claude-code/dearkarl-check.sh`;

/**
 * A prompt the user pastes into Claude Code once. Claude Code downloads the
 * hook script from dearkarl.com, shows it, and registers it, so that at
 * session start and every CHECK_EVERY_MINUTES while they work, Claude lists
 * the dearkarl folder and mentions what is new. The script keeps the "last
 * checked" time itself, so nothing is stored on our side and Claude doesn't
 * have to remember anything.
 */
export const AUTO_CHECK_PROMPT = `Set up automatic checks of my dearkarl inbox in Claude Code.

dearkarl is an MCP server I already added (name "dearkarl", tools list_files and read_file). Each file in it is an email I forwarded to my AI. The hook script for this is published by dearkarl at ${CHECK_SCRIPT_URL}.

0. First call list_files on dearkarl to make sure it is connected. If that fails, stop here and tell me to run the "claude mcp add" line from my dearkarl account page and start a new session.
1. Download the script with curl -fsSL to a temporary file (not into ~/.claude yet). Show me the whole script and tell me in a few lines what it does. It should only print instructions for you and read and write ~/.claude/dearkarl-last-check, with no network calls and no other files. If it does anything else, stop and tell me.
2. Show me the settings change: in ~/.claude/settings.json, "bash ~/.claude/hooks/dearkarl-check.sh" under SessionStart (matcher "startup|resume") and "bash ~/.claude/hooks/dearkarl-check.sh prompt" under UserPromptSubmit. Merge them with any hooks I already have; don't replace those, and don't add them twice.
3. Once I say yes, save the script as ~/.claude/hooks/dearkarl-check.sh and save the settings. Then run the script once and show me what it prints.`;
