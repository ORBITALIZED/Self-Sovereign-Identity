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
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
