<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use Lovable Cloud authentication and private per-user profiles for persistent accounts; the user explicitly requested real database-backed accounts.
- Store bookmarks and post reports as private per-user records protected by database access rules, so saved content and reports cannot leak between accounts.
- Verification badges come from verified_badges (server writes only, after on-chain ERC20 payment checks); official curated identities include the protected Kageon bot in presentation code.
- Store user language and appearance preferences locally so display choices apply immediately without profile writes.
- Keep follow relationships in the user_follows table with authenticated row-level access; follows must persist across sessions.
- Media uploads go browser→R2 via short-lived signed URLs from a server function; R2 keys never reach the browser.
- FOMO API calls run server-side through one key pool that rotates keys and pauses ones that hit limits, with short in-memory caching.
- Keep help, safety, community, and legal information on the dedicated `/support` route so it remains shareable and easy to find.
- Privy login bridges to backend auth: server verifies Privy token, then issues a one-time magic-link token hash the browser exchanges for a session (keeps RLS working).
- Sign-out clears the Privy session and the backend session, then returns the browser to the entry page, so the login screen never runs on a protected URL where the provider blocks the redirect.
- Use the shared PostCard with an explicit detail mode for /post; timeline cards navigate there while embedded controls retain their actions, keeping post interactions consistent across feeds.
- Kageon replies run only from authenticated post/reply submit events, never page loads; verify source ownership and thread RLS before service-role writes, deduplicate per mention in the database, atomically save bot replies, and persist terminal AI service pauses to prevent duplicate billing or bypassing denials.
- Kageon uses request-local Responses helpers and server-only Arkham snapshots of explicitly supplied addresses; its auth identity is banned from sign-in and username edits are server-only to prevent bot impersonation.
