import { createFileRoute } from "@tanstack/react-router";

// Serves R2 media through our own domain so ISPs blocking *.r2.dev don't break images.
export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = params._splat ?? "";
        if (!/^(avatars|posts|stories)\/[A-Za-z0-9._\/-]+$/.test(key) || key.includes("..")) {
          return new Response("Not found", { status: 404 });
        }
        const base = process.env["CLOUDFLARE_R2_PUBLIC_URL"]?.trim().replace(/\/$/, "");
        if (!base) return new Response("Storage not configured", { status: 500 });
        const res = await fetch(`${base}/${key}`);
        if (!res.ok) return new Response("Not found", { status: res.status === 404 ? 404 : 502 });
        return new Response(res.body, {
          headers: {
            "content-type": res.headers.get("content-type") ?? "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
