import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getCodeFromEvent, isValidCode, jsonResponse } from "./shared.js";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

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

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME");
    return jsonResponse(500, { error: "Service is not configured" });
  }

  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const code = getCodeFromEvent(event);
  if (!isValidCode(code)) {
    return jsonResponse(404, { error: "Link not found" });
  }

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON" });
  }

  try {
    const getRes = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { code },
      })
    );

    const item = getRes.Item;
    if (!item) {
      return jsonResponse(404, { error: "Link not found" });
    }

    if (item.userId !== userId) {
      return jsonResponse(403, { error: "You are not authorized to update this link" });
    }

    const updates = [];
    const expNames = {};
    const expValues = {};

    if (body?.longUrl !== undefined) {
      const validUrl = parseDestination(body.longUrl);
      if (!validUrl) {
        return jsonResponse(400, { error: "longUrl must be a valid HTTP or HTTPS URL" });
      }
      updates.push("#longUrl = :longUrl");
      expNames["#longUrl"] = "longUrl";
      expValues[":longUrl"] = validUrl;
    }

    if (body?.isPaused !== undefined) {
      updates.push("#isPaused = :isPaused");
      expNames["#isPaused"] = "isPaused";
      expValues[":isPaused"] = Boolean(body.isPaused);
    }

    if (updates.length === 0) {
      return jsonResponse(400, { error: "No valid update fields provided" });
    }

    await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { code },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: expNames,
        ExpressionAttributeValues: expValues,
      })
    );

    return jsonResponse(200, {
      message: "Link updated successfully",
      code,
      longUrl: expValues[":longUrl"] ?? item.longUrl,
      isPaused: expValues[":isPaused"] !== undefined ? expValues[":isPaused"] : Boolean(item.isPaused),
    });
  } catch (error) {
    console.error("Failed to update link", error);
    return jsonResponse(500, { error: "Could not update link" });
  }
};
