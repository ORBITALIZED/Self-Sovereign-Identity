import { useCallback, useEffect, useState } from "react";

/**
 * Returns a `copy(text)` callback that writes to the clipboard when a
 * `navigator.clipboard` API is available, and a `copied` flag that auto-
 * resets to `false` after `resetMs` milliseconds. When the Browser's
 * clipboard API is unavailable (older browsers, http:// preview), the
 * hook reports `copied=false` and the function is a no-op so callers
 * don't need to special-case anything.
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [supported] = useState(
    typeof navigator !== "undefined" && !!navigator.clipboard?.writeText,
  );

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), resetMs);
    return () => clearTimeout(t);
  }, [copied, resetMs]);

  const copy = useCallback(
    async (text: string) => {
      if (!supported) return false;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        return true;
      } catch {
        return false;
      }
    },
    [supported],
  );

  return { copy, copied, supported };
}
