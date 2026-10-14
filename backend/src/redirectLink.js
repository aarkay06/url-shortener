import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getCodeFromEvent, isValidCode } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

const response = (statusCode, message) => ({
  statusCode,
  headers: {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  },
  body: message,
});

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME");
    return response(500, "Service is not configured");
  }

  const code = getCodeFromEvent(event);
  if (!isValidCode(code)) return response(404, "Link not found");

  try {
    const result = await db.send(new GetCommand({
      TableName: tableName,
      Key: { code },
      ConsistentRead: true,
    }));
    const item = result.Item;
    if (!item) return response(404, "Link not found");

    // TTL cleanup is asynchronous, so enforce expiry on every lookup ourselves.
    const now = Math.floor(Date.now() / 1000);
    if (typeof item.expiresAt === "number" && item.expiresAt <= now) {
      return response(410, "Link expired");
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

    return {
      statusCode: 302,
      headers: {
        location: destination.href,
        "cache-control": "no-store",
      },
      body: "",
    };
  } catch (error) {
    console.error("Failed to look up short link", error);
    return response(500, "Could not look up short link");
  }
};
