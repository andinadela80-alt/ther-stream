// Client-side swap aggregators (free, no API key): LI.FI for EVM, Jupiter for Solana.
import type { Quote, SwapToken } from "@/components/SwapDialog";

export const NATIVE_EVM = "0x0000000000000000000000000000000000000000";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function lifiQuote(chainId: number, from: SwapToken, to: SwapToken, amount: bigint, fromAddress: string): Promise<Quote> {
  const q = new URLSearchParams({ fromChain: String(chainId), toChain: String(chainId), fromToken: from.id, toToken: to.id, fromAmount: amount.toString(), fromAddress, slippage: "0.005", integrator: "mindcaster" });
  const r = await fetch(`https://li.quest/v1/quote?${q}`);
  const j = (await r.json()) as { message?: string; toolDetails?: { name?: string }; estimate?: { toAmount: string } };
  if (!r.ok || !j.estimate) throw new Error(j.message ?? "No swap route found.");
  return { out: Number(j.estimate.toAmount) / 10 ** to.decimals, via: j.toolDetails?.name ?? "LI.FI", raw: j };
}

export async function jupQuote(from: SwapToken, to: SwapToken, amount: bigint): Promise<Quote> {
  const q = new URLSearchParams({ inputMint: from.id, outputMint: to.id, amount: amount.toString(), slippageBps: "50" });
  const r = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${q}`);
  const j = (await r.json()) as { outAmount?: string; error?: string; routePlan?: { swapInfo?: { label?: string } }[] };
  if (!r.ok || !j.outAmount) throw new Error(j.error ?? "No swap route found.");
  return { out: Number(j.outAmount) / 10 ** to.decimals, via: `Jupiter${j.routePlan?.[0]?.swapInfo?.label ? ` · ${j.routePlan[0].swapInfo.label}` : ""}`, raw: j };
}

export async function jupSwapTx(quote: unknown, userPublicKey: string): Promise<Uint8Array> {
  const r = await fetch("https://lite-api.jup.ag/swap/v1/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteResponse: quote, userPublicKey, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }) });
  const j = (await r.json()) as { swapTransaction?: string; error?: string };
  if (!j.swapTransaction) throw new Error(j.error ?? "Failed to build swap transaction.");
  return Uint8Array.from(atob(j.swapTransaction), (c) => c.charCodeAt(0));
}
