import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getCodeFromEvent, isValidCode, jsonResponse } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME");
    return jsonResponse(500, { error: "Service is not configured" });
  }

  const code = getCodeFromEvent(event);
  if (!isValidCode(code)) {
    return jsonResponse(404, { error: "Link not found" });
  }

  try {
    const result = await db.send(new GetCommand({
      TableName: tableName,
      Key: { code },
    }));

    const item = result.Item;
    if (!item) {
      return jsonResponse(404, { error: "Link not found" });
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = typeof item.expiresAt === "number" && item.expiresAt <= now;

    return jsonResponse(200, {
      code: item.code,
      longUrl: item.longUrl,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      isExpired,
      totalClicks: item.clickCount || 0,
      lastClickedAt: item.lastClickedAt || null,
      devices: item.devices || {},
      referrers: item.referrers || {},
      countries: item.countries || {},
    });
  } catch (error) {
    console.error("Failed to fetch analytics for link", error);
    return jsonResponse(500, { error: "Could not retrieve link analytics" });
  }
};
