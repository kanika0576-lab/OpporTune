import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApiKey } from "./lib/tinyfish";

/**
 * Public health check. Confirms the application is reachable and reports
 * whether credentials are configured — without ever revealing the key value.
 */
export default function handler(
  _req: VercelRequest,
  res: VercelResponse,
): void {
  const configured = Boolean(getApiKey());
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
}
