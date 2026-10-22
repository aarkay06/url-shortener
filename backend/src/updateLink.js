import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getCodeFromEvent, isValidCode, jsonResponse, parseDestinationUrl } from "./shared.js";

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
      const urlResult = parseDestinationUrl(body.longUrl);
      if (!urlResult.valid) {
        return jsonResponse(400, { error: urlResult.error });
      }
      const validUrl = urlResult.url;
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
