import { describe, expect, it } from "vitest";
import { decodeReferencePayload, MAX_REFERENCE_BYTES } from "../referencePayload";

describe("native image picker payload validation", () => {
  it("decodes a PNG into a correctly typed local file", async () => {
    const file = decodeReferencePayload({ mimeType: "image/png", base64: btoa("PNG") });
    expect(file.name).toBe("reference.png");
    expect(file.type).toBe("image/png");
    expect(await file.text()).toBe("PNG");
  });

  it("refuses untrusted file types and malformed data", () => {
    expect(() => decodeReferencePayload({ mimeType: "image/svg+xml", base64: btoa("<svg/>") })).toThrow();
    expect(() => decodeReferencePayload({ mimeType: "image/png", base64: "!!!!" })).toThrow();
    expect(() => decodeReferencePayload({ mimeType: "image/png", base64: "" })).toThrow();
  });

  it("rejects a payload too large to safely decode on Android", () => {
    expect(() => decodeReferencePayload({
      mimeType: "image/jpeg",
      base64: "A".repeat(Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 + 16),
    })).toThrow(/12 MiB/);
  });
});
