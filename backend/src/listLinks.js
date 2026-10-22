import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { jsonResponse } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME");
    return jsonResponse(500, { error: "Service is not configured" });
  }

  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  try {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
        ScanIndexForward: false, // Newest first
      })
    );

    const now = Math.floor(Date.now() / 1000);
    const links = (result.Items ?? []).map((item) => ({
      code: item.code,
      longUrl: item.longUrl,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      isExpired: typeof item.expiresAt === "number" && item.expiresAt <= now,
      isPaused: Boolean(item.isPaused),
      isCustom: Boolean(item.isCustom),
      totalClicks: item.clickCount || 0,
      lastClickedAt: item.lastClickedAt || null,
      devices: item.devices || {},
      referrers: item.referrers || {},
      countries: item.countries || {},
    }));

    return jsonResponse(200, { links });
  } catch (error) {
    console.error("Failed to list user links", error);
    return jsonResponse(500, { error: "Could not retrieve user links" });
  }
};
