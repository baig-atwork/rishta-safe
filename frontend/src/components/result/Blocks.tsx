import { useId } from "react";
import { useTranslations } from "next-intl";
import { TallyGrid } from "@/components/grid/TallyGrid";
import type { Block } from "@/lib/api/types";

/** The boundary notice, stated once on a result screen that has no document of its own (the withheld views). */
export function BoundaryStrip() {
  const t = useTranslations("result.boundary");
  return (
    <aside aria-labelledby="boundary-heading" className="panel-sunken border-s-4 border-line-strong" data-testid="boundary">
      <h2 id="boundary-heading" className="m-0 text-base font-semibold">
        {t("title")}
      </h2>
      <p className="measure m-0 mt-1 text-fg-2">{t("body")}</p>
    </aside>
  );
}

/** The tally for an icon_array block: the API caption (visible, it labels the grid) and the grid with its legend. */
export function TallyBlock({ block, size = 15 }: { block: Block; size?: number }) {
  const t = useTranslations("result.iconArray");
  const captionId = useId();
  if (!block.icon_array) return null;
  return (
    <figure className="m-0 grid gap-3">
      <p id={captionId} className="read m-0">
        {block.icon_array.caption}
      </p>
      <TallyGrid
        spec={block.icon_array}
        captionId={captionId}
        size={size}
        legend={{ affected: t("legend.affected"), carrier: t("legend.carrier"), neither: t("legend.neither") }}
        invalidLabel={t("invalid")}
      />
    </figure>
  );
}

/** One block, laid out. Text is whatever the API returned; this component adds no wording of its own (except the callout label). */
export function BlockView({ block, lang, dir }: { block: Block; lang?: string; dir?: "ltr" | "rtl" }) {
  const t = useTranslations("result.callout");
  const attrs = lang ? { lang, dir } : {};
  switch (block.kind) {
    case "heading":
      return (
        <h3 {...attrs} className="mt-2 text-lg first:mt-0">
          {block.text}
        </h3>
      );
    case "paragraph":
      return (
        <p {...attrs} className="read m-0">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul {...attrs} className="read m-0 grid list-disc gap-1 ps-6">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "icon_array":
      return block.icon_array ? <TallyBlock block={block} /> : null;
    case "callout":
      return (
        <aside {...attrs} className="panel-sunken" data-tone={block.tone}>
          <p className="label mb-1">{t(block.tone)}</p>
          <p className="measure read m-0">{block.text}</p>
        </aside>
      );
    default:
      return null;
  }
}

/** Renders explainer blocks in order. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="grid gap-4">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
