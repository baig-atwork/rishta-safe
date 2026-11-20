import { getTranslations, setRequestLocale } from "next-intl/server";
import "@/components/evidence/restack.css";
import { WrapId } from "@/components/evidence/WrapId";
import { PageHeader } from "@/components/ui/states";
import { Link } from "@/i18n/navigation";
import { settle } from "@/lib/api/server";
import { ApiError, problemFromUnknown } from "@/lib/api/transport";
import { callBackend } from "@/lib/api/upstream";

const ROWS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"] as const;
const LIMITS = ["1", "2", "3", "4", "5", "6"] as const;
const PRIOR = ["claims", "standards"] as const;
const SIMULATED = ["adapters", "data", "translation", "rules"] as const;
const DECLARATIONS = ["declData", "declText", "declNoLlm", "declLicences"] as const;

interface DeclarationEntry {
  id: string;
  title: string;
  file: string;
  summary: string;
}

async function loadDeclarations(): Promise<DeclarationEntry[]> {
  const result = await callBackend({ method: "GET", path: "/v1/governance/declarations" }, null);
  if (result.status < 200 || result.status >= 300 || !Array.isArray(result.body)) {
    throw new ApiError(problemFromUnknown(result.status, result.body, "The declarations could not be listed"));
  }
  return result.body as DeclarationEntry[];
}

export default async function GovernancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gov");
  const declarations = await settle(loadDeclarations);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} standfirst={t("standfirst")} />

      <div className="grid gap-14">
        <section id="clause-register" aria-labelledby="register-title" className="scroll-mt-20">
          <h2 id="register-title" className="m-0 mb-4 text-xl">
            {t("register.title")}
          </h2>
          <table className="tbl restack sm:min-w-0 [&_td]:py-3">
            <caption className="sr-only">{t("register.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("register.col.article")}</th>
                <th scope="col">{t("register.col.law")}</th>
                <th scope="col">{t("register.col.where")}</th>
                <th scope="col">{t("register.col.endpoint")}</th>
                <th scope="col">{t("register.col.test")}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row} className="align-top">
                  <th scope="row" className="whitespace-normal py-3 font-sans text-sm font-semibold normal-case tracking-normal text-fg">
                    {t(`register.rows.${row}.article`)}
                  </th>
                  <td data-label={t("register.col.law")} className="py-3">
                    {t(`register.rows.${row}.law`)}
                  </td>
                  <td data-label={t("register.col.where")} className="py-3 text-fg-2">
                    {t(`register.rows.${row}.where`)}
                  </td>
                  <td data-label={t("register.col.endpoint")} className="mono ltr whitespace-normal py-3 text-xs [overflow-wrap:anywhere]">
                    <WrapId id={t(`register.rows.${row}.endpoint`)} />
                  </td>
                  <td data-label={t("register.col.test")} className="py-3 text-fg-2">
                    {t(`register.rows.${row}.test`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <Link href="/judge" className="inline-flex min-h-10 items-center">
              {t("thirdCta")}
            </Link>
            <span className="text-fg-2">{t("thirdBody")}</span>
          </p>
        </section>

        <section id="data-declaration" aria-labelledby="decl-title" className="scroll-mt-20">
          <h2 id="decl-title" className="m-0 mb-4 text-xl">
            {t("declTitle")}
          </h2>
          <dl className="m-0 grid gap-0 border-b border-line">
            {DECLARATIONS.map((key) => (
              <div key={key} className="grid gap-1 border-t border-line py-3 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
                <dt className="font-semibold">{t(`${key}.title`)}</dt>
                <dd className="m-0 max-w-[72ch] text-fg-2">{t(`${key}.body`)}</dd>
              </div>
            ))}
          </dl>
          {declarations.error ? (
            <p role="status" className="mono m-0 mt-4 text-xs text-fg-3">
              {t("register.declarationsFailed")} {declarations.error.correlationId ?? ""}
            </p>
          ) : declarations.data.length > 0 ? (
            <div className="mt-5">
              <h3 className="label m-0 mb-2">{t("register.declarations")}</h3>
              <ul className="m-0 grid list-none gap-2 p-0">
                {declarations.data.map((doc) => (
                  <li key={doc.id} className="grid gap-0.5 text-sm md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
                    <span className="font-semibold">{doc.title}</span>
                    <span className="text-fg-2">
                      {doc.summary} <span className="mono ltr text-xs text-fg-3">{doc.file}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="sim-title">
          <h2 id="sim-title" className="m-0 mb-4 text-xl">
            {t("simTitle")}
          </h2>
          <dl className="m-0 grid gap-0 border-b border-line">
            {SIMULATED.map((key) => (
              <div key={key} className="grid gap-1 border-t border-line py-3 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
                <dt className="font-semibold">{t(`sim.${key}.term`)}</dt>
                <dd className="m-0 max-w-[72ch] text-fg-2">{t(`sim.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="limits" aria-labelledby="limits-title" className="scroll-mt-20">
          <h2 id="limits-title" className="m-0 mb-4 text-xl">
            {t("limitsTitle")}
          </h2>
          <ol className="m-0 grid max-w-[72ch] list-decimal gap-2 ps-6 text-fg-2">
            {LIMITS.map((key) => (
              <li key={key}>{t(`limits.${key}`)}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="prior-title">
          <h2 id="prior-title" className="m-0 mb-4 text-xl">
            {t("priorTitle")}
          </h2>
          <dl className="m-0 grid gap-0 border-b border-line">
            {PRIOR.map((key) => (
              <div key={key} className="grid gap-1 border-t border-line py-3 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
                <dt className="font-semibold">{t(`prior.${key}.title`)}</dt>
                <dd className="m-0 max-w-[72ch] text-sm text-fg-2">{t(`prior.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="reg-title">
          <h2 id="reg-title" className="m-0 mb-4 text-xl">
            {t("regTitle")}
          </h2>
          <div className="grid max-w-[72ch] gap-3 text-fg-2">
            <p className="m-0">{t("reg.1")}</p>
            <p className="m-0">{t("reg.2")}</p>
            <p className="m-0">{t("reg.3")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
