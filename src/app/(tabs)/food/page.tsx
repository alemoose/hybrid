import { Card, PageHeader } from "@/components/ui";

export default function FoodPage() {
  return (
    <>
      <PageHeader eyebrow="Coming next" title="Food" />
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-semibold">Restaurant-first food logging</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
          <li>Type or say what you ate. The app splits it into items.</li>
          <li>Chain restaurants use their published nutrition.</li>
          <li>Local spots get an AI estimate with a likely range.</li>
          <li>Save your usual orders for one-tap logging.</li>
        </ul>
      </Card>
    </>
  );
}
