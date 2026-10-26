// Browser-only helpers for photos.

export type ResizedImage = { data: string; mime: string; preview: string; width: number; height: number };

function encode(canvas: HTMLCanvasElement, quality: number): ResizedImage {
  const preview = canvas.toDataURL("image/jpeg", quality);
  return { data: preview.split(",")[1], mime: "image/jpeg", preview, width: canvas.width, height: canvas.height };
}

/** Downscale a picked file to a JPEG no larger than `maxSide` px, so uploads stay small. */
export async function resizeImage(file: File, maxSide = 1280, quality = 0.82): Promise<ResizedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return encode(canvas, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Grab the current camera frame, mirrored when it's the selfie camera (matching the preview). */
export function captureFrame(video: HTMLVideoElement, mirrored: boolean, maxSide = 1440): ResizedImage {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return encode(canvas, 0.85);
}
