/** Validate image picker payloads independently of Capacitor / browser File input. */
export const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;
const types: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function decodeReferencePayload(data: { mimeType?: string; base64?: string }): File {
  const mimeType = data.mimeType ?? "";
  const ext = types[mimeType];
  if (!ext || !data.base64) throw new Error("Unsupported reference image type");
  if (data.base64.length > Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 + 8) {
    throw new Error("Reference image exceeds 12 MiB");
  }
  let binary: string;
  try {
    binary = atob(data.base64);
  } catch {
    throw new Error("Invalid reference image encoding");
  }
  if (binary.length === 0 || binary.length > MAX_REFERENCE_BYTES) {
    throw new Error("Invalid reference image size");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], "reference." + ext, { type: mimeType });
}
