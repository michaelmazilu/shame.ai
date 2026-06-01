import { readFileSync } from "node:fs";
import path from "node:path";

let cached: ArrayBuffer | null = null;

/**
 * The fixed image used for all image-based deeds (story confession card, profile
 * picture swap). We use a static image instead of AI image generation — set via
 * `public/shame-face.jpg`. Swap that file to change the image everywhere.
 */
export function deedImageBuffer(): ArrayBuffer {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "shame-face.jpg");
  const buf = readFileSync(file);
  cached = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return cached;
}
