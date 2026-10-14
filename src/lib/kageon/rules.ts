export const mentionsKageon = (content: string) => /(^|[^A-Za-z0-9_])@kageon(?![A-Za-z0-9_])/i.test(content);
export function mentionedAddresses(text: string) {
  return [...new Set(text.match(/\b0x[a-fA-F0-9]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) ?? [])].slice(0, 1);
}
export function fitReply(text: string) {
  const clean = text.trim();
  if (clean.length <= 300) return clean;
  const head = clean.slice(0, 299);
  const split = head.lastIndexOf(" ");
  return `${head.slice(0, split > 220 ? split : 299)}…`;
}