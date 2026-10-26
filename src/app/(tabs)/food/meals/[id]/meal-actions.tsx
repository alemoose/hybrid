"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMeal, saveMealAsUsual } from "@/app/food-actions";

export function MealActions({ id, day, isUsual }: { id: number; day: string; isUsual: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(isUsual);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending || saved}
        onClick={() =>
          start(async () => {
            await saveMealAsUsual(id);
            setSaved(true);
          })
        }
        className="btn-outline"
      >
        {saved ? "Saved as a usual" : "Save as a usual"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this meal?")) return;
          start(async () => {
            await deleteMeal(id);
            router.push(`/food?d=${day}`);
          });
        }}
        className="h-11 text-sm font-semibold text-warn"
      >
        Delete meal
      </button>
    </div>
  );
}
