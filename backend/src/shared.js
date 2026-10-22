export const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
  body: JSON.stringify(payload),
});

export const getCodeFromEvent = (event) =>
  event.pathParameters?.code ?? event.pathParameters?.proxy;

export const isValidCode = (code) =>
  typeof code === "string" && /^[A-Za-z0-9_-]{3,32}$/.test(code);
