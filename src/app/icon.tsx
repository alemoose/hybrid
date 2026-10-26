import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Mark size={512} />, size);
}

/** Cobalt tile with an off-white dumbbell, matching the + button. */
export function Mark({ size }: { size: number }) {
  const s = size / 24;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#141412",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size * 0.78,
          height: size * 0.78,
          borderRadius: size * 0.2,
          background: "#3D5AF1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={18 * s} height={18 * s} viewBox="0 0 24 24" fill="none" stroke="#F3F2EC" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6.5 6v12M3.5 9v6M17.5 6v12M20.5 9v6M6.5 12h11" />
        </svg>
      </div>
    </div>
  );
}
