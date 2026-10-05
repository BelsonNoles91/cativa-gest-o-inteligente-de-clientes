/**
 * Resolve the post-OAuth destination without allowing protocol-relative or
 * backslash-normalized URLs to escape the application's origin.
 */
export function safeOAuthRedirectTarget(target: string | null, origin: string): string | null {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return null;

  try {
    const resolved = new URL(target, origin);
    return resolved.origin === origin ? target : null;
  } catch {
    return null;
  }
}
