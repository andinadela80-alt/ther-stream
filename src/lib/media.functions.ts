import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TYPES = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/ogg": "ogg",
} as const;
export const MAX_UPLOAD = 10 * 1024 * 1024;

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: z.enum(["avatar", "post", "story"]),
      contentType: z.enum(Object.keys(TYPES) as [keyof typeof TYPES, ...(keyof typeof TYPES)[]]),
      size: z.number().int().positive().max(MAX_UPLOAD),
    }).refine((v) => v.kind === "story" || v.contentType.startsWith("image/"), "Video and music are only allowed for stories").parse(d),
  )
  .handler(async ({ data, context }) => {
    const accountId = process.env["CLOUDFLARE_R2_ACCOUNT_ID"];
    const accessKeyId = process.env["CLOUDFLARE_R2_ACCESS_KEY_ID"];
    const secretAccessKey = process.env["CLOUDFLARE_R2_SECRET_ACCESS_KEY"];
    const bucket = process.env["CLOUDFLARE_R2_BUCKET_NAME"]?.trim().toLowerCase();
    const publicUrl = process.env["CLOUDFLARE_R2_PUBLIC_URL"]?.trim();
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) throw new Error("Storage is not configured.");
    const { AwsClient } = await import("aws4fetch");
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const key = `${data.kind === "story" ? "stories" : `${data.kind}s`}/${context.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${TYPES[data.contentType]}`;
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
    url.searchParams.set("X-Amz-Expires", "300");
    const signed = await client.sign(new Request(url, { method: "PUT", headers: { "content-type": data.contentType } }), { aws: { signQuery: true } });
    return { uploadUrl: signed.url, publicUrl: `/media/${key}` };
  });
