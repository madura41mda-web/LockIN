const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function persistedDocumentId(document) {
  if (!document) return null;
  if (isUuid(document.databaseId)) return document.databaseId;
  if (document.persisted === true && isUuid(document.id)) return document.id;
  return null;
}

export function optionalUuid(value, context) {
  if (!value) return null;
  if (isUuid(value)) return value;
  console.warn(`Ignoring non-UUID value for optional UUID column ${context}.`, {
    context,
    valueKind: typeof value,
    valuePrefix: typeof value === "string" ? value.slice(0, 12) : null,
  });
  return null;
}
