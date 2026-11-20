import { useTranslations } from "next-intl";
import { SkeletonBlock, SkeletonRows } from "@/components/ui/states";
import { InstrumentLayout } from "./InstrumentLayout";

/** Loading state: the same three panes, so nothing shifts when the data arrives. */
export function InstrumentSkeleton({ withBrief = false }: { withBrief?: boolean }) {
  const t = useTranslations("staff.queue");
  return (
    <InstrumentLayout
      queue={
        <section aria-labelledby="queue-title">
          <div className="inst-h">
            <h1 id="queue-title">{t("title")}</h1>
          </div>
          <SkeletonRows rows={8} />
        </section>
      }
      brief={
        <div aria-hidden="true" className="grid gap-4">
          <SkeletonBlock className="h-7 w-2/3" />
          {withBrief ? <SkeletonBlock className="h-28 w-full" /> : null}
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-10 w-1/2" />
        </div>
      }
      trace={
        <div aria-hidden="true" className="grid gap-4">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
      }
    />
  );
}
