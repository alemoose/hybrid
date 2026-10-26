import { PageHeader } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { listPhotos } from "@/lib/goal-queries";
import { PhotoGallery } from "./photo-gallery";

export default async function PhotosPage() {
  const [tz, photos] = await Promise.all([getTimeZone(), listPhotos("progress")]);
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title="Progress photos" />
      <PhotoGallery
        photos={photos.map((p) => ({
          id: p.id,
          pose: p.pose,
          label: formatInstant(p.takenAt, tz, { month: "short", day: "numeric", year: "2-digit" }),
        }))}
      />
    </>
  );
}
