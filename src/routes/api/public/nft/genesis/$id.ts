import { createFileRoute } from "@tanstack/react-router";
import { genesisMetadata } from "@/lib/nft/genesis-metadata";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export const Route = createFileRoute("/api/public/nft/genesis/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const raw = params.id.replace(/\.json$/i, "");
        const meta = /^\d{1,4}$/.test(raw) ? genesisMetadata(Number(raw)) : null;
        if (!meta) return Response.json({ error: "Token not found" }, { status: 404, headers: CORS });
        return Response.json(meta, { headers: { ...CORS, "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
      },
    },
  },
});
