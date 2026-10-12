import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INSTRUCTIONS = `You write social posts for Mindcaster, a Web3 social platform ("Where Ideas Become Onchain").
Turn the user's short idea into ONE engaging post draft.
Rules: under 450 characters, write in the same language as the idea, punchy hook first line, natural tone, at most 2 relevant hashtags or $TICKERs, no financial advice claims, no quotes around the output. Output only the post text.`;

export const generatePostDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ idea: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    let failure: unknown;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content: data.idea }],
      onError: ({ error }) => { failure = error; },
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    const text = (await result.text).trim();
    if (!text) {
      const status = (failure as { statusCode?: number } | undefined)?.statusCode;
      if (status === 429) throw new Error("Too many requests, please try again shortly.");
      if (status === 402) throw new Error("Kredit AI habis.");
      throw new Error("AI couldn't create a draft right now.");
    }
    return { draft: text.slice(0, 500) };
  });
