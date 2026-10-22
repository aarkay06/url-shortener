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

export function isDisallowedHost(hostname) {
  if (!hostname || typeof hostname !== "string") return true;
  const host = hostname.toLowerCase().trim();

  // Self and sibling domains (anti-looping)
  if (host === "url.aarkay.tech" || host.endsWith(".aarkay.tech")) return true;
  if (host.includes("execute-api.") && host.endsWith(".amazonaws.com")) return true;

  // Local & private ranges (SSRF & internal network protection)
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "169.254.169.254" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.")
  ) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;

  return false;
}

export function parseDestinationUrl(value) {
  if (typeof value !== "string" || value.length > 2048) {
    return { valid: false, error: "URL length must be between 1 and 2048 characters" };
  }
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }
    if (url.username || url.password) {
      return { valid: false, error: "URLs with embedded credentials are not allowed" };
    }
    if (isDisallowedHost(url.hostname)) {
      return { valid: false, error: "Shortening links from this destination domain is not permitted" };
    }
    return { valid: true, url: url.href };
  } catch {
    return { valid: false, error: "Please provide a valid, absolute HTTP or HTTPS URL" };
  }
}
