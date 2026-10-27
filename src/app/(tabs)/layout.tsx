import { TabBar } from "@/components/tab-bar";
import { TimeZoneSync } from "@/components/time-zone-sync";

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-[18px] pt-[max(calc(env(safe-area-inset-top)+28px),20px)] pb-32">
        {children}
      </main>
      <TabBar />
      <TimeZoneSync />
    </>
  );
}
