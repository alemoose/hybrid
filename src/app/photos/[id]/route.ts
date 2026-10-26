import type { NextRequest } from "next/server";
import { getPhoto } from "@/lib/goal-queries";

// Only reachable with a valid session: src/proxy.ts guards every path.
export async function GET(_req: NextRequest, ctx: RouteContext<"/photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await getPhoto(Number(id));
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "content-type": photo.mime,
      // Photos never change once saved; "private" keeps them out of shared caches.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
