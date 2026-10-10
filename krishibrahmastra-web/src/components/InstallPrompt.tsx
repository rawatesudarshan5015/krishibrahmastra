import { useEffect, useState } from "react";

const DISMISSED_KEY = "kb-install-dismissed";

/**
 * Floating install prompt for mobile.
 * Shows after 3 visits (not on first visit to avoid annoyance).
 * Dismissed state persisted in localStorage.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    // Check if already dismissed or already installed
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((window.navigator as any).standalone) return;

    // Count visits
    const count = parseInt(sessionStorage.getItem("kb-visits") || "0", 10) + 1;
    sessionStorage.setItem("kb-visits", String(count));

    // Only show after 2nd visit
    if (count < 2) return;

    // Listen for installability
    const handler = () => {
      if (window.deferredPrompt) {
        setDeferred(window.deferredPrompt);
        setShow(true);
      }
    };

    if (window.deferredPrompt) {
      handler();
    }
    window.addEventListener("pwa-installable", handler);
    return () => window.removeEventListener("pwa-installable", handler);
  }, []);

  if (!show || !deferred) return null;

  const install = async () => {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      window.deferredPrompt = null;
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
            <path
              d="M16 4C10 4 5 9 5 16c0 5 3 9 8 11l11-11c2-2 3-5 3-8C27 5.5 22.5 4 16 4z"
              fill="#16a34a"
            />
            <path d="M10 22l8-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Install this app</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Add to your home screen for faster access
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={install}
              className="bg-green-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-green-800 active:scale-95 transition-all"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="text-gray-400 text-xs px-2 py-1.5 rounded-lg hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-300 hover:text-gray-500 shrink-0 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
