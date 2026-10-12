import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const num = { type: ["number", "null"] } as const;

/** Strict schema the model must follow: grids + editable shapes in artboard pixels. */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["concept", "rationale", "grids", "shapes"],
  properties: {
    concept: { type: "string" },
    rationale: { type: "string" },
    grids: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "rotation", "spacing", "count", "rays", "sides"],
        properties: {
          kind: {
            type: "string",
            enum: ["square", "concentric", "radial", "isometric", "triangular", "hexagonal", "golden"],
          },
          rotation: num,
          spacing: num,
          count: num,
          rays: num,
          sides: num,
        },
      },
    },
    shapes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "role", "cx", "cy", "r", "x1", "y1", "x2", "y2", "start", "end", "points", "closed", "fill"],
        properties: {
          type: { type: "string", enum: ["circle", "line", "arc", "path"] },
          role: { type: "string", enum: ["guide", "artwork"] },
          cx: num, cy: num, r: num,
          x1: num, y1: num, x2: num, y2: num,
          start: num, end: num,
          points: {
            type: ["array", "null"],
            items: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y"],
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
          closed: { type: ["boolean", "null"] },
          fill: { type: ["string", "null"] },
        },
      },
    },
  },
};

export type ConstructionSpec = {
  concept: string;
  rationale: string;
  grids: { kind: string; rotation: number | null; spacing: number | null; count: number | null; rays: number | null; sides: number | null }[];
  shapes: {
    type: "circle" | "line" | "arc" | "path";
    role: "guide" | "artwork";
    cx: number | null; cy: number | null; r: number | null;
    x1: number | null; y1: number | null; x2: number | null; y2: number | null;
    start: number | null; end: number | null;
    points: { x: number; y: number }[] | null;
    closed: boolean | null;
    fill: string | null;
  }[];
};

export const suggestConstruction = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      brief: z.string().trim().min(3).max(2000),
      width: z.number().positive().max(10000),
      height: z.number().positive().max(10000),
      lang: z.enum(["en", "ar"]),
    }),
  )
  .handler(async ({ data }): Promise<{ spec?: ConstructionSpec; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI is not configured." };

    const instructions = `You are a senior geometric logo designer. From a brand brief, propose a precise construction for a logo on a ${data.width}x${data.height} px artboard (origin top-left, y down, centre ${data.width / 2},${data.height / 2}).
Return: a short concept, a rationale (in ${data.lang === "ar" ? "Arabic" : "English"}), 1-3 construction grids, and 4-20 shapes.
Use "guide" shapes for construction circles/lines (golden-ratio circles, axes) and "artwork" shapes for the actual mark. Arc angles are degrees, 0 = +x, increasing clockwise on screen. Closed artwork paths may use a hex fill. Keep everything inside the artboard, built from clean ratios (1:1.618, halves, thirds). Set unused numeric fields to null.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions,
        input: data.brief,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "construction", strict: true, schema: SCHEMA } },
      }),
    });

    if (!res.ok || !res.body) {
      let msg = `AI request failed (${res.status}).`;
      try {
        const j = (await res.json()) as { error?: { message?: string }; message?: string };
        msg = j.error?.message ?? j.message ?? msg;
      } catch {
        /* ignore */
      }
      if (res.status === 429) msg = "Too many requests — please wait a moment and try again.";
      if (res.status === 402) msg = msg || "AI credits are exhausted.";
      return { error: msg };
    }

    // Consume the SSE stream and accumulate output text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let failure: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload) as { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
            if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
            else if (ev.type === "response.refusal.delta") failure = "The model declined this request.";
            else if (ev.type === "error" || ev.type === "response.failed")
              failure = ev.error?.message ?? ev.response?.error?.message ?? "AI request failed.";
          } catch {
            /* partial frame */
          }
        }
      }
    }
    if (failure) return { error: failure };
    try {
      return { spec: JSON.parse(text) as ConstructionSpec };
    } catch {
      return { error: "The AI returned an unreadable answer. Try again." };
    }
  });
