import { useEffect, useState } from "react";

/**
 * Listens for SW_UPDATED messages from the service worker.
 * Shows a sticky banner when a new version is available.
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        setShow(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  if (!show) return null;

  const reload = () => {
    window.location.reload();
  };

  const dismiss = () => setShow(false);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-green-700 text-white px-4 py-3 shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <p className="text-sm font-medium">A new version is available</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={dismiss}
            className="text-green-100 hover:text-white text-sm px-2 py-1 rounded-lg transition-colors"
          >
            Later
          </button>
          <button
            onClick={reload}
            className="bg-white text-green-700 text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-green-50 active:scale-95 transition-all"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
