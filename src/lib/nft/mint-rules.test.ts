import { describe, expect, it } from "vitest";
import { GENESIS_CHAIN_ID, GENESIS_CONTRACT, mintBlockReason } from "./mint-rules";

const eligible = { minted: 0n, supply: 1000n, agentBalance: 1n, walletMints: 0n, limit: 1n };
describe("Genesis mint eligibility", () => {
  it("targets the deployed contract on BNB Chain", () => {
    expect(GENESIS_CONTRACT).toBe("0xe73f162e0728e62ee1ebc50da1e79333acd1e8bc");
    expect(GENESIS_CHAIN_ID).toBe(56);
  });
  it("requires an Agent ID", () => {
    expect(mintBlockReason({ ...eligible, agentBalance: 0n })).not.toBeNull();
    expect(mintBlockReason(eligible)).toBeNull();
  });
  it("enforces one mint per wallet even after an NFT is transferred", () => {
    expect(mintBlockReason({ ...eligible, walletMints: 1n })).not.toBeNull();
  });
  it("stops minting at the 1000 NFT limit", () => {
    expect(mintBlockReason({ ...eligible, minted: 999n })).toBeNull();
    expect(mintBlockReason({ ...eligible, minted: 1000n })).toBe("Sold out");
  });
});