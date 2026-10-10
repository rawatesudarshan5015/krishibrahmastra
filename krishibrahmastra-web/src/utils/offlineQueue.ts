import { useEffect, useCallback } from "react";
import { useAuthStore } from "../store/auth";

const QUEUE_KEY = "kb-offline-scans";

export interface QueuedScan {
  id: string;
  blob: string; // base64-encoded image
  filename: string;
  contentType: string;
  createdAt: string;
}

function getQueue(): QueuedScan[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setQueue(scans: QueuedScan[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(scans));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Queues a scan for upload when offline.
 * Returns the queue entry ID.
 */
export async function queueScanOffline(file: File): Promise<string> {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blob = await fileToBase64(file);
  const entry: QueuedScan = {
    id,
    blob,
    filename: file.name,
    contentType: file.type,
    createdAt: new Date().toISOString(),
  };
  const queue = getQueue();
  queue.push(entry);
  setQueue(queue);
  return id;
}

/**
 * Flushes the offline scan queue by uploading all pending scans.
 * Requires a valid auth token.
 */
async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return 0;

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
  let flushed = 0;

  for (const scan of queue) {
    try {
      const binary = atob(scan.blob);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: scan.contentType });
      const formData = new FormData();
      formData.append("file", blob, scan.filename);

      const res = await fetch(`${apiBase}/api/v1/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (res.ok) {
        flushed++;
      }
    } catch {
      // Keep this scan in the queue for next attempt
      break;
      }
  }

  // Remove successfully flushed scans
  if (flushed > 0) {
    setQueue(queue.slice(flushed));
  }

  return flushed;
}

/**
 * Hook that auto-flushes the offline scan queue when connectivity is restored.
 */
export function useOfflineScanQueue() {
  const handleOnline = useCallback(async () => {
    const flushed = await flushQueue();
    if (flushed > 0) {
      console.log(`[OfflineQueue] Flushed ${flushed} queued scan(s)`);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    // Also try flushing on mount in case we loaded while online with pending scans
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener("online", handleOnline);
  }, [handleOnline]);

  return { getQueue, queueScanOffline };
}
