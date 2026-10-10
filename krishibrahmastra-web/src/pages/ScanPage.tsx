import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useNavigate } from "react-router-dom";
import { compressImage, uploadWithRetry } from "../utils/compressImage";
import { queueScanOffline } from "../utils/offlineQueue";
import { InstallPrompt } from "../components/InstallPrompt";

const MAX_RETRIES = 3;

export function ScanPage() {
  const navigate = useNavigate();
  const [scanId, setScanId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [compressing, setCompressing] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false);

  // Upload mutation with compression + retry + offline queue
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // If offline, queue for later
      if (!navigator.onLine) {
        const queueId = await queueScanOffline(file);
        return { scan_id: queueId, status: "QUEUED_OFFLINE" };
      }

      setCompressing(true);
      let compressed: File;
      try {
        compressed = await compressImage(file, 1200);
        if (import.meta.env.DEV) {
          console.log(
            `[ScanPage] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(
              compressed.size / 1024
            ).toFixed(0)}KB`
          );
        }
      } finally {
        setCompressing(false);
      }

      setRetryAttempt(0);
      return uploadWithRetry(
        () => {
          const form = new FormData();
          form.append("file", compressed);
          return apiClient
            .post("/api/v1/scan", form, { timeout: 30_000 })
            .then((r) => r.data);
        },
        MAX_RETRIES,
        (attempt) => setRetryAttempt(attempt)
      );
    },
    onSuccess: (data) => {
      setRetryAttempt(0);
      if (data.status === "QUEUED_OFFLINE") {
        setOfflineQueued(true);
      } else {
        setScanId(data.scan_id);
      }
    },
  });

  // Poll for result every 3 seconds until COMPLETED or FAILED
  const { data: scanResult } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () =>
      apiClient.get(`/api/v1/scan/${scanId}`).then((r) => r.data),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "PENDING" || status === "PROCESSING") return 3000;
      return false;
    },
  });

  // Navigate when COMPLETED
  if (scanResult?.status === "COMPLETED") {
    navigate(`/results/${scanId}`);
  }

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setPreview(URL.createObjectURL(file));
      setScanId(null);
      uploadMutation.mutate(file);
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: uploadMutation.isPending || !!scanId,
  });

  const isUploading = uploadMutation.isPending;
  const isPolling =
    !!scanId &&
    (scanResult?.status === "PENDING" || scanResult?.status === "PROCESSING");

  const statusLabel = () => {
    if (compressing) return "Optimising image...";
    if (retryAttempt > 0)
      return `Upload failed, retrying... (attempt ${retryAttempt + 1}/${MAX_RETRIES})`;
    if (!scanId) return "Uploading...";
    if (scanResult?.status === "PROCESSING") return "Reading label with Gemini AI...";
    return "Waiting for worker...";
  };

  const reset = () => {
    setScanId(null);
    setPreview(null);
    setRetryAttempt(0);
    setOfflineQueued(false);
    uploadMutation.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800">Scan Bottle Label</h1>
        <p className="text-sm text-gray-500 mt-1">
          Take or upload a photo of any agrochemical bottle
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-green-500 bg-green-50 scale-[1.01]"
            : isUploading || isPolling
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-70"
            : "border-gray-300 bg-white hover:border-green-400 hover:bg-green-50"
        }`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 mx-auto rounded-xl object-contain shadow-sm"
          />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                  className="w-8 h-8"
                >
                  <path
                    d="M3 16.5V18a2.5 2.5 0 002.5 2.5h13A2.5 2.5 0 0021 18v-1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 3v13M8 8l4-5 4 5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-700">
                {isDragActive ? "Drop the photo here" : "Tap to take or choose a photo"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                JPG, PNG or WebP · max 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status card — shown while uploading or polling */}
      {(isUploading || isPolling) && (
        <div className="bg-white rounded-xl border border-green-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="shrink-0 w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <div className="min-w-0">
            <p className="font-medium text-gray-800 text-sm truncate">
              {statusLabel()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Usually takes 10–30 seconds
            </p>
          </div>
        </div>
      )}

      {/* FAILED state */}
      {scanResult?.status === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth={2}
              className="w-5 h-5 mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-red-700 font-medium text-sm">
                Could not read the label
              </p>
              <p className="text-red-500 text-xs mt-0.5">
                {scanResult.errorMessage || "Try a clearer, well-lit photo."}
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* OFFLINE QUEUED state */}
      {offlineQueued && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth={2}
              className="w-5 h-5 mt-0.5 shrink-0"
            >
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-amber-800 font-medium text-sm">
                Scan queued for later
              </p>
              <p className="text-amber-600 text-xs mt-0.5">
                You're offline. This scan will be uploaded automatically when your connection is restored.
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Scan Another
          </button>
        </div>
      )}

      {/* Upload error (network etc.) */}
      {uploadMutation.isError && !isUploading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-red-700 text-sm">
            Upload failed after {MAX_RETRIES} attempts. Check your connection and try again.
          </p>
          <button
            onClick={reset}
            className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Mobile install prompt */}
      <InstallPrompt />
    </div>
  );
}
