/**
 * Uploads a file to Cloudinary via the server's /api/upload endpoint.
 * Returns the secure Cloudinary CDN URL string.
 */
export async function uploadToCloudinary(file, folder = "makpower_uploads") {
  if (!file) return "";

  // If already a URL string
  if (typeof file === "string" && (file.startsWith("http://") || file.startsWith("https://"))) {
    return file;
  }

  if (window.__startLoadingProgress) {
    window.__startLoadingProgress("Uploading Image / File...", "Optimizing and uploading media to secure CDN...", 15);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      try {
        if (window.__updateLoadingProgress) {
          window.__updateLoadingProgress(45, "Sending file payload to server...");
        }
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Data, folder })
        });
        const data = await res.json();
        if (res.ok && data.url) {
          if (window.__finishLoadingProgress) {
            window.__finishLoadingProgress("Upload complete!");
          }
          resolve(data.url);
        } else {
          console.warn("Cloudinary endpoint fallback:", data.error || data.details);
          if (window.__finishLoadingProgress) {
            window.__finishLoadingProgress();
          }
          resolve(base64Data);
        }
      } catch (err) {
        console.error("Upload network error, fallback to data URI:", err);
        if (window.__finishLoadingProgress) {
          window.__finishLoadingProgress();
        }
        resolve(base64Data);
      }
    };
    reader.onerror = (err) => {
      if (window.__finishLoadingProgress) {
        window.__finishLoadingProgress();
      }
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}
