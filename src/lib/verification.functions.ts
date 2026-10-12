import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHAINS, PAY_TO, PLANS, PROMO_LIMIT } from "@/lib/verification";

export const getPromoSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("verified_badges").select("user_id", { count: "exact", head: true }).eq("promo_used", true);
    return { used: count ?? 0, limit: PROMO_LIMIT };
  });

export const confirmVerificationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      plan: z.enum(["promo", "monthly", "yearly"]),
      chain: z.enum(["base", "polygon", "bnb"]),
      token: z.enum(["USDC", "USDT"]),
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chain = CHAINS[data.chain];
    const token = chain.tokens[data.token];
    const plan = PLANS[data.plan];
    const txHash = data.txHash.toLowerCase();

    const { data: profile } = await supabaseAdmin.from("profiles").select("wallet_address").eq("id", context.userId).maybeSingle();
    const wallet = profile?.wallet_address?.toLowerCase();
    if (!wallet) throw new Error("Set up your wallet first.");

    const { data: dup } = await supabaseAdmin.from("verification_payments").select("id").eq("tx_hash", txHash).maybeSingle();
    if (dup) throw new Error("This transaction has already been used.");

    const { data: badge } = await supabaseAdmin.from("verified_badges").select("*").eq("user_id", context.userId).maybeSingle();
    if (data.plan === "promo") {
      if (badge?.promo_used) throw new Error("This promo can only be used once.");
      const { count } = await supabaseAdmin.from("verified_badges").select("user_id", { count: "exact", head: true }).eq("promo_used", true);
      if ((count ?? 0) >= PROMO_LIMIT) throw new Error("The promo quota is sold out.");
    }

    const { createPublicClient, http, parseEventLogs, erc20Abi } = await import("viem");
    const client = createPublicClient({ transport: http(chain.rpc) });
    let receipt;
    try {
      receipt = await client.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 45_000 });
    } catch {
      throw new Error("Transaction not confirmed yet. Try again shortly.");
    }
    if (receipt.status !== "success") throw new Error("Transaction failed on-chain.");
    const need = BigInt(plan.usd) * 10n ** BigInt(token.decimals);
    const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs });
    const paid = logs.some((l) =>
      l.address.toLowerCase() === token.address.toLowerCase() &&
      l.args.from.toLowerCase() === wallet &&
      l.args.to.toLowerCase() === PAY_TO.toLowerCase() &&
      l.args.value >= need,
    );
    if (!paid) throw new Error("Payment doesn't match (amount, token, or sender wallet).");

    const now = Date.now();
    const base = badge && Date.parse(badge.verified_until) > now ? Date.parse(badge.verified_until) : now;
    const expires = new Date(base + plan.days * 86_400_000).toISOString();

    const { error: payErr } = await supabaseAdmin.from("verification_payments").insert({
      user_id: context.userId, plan: data.plan, chain: data.chain, token: data.token, tx_hash: txHash,
      amount_usd: plan.usd, starts_at: new Date(base).toISOString(), expires_at: expires,
    });
    if (payErr) throw new Error(payErr.code === "23505" ? "This transaction has already been used." : "Could not save payment.");
    const { error } = await supabaseAdmin.from("verified_badges").upsert({
      user_id: context.userId, verified_until: expires, og: (badge?.og ?? false) || plan.og,
      promo_used: (badge?.promo_used ?? false) || data.plan === "promo", updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not activate verification.");
    return { verifiedUntil: expires, og: (badge?.og ?? false) || plan.og };
  });
