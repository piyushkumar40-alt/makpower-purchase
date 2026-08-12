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

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Data, folder })
        });
        const data = await res.json();
        if (res.ok && data.url) {
          resolve(data.url);
        } else {
          console.warn("Cloudinary endpoint fallback:", data.error || data.details);
          resolve(base64Data);
        }
      } catch (err) {
        console.error("Upload network error, fallback to data URI:", err);
        resolve(base64Data);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
