import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  Opportunity,
  OpportunityCategory,
  SearchResponse,
} from "../src/types";
import { isSafeUrl } from "./lib/validation.js";
import { validateSearchRequest } from "./lib/validation.js";
import {
  buildSearchQuery,
  getApiKey,
  tinyfishFetch,
  tinyfishSearch,
  UpstreamError,
} from "./lib/tinyfish.js";
import {
  normalizeOpportunity,
  type TinyFishFetchResult,
  type TinyFishSearchResult,
} from "./lib/normalize.js";


const FETCH_BATCH_SIZE = 10;


function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}


function upstreamStatus(code: string): number {
  switch (code) {
    case "MISSING_CREDENTIALS":
      return 503;
