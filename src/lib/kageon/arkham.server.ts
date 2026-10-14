import { mentionedAddresses } from "./rules";

// On-demand snapshots only, never a background subscription or transaction.
export async function arkhamContext(text: string) {
  const addresses = mentionedAddresses(text);
  if (!addresses.length) return { available: false, note: "No explicit wallet/contract address was supplied. Do not invent on-chain data." };
  const key = process.env["ARKHAM_API_KEY"];
  if (!key) return { available: false, note: "Arkham is not configured." };
  const response = await fetch("https://api.arkm.com/intelligence/address/batch/all", {
    method: "POST",
    headers: { "API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  if (!response.ok) return { available: false, note: `Arkham lookup unavailable (HTTP ${response.status}). Do not claim to have checked this address.` };
  const intelligence: unknown = await response.json();
  const balanceResponse = await fetch(`https://api.arkm.com/balances/address/${addresses[0]}`, { headers: { "API-Key": key } });
  const balances: unknown = balanceResponse.ok ? await balanceResponse.json() : { unavailable: true, status: balanceResponse.status };
  return { available: true, source: "Arkham", fetchedAt: new Date().toISOString(), address: addresses[0], intelligence, balances };
}