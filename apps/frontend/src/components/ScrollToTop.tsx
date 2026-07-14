import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Drop-in component that scrolls the window to the top whenever the
 * route changes. Mount it once inside the `<Routes>` tree.
 *
 * Without this, navigating between pages keeps the previous page's
 * scroll position which is disorienting on long pages.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Use the 2-arg form (no ScrollBehavior cast) so we don't rely on
    // the non-typed `"instant"` value. The browser's default is "auto"
    // which is exactly what we want for a route change (no animation).
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
