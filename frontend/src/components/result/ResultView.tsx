import { useTranslations } from "next-intl";
import { Cell } from "@/components/grid/Cell";
import { Link } from "@/i18n/navigation";
import type { Block, ResultEnvelope } from "@/lib/api/types";
import { splitLayers } from "@/lib/result-layers";
import { Blocks, BoundaryStrip } from "./Blocks";

/** The same sentence can arrive twice in one document; show it once. */
function uniqueByText(blocks: Block[]): Block[] {
  const seen = new Set<string>();
  return blocks.filter((b) => (seen.has(b.text) ? false : (seen.add(b.text), true)));
}

/**
 * The result screen when the SERVER has decided to hold the result back (counselling first, or the partner has not
 * agreed to share yet). There is no category and no threshold: the API's withheld document is shown as it is, with the
 * way forward. The right not to know is not handled here; it has its own declared state (ResultExperience).
 */
export function WithheldResult({ envelope }: { envelope: ResultEnvelope }) {
  const t = useTranslations("result");
  const { disclosed, explainer } = envelope;
  const reason = disclosed.withheld_reason_key ?? "counselling_first";
  const layers = explainer ? splitLayers(explainer) : null;
  return (
    <div className="mx-auto grid max-w-[44rem] gap-6 py-6" data-testid="withheld">
      <section aria-labelledby="withheld-title" className="panel panel-attention">
        <div className="mb-3 flex items-center gap-3">
          <Cell fill="open" dashed size={18} />
          <p className="label m-0">{t("threshold.eyebrow")}</p>
        </div>
        <h1 id="withheld-title" className="m-0">
          {t("withheld.title")}
        </h1>
        <p className="measure mt-3 text-fg-2">{t(`withheld.${reason}`)}</p>
        {disclosed.certificate_note_key ? <p className="measure mt-2 text-sm text-fg-3">{t("withheld.certificate")}</p> : null}
        <Link href="/couple/sharing" className="btn btn-primary mt-4">
          {t("withheld.cta")}
        </Link>
      </section>
      {layers ? (
        <section aria-label={t("withheld.explanation")} className="panel-sunken">
          <Blocks blocks={[...(layers.headline ? [layers.headline] : []), ...(layers.lead ? [layers.lead] : []), ...layers.detail]} />
        </section>
      ) : null}
      {layers && layers.disclaimers.length > 0 ? (
        <div className="measure grid gap-2 border-t border-line pt-4 text-sm text-fg-2" data-testid="disclaimer">
          {uniqueByText([...layers.disclaimers, ...layers.trailing]).map((block, index) => (
            <p key={index} className="m-0">
              {block.text}
            </p>
          ))}
        </div>
      ) : (
        <BoundaryStrip />
      )}
    </div>
  );
}
