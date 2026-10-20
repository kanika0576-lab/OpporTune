import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Public health check. Confirms the application is reachable and reports
 * whether credentials are configured — without ever revealing the key value.
 * This module is intentionally self-contained so it can never throw.
 */
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  try {
    const configured = Boolean(process.env.TINYFISH_API_KEY);
    res.status(200).json({
      status: "ok",
      name: "OpporTune API",
      timestamp: new Date().toISOString(),
      apiKeyConfigured: configured,
      endpoints: {
        health: "/api/health",
        search: "/api/search",
      },
    });
  } catch {
    res.status(200).json({
      status: "ok",
      name: "OpporTune API",
      timestamp: new Date().toISOString(),
      apiKeyConfigured: false,
      endpoints: {
        health: "/api/health",
        search: "/api/search",
      },
    });
  }
}
