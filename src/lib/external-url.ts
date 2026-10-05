/**
 * Validates URLs supplied by public tenant data before exposing them as links.
 * Public links are intentionally limited to absolute HTTP(S) URLs.
 */
export function getSafeExternalHttpUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2048) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
