"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { MUSCLES } from "@/lib/db/exercise-library";

type Item = { id: number; name: string; equipment: string; primaryMuscle: string; thumb: string | null };

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ExerciseLibrary({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (!muscle || i.primaryMuscle === muscle) && (!q || i.name.toLowerCase().includes(q)));
  }, [items, query, muscle]);

  return (
    <>
      <label className="flex h-12 items-center gap-2 rounded-2xl bg-inner px-3.5">
        <SearchIcon size={18} className="text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
      </label>
      <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1" role="group" aria-label="Muscle">
        <button type="button" className="chip" aria-pressed={muscle == null} onClick={() => setMuscle(null)}>
          All
        </button>
        {MUSCLES.filter((m) => items.some((i) => i.primaryMuscle === m)).map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
            {label(m)}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {results.map((i) => (
          <li key={i.id}>
            <Link href={`/gym/exercises/${i.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5 pr-4">
              {i.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- small static thumbnail
                <img src={i.thumb} alt="" loading="lazy" className="h-12 w-[72px] shrink-0 rounded-xl bg-white object-cover" />
              ) : (
                <span className="h-12 w-[72px] shrink-0 rounded-xl bg-inner" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{i.name}</span>
                <span className="text-[13px] text-muted">
                  {label(i.equipment)} · {i.primaryMuscle}
                </span>
              </span>
              <span className="text-lg text-muted" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
        {results.length === 0 ? <li className="px-1 text-[15px] text-muted">No exercises match.</li> : null}
      </ul>
    </>
  );
}
