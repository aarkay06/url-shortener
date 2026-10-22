import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getCodeFromEvent, isValidCode } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});
const tableName = process.env.TABLE_NAME;
const queueUrl = process.env.CLICK_EVENTS_QUEUE_URL;

const response = (statusCode, message) => ({
  statusCode,
  headers: {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  },
  body: message,
});

function parseDevice(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "mobile";
  return "desktop";
}

function parseReferrer(referrer = "") {
  if (!referrer || typeof referrer !== "string") return "direct";
  try {
    const url = new URL(referrer);
    let host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("google")) return "google";
    if (host.includes("twitter") || host.includes("t.co") || host.includes("x.com")) return "x/twitter";
    if (host.includes("linkedin") || host.includes("lnkd.in")) return "linkedin";
    if (host.includes("facebook") || host.includes("fb.me")) return "facebook";
    if (host.includes("reddit")) return "reddit";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("github")) return "github";
    return host.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 32) || "other";
  } catch {
    return "other";
  }
}

function parseCountry(headers = {}) {
  const country = headers["cloudfront-viewer-country"];
  if (typeof country === "string" && /^[A-Z]{2}$/i.test(country)) {
    return country.toUpperCase();
  }
  return "OTHER";
}

async function recordClick(code, event) {
  const headers = event.headers || {};
  const userAgent = headers["user-agent"] || "";
  const referrerHeader = headers["referer"] || headers["referrer"] || "";
  const device = parseDevice(userAgent);
  const referrer = parseReferrer(referrerHeader);
  const country = parseCountry(headers);
  const now = Math.floor(Date.now() / 1000);

  // 1. Hyperscale path: publish lightweight click event to SQS queue
  if (queueUrl) {
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            code,
            device,
            referrer,
            country,
            timestamp: now,
          }),
        })
      );
      return;
    } catch (sqsErr) {
      console.warn("SQS enqueue failed, falling back to direct DB write", sqsErr);
    }
  }

  // 2. Direct DB fallback (if queue not available)
  try {
    await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { code },
        UpdateExpression:
          "SET lastClickedAt = :now, devices.#dev = if_not_exists(devices.#dev, :zero) + :one, referrers.#ref = if_not_exists(referrers.#ref, :zero) + :one, countries.#cnt = if_not_exists(countries.#cnt, :zero) + :one ADD clickCount :one",
        ExpressionAttributeNames: {
          "#dev": device,
          "#ref": referrer,
          "#cnt": country,
        },
        ExpressionAttributeValues: {
          ":now": now,
          ":zero": 0,
          ":one": 1,
        },
      })
    );
  } catch (err) {
    try {
      await db.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { code },
          UpdateExpression:
            "SET lastClickedAt = :now, devices = if_not_exists(devices, :emptyMap), referrers = if_not_exists(referrers, :emptyMap), countries = if_not_exists(countries, :emptyMap) ADD clickCount :one",
          ExpressionAttributeValues: {
            ":now": now,
            ":one": 1,
            ":emptyMap": {},
          },
        })
      );

      await db.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { code },
          UpdateExpression:
            "SET devices.#dev = if_not_exists(devices.#dev, :zero) + :one, referrers.#ref = if_not_exists(referrers.#ref, :zero) + :one, countries.#cnt = if_not_exists(countries.#cnt, :zero) + :one",
          ExpressionAttributeNames: {
            "#dev": device,
            "#ref": referrer,
            "#cnt": country,
          },
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
          },
        })
      );
    } catch (fallbackError) {
      console.error("Failed to record click telemetry", fallbackError);
    }
  }
}

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME");
    return response(500, "Service is not configured");
  }

  const code = getCodeFromEvent(event);
  if (!isValidCode(code)) return response(404, "Link not found");

  try {
    const result = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { code },
        ConsistentRead: true,
      })
    );
    const item = result.Item;
    if (!item) return response(404, "Link not found");

    // TTL cleanup is asynchronous, so enforce expiry on every lookup ourselves.
    const now = Math.floor(Date.now() / 1000);
    if (typeof item.expiresAt === "number" && item.expiresAt <= now) {
      return response(410, "Link expired");
    }

    if (item.isPaused) {
      return response(403, "This link has been paused by its creator.");
    }

    // Treat malformed stored destinations as an internal data error, not a redirect.
    let destination;
    try {
      destination = new URL(item.longUrl);
    } catch {
      console.error("Stored destination is not a valid URL", { code });
      return response(500, "Stored link is invalid");
    }
    if (!["http:", "https:"].includes(destination.protocol)) {
      console.error("Stored destination uses a disallowed protocol", { code });
      return response(500, "Stored link is invalid");
    }

    // Record click analytics asynchronously via SQS
    await recordClick(code, event);

    return {
      statusCode: 302,
      headers: {
        location: destination.href,
        // Edge CDN caching: 60s cache at PoPs, stale-while-revalidate for sub-15ms edge redirects
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
      body: "",
    };
  } catch (error) {
    console.error("Failed to look up short link", error);
    return response(500, "Could not look up short link");
  }
};
