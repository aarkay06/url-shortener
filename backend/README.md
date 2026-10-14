# URL shortener Lambda backend

This backend provides:

- `POST /links` — accepts `{"url":"https://example.com/path"}`, stores the mapping, and returns a short URL.
- `GET /{code}` — looks up the code and returns an HTTP 302 redirect, or 404/410 when missing/expired.

The SAM template creates an HTTP API, two Node.js Lambda functions, and a DynamoDB table with `code` as its String partition key. The table uses on-demand billing, enables TTL on numeric Unix-seconds field `expiresAt`, and enables point-in-time recovery. The create function uses a conditional put and retries code collisions. The redirect function checks expiration itself because DynamoDB TTL deletes items asynchronously.

## Deploy

Prerequisites: an AWS account, AWS CLI configured with a deployment identity, and AWS SAM CLI installed. Use an AWS Region that supports the chosen Lambda runtime and DynamoDB.

From this directory:

1. Run `sam build`.
2. Run `sam deploy --guided` and choose a stack name and Region. Confirm the changeset before deployment.
3. Copy the `ApiBaseUrl` output from the completed deployment. The create function uses this API URL automatically when it returns short links.

The stack name is not the table name; this template uses `url-shortener-links-dev`. If that table already exists in the account and Region, CloudFormation cannot adopt it automatically. In that case, either rename the template's table to a new unique name or import the existing table into the stack before deployment.

## Try the API

```sh
curl -X POST "$API_BASE_URL/links" \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/articles/serverless"}'
```

Open the `shortUrl` returned by the API, or request it with:

```sh
curl -i "$API_BASE_URL/aB72xK"
```

## Configuration notes

- `TABLE_NAME` is supplied from the table resource in the SAM template.
- `LINK_TTL_DAYS` defaults to 30 and is configurable at deployment.
- `SHORT_BASE_URL` is derived from the API Gateway resource in the template.
- CORS currently allows any origin for ease of local learning. Restrict `AllowOrigins` to the deployed frontend domain before production use.
- The template is a development starter, not a complete production setup. Add request throttling, alarms, custom domain and TLS setup, and abuse controls as needed.
