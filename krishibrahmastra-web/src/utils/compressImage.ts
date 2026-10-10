/**
 * Compresses an image file using the Canvas API before upload.
 * Resizes to maxWidthPx (preserving aspect ratio) and outputs JPEG at 82% quality.
 * 82% quality is a good balance for readability of bottle label text vs file size.
 *
 * Typical result: 8MB phone photo → ~250–400KB compressed JPEG.
 */
export async function compressImage(
  file: File,
  maxWidthPx = 1200
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidthPx / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Canvas not available — return original file unchanged
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              // toBlob failed — return original file
              resolve(file);
              return;
            }
            const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          "image/jpeg",
          0.82
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Could not decode image — pass through original
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Uploads a file with automatic retry on failure.
 * Uses exponential backoff: waits 1.5s × attempt between retries.
 */
export async function uploadWithRetry<T>(
  uploadFn: () => Promise<T>,
  maxRetries = 3,
  onRetry?: (attempt: number) => void
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      onRetry?.(attempt);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  // TypeScript requires a return — this line is unreachable
  throw new Error("Upload failed after maximum retries");
}
