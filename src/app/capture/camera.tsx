"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { uploadProgressPhoto } from "@/app/goal-actions";
import { CloseIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { captureFrame, resizeImage, type ResizedImage } from "@/lib/image";

type Facing = "user" | "environment";

/**
 * Full-screen camera for progress photos. A faint copy of your last photo
 * for this pose sits on top of the preview, so you can line up the same
 * distance and angle every week.
 */
export function Camera({ pose, ghostId }: { pose: string; ghostId: number | null }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ghost, setGhost] = useState(ghostId != null);
  const [timer, setTimer] = useState<0 | 3 | 10>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shot, setShot] = useState<ResizedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1440 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraError(null);
      } catch {
        if (!cancelled) setCameraError("Camera isn't available here. You can pick a photo instead.");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, shot]);

  const takeShot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setShot(captureFrame(video, facing === "user"));
  }, [facing]);

  useEffect(() => {
    if (countdown == null) return;
    const id = setTimeout(() => {
      if (countdown <= 1) {
        takeShot();
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown, takeShot]);

  const save = () => {
    if (!shot) return;
    setError(null);
    start(async () => {
      try {
        await uploadProgressPhoto(pose, { data: shot.data, mime: shot.mime, width: shot.width, height: shot.height });
        router.push("/goals");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the photo.");
      }
    });
  };

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-ink">
      <div className="relative flex-1 overflow-hidden">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- local capture preview
          <img src={shot.preview} alt="Photo you just took" className="absolute inset-0 size-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={cx("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")}
            />
            {ghost && ghostId != null ? (
              // eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route
              <img
                src={`/photos/${ghostId}`}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full object-cover opacity-30"
              />
            ) : null}
            {countdown != null ? (
              <span className="absolute inset-0 flex items-center justify-center font-display text-[120px] font-semibold text-white drop-shadow-lg">
                {countdown}
              </span>
            ) : null}
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="text-[15px] text-ink-2">{cameraError}</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary">
                  Choose a photo
                </button>
              </div>
            ) : null}
          </>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(calc(env(safe-area-inset-top)+28px),16px)] pb-6">
          <Link href="/goals" aria-label="Close camera" className="circle-btn border-white/20 bg-black/40">
            <CloseIcon size={18} />
          </Link>
          <span className="flex-1 text-center font-display text-lg font-semibold capitalize">{pose} photo</span>
          <span className="w-11" />
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-black px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        {error ? <p className="text-center text-sm font-semibold text-warn">{error}</p> : null}
        {shot ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShot(null)} className="btn-outline border-white/20 bg-transparent">
              Retake
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Use photo"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2">
              {ghostId != null ? (
                <button type="button" className="chip border-white/20 bg-transparent" aria-pressed={ghost} onClick={() => setGhost((g) => !g)}>
                  Outline
                </button>
              ) : null}
              {([0, 3, 10] as const).map((t) => (
                <button key={t} type="button" className="chip border-white/20 bg-transparent" aria-pressed={timer === t} onClick={() => setTimer(t)}>
                  {t === 0 ? "No timer" : `${t}s`}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="w-16 text-sm font-semibold text-muted">
                Library
              </button>
              <button
                type="button"
                aria-label="Take photo"
                disabled={!!cameraError || countdown != null}
                onClick={() => (timer ? setCountdown(timer) : takeShot())}
                className="flex size-[72px] items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
              >
                <span className="size-[56px] rounded-full bg-white" />
              </button>
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                className="w-16 text-sm font-semibold text-muted"
              >
                Flip
              </button>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            stop();
            setShot(await resizeImage(file, 1440, 0.85));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't use that photo.");
          }
        }}
      />
    </main>
  );
}
