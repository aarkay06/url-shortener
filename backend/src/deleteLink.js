import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getCodeFromEvent, isValidCode, jsonResponse } from "./shared.js";

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
      return jsonResponse(403, { error: "You are not authorized to delete this link" });
    }

    await db.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { code },
      })
    );

    return jsonResponse(200, {
      message: "Link deleted successfully",
      code,
    });
  } catch (error) {
    console.error("Failed to delete link", error);
    return jsonResponse(500, { error: "Could not delete link" });
  }
};
