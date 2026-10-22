import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { jsonResponse } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;
const ttlDays = Number(process.env.LINK_TTL_DAYS ?? "30");

const makeCode = () => randomBytes(9).toString("base64url").slice(0, 8);

function parseDestination(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

const getBaseUrl = (event) => {
  if (process.env.SHORT_BASE_URL) {
    return process.env.SHORT_BASE_URL.replace(/\/$/, "");
  }
  const domain = event?.requestContext?.domainName;
  const stage = event?.requestContext?.stage;
  if (domain) {
    // For HTTP APIs with $default stage, stage is "$default" and omitted in the URL
    if (!stage || stage === "$default") {
      return `https://${domain}`;
    }
    return `https://${domain}/${stage}`;
  }
  return null;
};

const RESERVED_SLUGS = new Set([
  "links",
  "api",
  "health",
  "favicon.ico",
  "robots.txt",
  "static",
  "admin",
  "docs",
]);

function parseCustomSlug(slug) {
  if (slug == null || slug === "") return { valid: true, slug: null };
  if (typeof slug !== "string") return { valid: false, error: "Custom slug must be a string" };
  const trimmed = slug.trim();
  if (trimmed === "") return { valid: true, slug: null };
  if (trimmed.length < 3 || trimmed.length > 32) {
    return { valid: false, error: "Custom slug must be between 3 and 32 characters" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "Custom slug may only contain letters, numbers, hyphens, and underscores" };
  }
  if (RESERVED_SLUGS.has(trimmed.toLowerCase())) {
    return { valid: false, error: "This custom slug is reserved. Please pick another." };
  }
  return { valid: true, slug: trimmed };
}

function parseTtlDays(input, defaultDays) {
  if (input == null || input === "") return { valid: true, days: defaultDays };
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    return { valid: false, error: "Expiration must be a whole number between 1 and 365 days" };
  }
  return { valid: true, days: parsed };
}

export const handler = async (event) => {
  const baseUrl = getBaseUrl(event);
  if (!tableName || !baseUrl || !Number.isFinite(ttlDays) || ttlDays <= 0) {
    console.error("Missing or invalid TABLE_NAME, baseUrl, or LINK_TTL_DAYS");
    return jsonResponse(500, { error: "Service is not configured" });
  }

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON" });
  }

  const longUrl = parseDestination(body?.url);
  if (!longUrl) {
    return jsonResponse(400, {
      error: "url must be an absolute HTTP or HTTPS URL without embedded credentials",
    });
  }

  const slugResult = parseCustomSlug(body?.customSlug ?? body?.slug);
  if (!slugResult.valid) {
    return jsonResponse(400, { error: slugResult.error });
  }

  const ttlResult = parseTtlDays(body?.expiresInDays, ttlDays);
  if (!ttlResult.valid) {
    return jsonResponse(400, { error: ttlResult.error });
  }

  const now = Math.floor(Date.now() / 1000);
  const effectiveTtlDays = ttlResult.days;
  const expiresAt = now + Math.floor(effectiveTtlDays * 24 * 60 * 60);

  // If client requested a custom slug
  if (slugResult.slug) {
    const code = slugResult.slug;
    try {
      await db.send(new PutCommand({
        TableName: tableName,
        Item: { code, longUrl, createdAt: now, expiresAt, isCustom: true },
        ConditionExpression: "attribute_not_exists(#code)",
        ExpressionAttributeNames: { "#code": "code" },
      }));

      return jsonResponse(201, {
        code,
        shortUrl: `${baseUrl}/${code}`,
        expiresAt,
        createdAt: now,
      });
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return jsonResponse(409, {
          error: "That custom alias is already taken. Please choose another.",
        });
      }
      console.error("Failed to store custom short link", error);
      return jsonResponse(500, { error: "Could not create short link" });
    }
  }

  // The conditional put makes the uniqueness check atomic. Retry only on a real collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    try {
      await db.send(new PutCommand({
        TableName: tableName,
        Item: { code, longUrl, createdAt: now, expiresAt },
        ConditionExpression: "attribute_not_exists(#code)",
        ExpressionAttributeNames: { "#code": "code" },
      }));

      return jsonResponse(201, {
        code,
        shortUrl: `${baseUrl}/${code}`,
        expiresAt,
        createdAt: now,
      });
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") continue;
      console.error("Failed to store short link", error);
      return jsonResponse(500, { error: "Could not create short link" });
    }
  }

  console.error("Could not allocate a unique code after retries");
  return jsonResponse(503, { error: "Please retry creating this link" });
};
