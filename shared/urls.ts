/**
 * Public addresses of the service, in one place. Marketing pages live at the
 * site root, the app at /app, and MCP clients connect to /mcp — all served by
 * this repo on the same origin.
 */
export const SITE_ORIGIN = "https://dearkarl.com";
export const APP_URL = `${SITE_ORIGIN}/app`;
export const MCP_URL = `${SITE_ORIGIN}/mcp`;

/** Where users are told to write when something goes wrong. */
export const SUPPORT_EMAIL = "hi@dearkarl.com";

/** Diagnostic mail defaults, used when DIAGNOSTIC_EMAIL is not configured. */
export const DIAGNOSTIC_RECIPIENT = "hi@dearkarl.com";
export const DIAGNOSTIC_SENDER = "diagnostic@dearkarl.com";
