export const GENESIS_CONTRACT = "0xe73f162e0728e62ee1ebc50da1e79333acd1e8bc" as const;
export const AGENT_REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F" as const;
export const GENESIS_CHAIN_ID = 56;

export function mintBlockReason(input: { minted: bigint; supply: bigint; agentBalance: bigint; walletMints: bigint; limit: bigint }) {
  if (input.minted >= input.supply) return "Sold out";
  if (input.walletMints >= input.limit) return "This wallet has already minted its Genesis Pass.";
  if (input.agentBalance === 0n) return "This wallet needs a Binance Agent ID (.ai) to mint.";
  return null;
}