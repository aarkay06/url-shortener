import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  if (!tableName) {
    console.error("Missing TABLE_NAME in processClicks");
    return;
  }

  const records = event.Records || [];
  if (records.length === 0) return;

  // Aggregate in-memory by code to eliminate hot-partition lock contention
  const aggregated = {};

  for (const record of records) {
    try {
      const payload = JSON.parse(record.body);
      const { code, device, referrer, country, timestamp } = payload;
      if (!code) continue;

      if (!aggregated[code]) {
        aggregated[code] = {
          clicks: 0,
          devices: {},
          referrers: {},
          countries: {},
          lastClickedAt: timestamp || Math.floor(Date.now() / 1000),
        };
      }

      aggregated[code].clicks += 1;
      if (timestamp && timestamp > aggregated[code].lastClickedAt) {
        aggregated[code].lastClickedAt = timestamp;
      }

      if (device) {
        aggregated[code].devices[device] = (aggregated[code].devices[device] || 0) + 1;
      }
      if (referrer) {
        aggregated[code].referrers[referrer] = (aggregated[code].referrers[referrer] || 0) + 1;
      }
      if (country) {
        aggregated[code].countries[country] = (aggregated[code].countries[country] || 0) + 1;
      }
    } catch (parseErr) {
      console.error("Failed to parse SQS click event record", parseErr);
    }
  }

  // Flush batched updates into DynamoDB
  for (const [code, stats] of Object.entries(aggregated)) {
    try {
      const setParts = ["lastClickedAt = :now"];
      const expNames = {};
      const expValues = {
        ":now": stats.lastClickedAt,
        ":zero": 0,
        ":clicks": stats.clicks,
      };

      let devIdx = 0;
      for (const [dev, count] of Object.entries(stats.devices)) {
        const devKey = `#d_${devIdx}`;
        const countVal = `:dv_${devIdx}`;
        setParts.push(`devices.${devKey} = if_not_exists(devices.${devKey}, :zero) + ${countVal}`);
        expNames[devKey] = dev;
        expValues[countVal] = count;
        devIdx++;
      }

      let refIdx = 0;
      for (const [ref, count] of Object.entries(stats.referrers)) {
        const refKey = `#r_${refIdx}`;
        const countVal = `:rv_${refIdx}`;
        setParts.push(`referrers.${refKey} = if_not_exists(referrers.${refKey}, :zero) + ${countVal}`);
        expNames[refKey] = ref;
        expValues[countVal] = count;
        refIdx++;
      }

      let cntIdx = 0;
      for (const [cnt, count] of Object.entries(stats.countries)) {
        const cntKey = `#c_${cntIdx}`;
        const countVal = `:cv_${cntIdx}`;
        setParts.push(`countries.${cntKey} = if_not_exists(countries.${cntKey}, :zero) + ${countVal}`);
        expNames[cntKey] = cnt;
        expValues[countVal] = count;
        cntIdx++;
      }

      await db.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { code },
          UpdateExpression: `SET ${setParts.join(", ")} ADD clickCount :clicks`,
          ExpressionAttributeNames: Object.keys(expNames).length ? expNames : undefined,
          ExpressionAttributeValues: expValues,
        })
      );
    } catch (err) {
      // Fallback for legacy items that might have missing map containers
      try {
        await db.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { code },
            UpdateExpression: "SET devices = if_not_exists(devices, :emptyMap), referrers = if_not_exists(referrers, :emptyMap), countries = if_not_exists(countries, :emptyMap)",
            ExpressionAttributeValues: { ":emptyMap": {} },
          })
        );
      } catch (fallbackErr) {
        console.error(`Failed to update aggregated clicks for ${code}`, fallbackErr);
      }
    }
  }
};
