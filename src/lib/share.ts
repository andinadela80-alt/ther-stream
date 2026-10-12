import { toast } from "sonner";

export const SHARE_BASE = "https://mindcaster.xyz";
export const postLink = (id: string) => `${SHARE_BASE}/post?id=${id}`;
export const profileLink = (id: string) => `${SHARE_BASE}/profile?id=${id}`;

export async function shareLink(url: string, title = "Mindcaster") {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: url });
  } catch {
    toast(url);
  }
}
