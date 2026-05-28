import type { TelemetryBatchPayload } from "../types/index.js";

export async function serializeBatchBody(
  payload: TelemetryBatchPayload,
): Promise<{ body: Blob | string; contentEncoding?: "gzip" }> {
  const json = JSON.stringify(payload);

  if (
    typeof CompressionStream !== "undefined" &&
    typeof Blob !== "undefined"
  ) {
    try {
      const stream = new Blob([json])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));
      const compressed = await new Response(stream).blob();
      return { body: compressed, contentEncoding: "gzip" };
    } catch {
      // fall through to plain JSON
    }
  }

  return { body: json };
}
