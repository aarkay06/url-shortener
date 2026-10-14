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

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Math.floor(ttlDays * 24 * 60 * 60);

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
