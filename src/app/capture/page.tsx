import { listPhotos } from "@/lib/goal-queries";
import { Camera } from "./camera";

export default async function CapturePage({ searchParams }: PageProps<"/capture">) {
  const sp = await searchParams;
  const pose = sp.pose === "side" || sp.pose === "back" ? sp.pose : "front";
  const list = await listPhotos("progress", pose);
  const last = list[list.length - 1];
  return <Camera pose={pose} ghostId={last?.id ?? null} />;
}
