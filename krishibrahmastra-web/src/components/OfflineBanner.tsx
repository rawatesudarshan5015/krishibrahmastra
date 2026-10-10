import { useEffect, useState } from "react";

const QUEUE_KEY = "kb-offline-scans";

function getQueueCount(): number {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return queue.length;
  } catch {
    return 0;
  }
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [queued, setQueued] = useState(getQueueCount);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setQueued(0);
    };
    const handleOffline = () => {
      setOffline(true);
      setQueued(getQueueCount());
    };
    const handleStorage = () => setQueued(getQueueCount());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 text-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4 shrink-0"
      >
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        You're offline
        {queued > 0 ? ` — ${queued} scan${queued > 1 ? "s" : ""} queued` : " — some features won't work"}
      </span>
    </div>
  );
}
