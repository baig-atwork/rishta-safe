"""Assemble report.html: the figure-led technical report.

    uv run --no-project --with pyyaml python build_report.py

Charts come from charts.py (drawn from scoreboard.json). The five diagrams are the SVG sources in docs/diagrams,
embedded inline (ids prefixed so that five copies of one pattern id cannot collide). The state machine is drawn from
the pathway data file, with its state and event counts asserted.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import charts as C  # noqa: E402

HERE = Path(__file__).parent
DIAGRAMS = Path(r"D:\dev\bayan\docs\diagrams")
PATHWAY = Path(r"D:\dev\bayan\backend\src\bayan\data\pathway.yaml")


def load_diagram(name: str, prefix: str) -> str:
    s = (DIAGRAMS / name).read_text(encoding="utf-8")
    for i in set(re.findall(r'\bid="([^"]+)"', s)):
        s = s.replace(f'id="{i}"', f'id="{prefix}{i}"').replace(f"url(#{i})", f"url(#{prefix}{i})")
    s = re.sub(r'aria-labelledby="([^"]+)"', lambda m: 'aria-labelledby="' + " ".join(prefix + t for t in m.group(1).split()) + '"', s)
    s = re.sub(r'(<svg[^>]*?) width="\d+" height="\d+"', r"\1", s, count=1)
    return s


def fig(n: int, art: str, shows: str, not_shows: str, cls: str = "") -> str:
    return (
        f'<figure class="{cls}"><div class="art">{art}</div><figcaption><span class="fn">Figure {n}.</span> '
        f'<span class="k">Shows:</span> {shows} <span class="k">Does not show:</span> {not_shows}</figcaption></figure>'
    )


def tcap(n: int, shows: str, not_shows: str) -> str:
    return f'<div class="tcap"><span class="fn">Table {n}.</span> <span class="k">Shows:</span> {shows} <span class="k">Does not show:</span> {not_shows}</div>'


def table(headers: list[str], rows: list[list[str]], classes: list[str] | None = None, cls: str = "", widths: list[int] | None = None) -> str:
    classes = classes or [""] * len(headers)
    cg = ("<colgroup>" + "".join(f'<col style="width:{w}%">' for w in widths) + "</colgroup>") if widths else ""
    th = "".join(f'<th class="{c}">{h}</th>' for h, c in zip(headers, classes))
    body = "".join("<tr>" + "".join(f'<td class="{c}">{v}</td>' for v, c in zip(r, classes)) + "</tr>" for r in rows)
    return f'<table class="{cls}{" fixed" if widths else ""}">{cg}<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def sec(no: str, title: str, inner: str, cls: str = "") -> str:
    return f'<section class="{cls}"><h2><span class="no">{no}</span>{title}</h2>{inner}</section>'


M = C.M
sb = C.sb

# ------------------------------------------------------------------------------------------------ cover
n_measured = sum(1 for m in sb["metrics"] if m["status"] == "measured")
n_notrun = sum(1 for m in sb["metrics"] if m["status"] == "not_run")
tally = "".join('<i></i>' if m["status"] == "measured" else '<i class="h"></i>' for m in sb["metrics"])
gen = sb["generated_at"][:16].replace("T", " ")

cover = f"""
<section class="cover">
  <div class="lead"><div class="kicker">Technical report &nbsp;/&nbsp; Challenge 03</div>
  <h1>Rishta Safe</h1>
  <div class="sub">Technical report</div>
  <p class="purpose">An education and decision-support companion for the UAE premarital genetic-screening pathway: it explains a reported result in plain English, Arabic and Urdu, shows who may see what, and hands complex cases to a human by fixed rule. Synthetic data only.</p></div>
  <div class="tally">{tally}</div>
  <div class="tallycap">{len(sb['metrics'])} scoreboard measures: {n_measured} run on synthetic data (solid), {n_notrun} not run (hatched).</div>
  <div class="status">
    <div class="hd">Status in one box</div>
    <div class="row"><div class="l">Prototype on made-up data</div><div class="r">Every person, result and timeline is synthetic. It is not a medical device, a diagnosis or clinical advice.</div></div>
    <div class="row"><div class="l">Not clinically reviewed</div><div class="r">Every clinical rule, cut-off and detection rate awaits sign-off from the clinical lead (sign-off pending). Arabic and Urdu text is machine-drafted with no native clinical review. No comprehension study, field validation or real data stands behind it.</div></div>
    <div class="row"><div class="l">No hosting claim</div><div class="r">Nothing is deployed. The demo is shown running locally. Every outside system is simulated and labelled.</div></div>
  </div>
  <div class="note"><b>On the name.</b> &ldquo;Safe&rdquo; in Rishta Safe is not a safety or compatibility verdict on a couple. No screen, label or score tells anyone whether to marry, and the three result labels are not a severity scale.</div>
  <div class="meta">
    Abu Dhabi Future Health Digital Innovation Challenge &middot; Challenge 03, Understanding and Reducing Inherited Disease Risk<br>
    Version of 2026-11-20 &middot; code version <span class="mono">{sb['code_version']}</span> &middot; evidence file generated {gen} UTC, data label &ldquo;{sb['data_label']}&rdquo;<br>
    <b>To skim in three minutes:</b> this page, page 2, and the opening figure of each section. <b>To verify:</b> appendix A (commands) and appendix B (where each number comes from).
  </div>
</section>
"""

# ------------------------------------------------------------------------------------------------ page 2
page2 = f"""
<section class="p2">
  <h2><span class="no">THE CASE IN ONE PAGE</span>A narrow tool, with its weakest number first</h2>
  <div class="three">
    <div><h3>The problem</h3>
      <p>Screening helps only if people understand a carrier or couple-level result, reach qualified counselling and choose in line with their own values, without one family member&rsquo;s information reaching another unasked. The organisers supply no data, so everything here is built and measured on made-up couples.</p></div>
    <div><h3>What it does</h3><ul>
      <li>Explains a result a licensed programme has already reported, in three languages, from reviewed templates.</li>
      <li>Shows who may see what under each emirate&rsquo;s published rule.</li>
      <li>Escalates to a human by 21 fixed rules.</li>
      <li>Follows the real pathway (15 states) and closes the loop with a clinician proforma.</li></ul></div>
    <div><h3>What it does not do</h3><ul>
      <li>Screen, test, diagnose, certify or counsel.</li>
      <li>Give a marriage decision, a score or a residual-risk number.</li>
      <li>Run a language model at run time.</li>
      <li>Connect to any real system, or claim to be hosted.</li></ul></div>
  </div>
  <div class="callout"><b>Read the weakest number first.</b> The refusal check refused 36 of 59 held-out prompts on its first run (61%). The rows at 100% are a regression gate, not safety evidence: the same team wrote both sides of every comparison. Two of eleven measures were not run, so no comprehension or clinical-validity claim is made.</div>
  {fig(1, C.chart_evidence(),
       "all eleven scoreboard measures, the weakest figure first, drawn from the scoreboard file by a script. Measure IDs M1 to M9 are used throughout.",
       "that any figure is clinically right. The 100% rows compare an implementation with another written by the same team on synthetic data; M7 is scripted timing against an illustrative standard, so it is a description and not a test of the product. Per-category refusal and per-language readability are not in the scoreboard, so they are not drawn.")}
</section>
"""

# ------------------------------------------------------------------------------------------------ section 1
s1_table = table(
    ["#", "Challenge item", "What was built", "Evidence", "What it does not show"],
    [
        ["1", "Plain, non-stigmatising explanation, with uncertainty and the risk-versus-diagnosis line",
         "Result in three languages from reviewed templates, read together in both partners&rsquo; languages side by side; a 100-cell tally grid; detection limits; a related-couple caveat; a boundary notice",
         "M2, M2b, M3", "That anyone understands it: no comprehension study; Arabic and Urdu are drafts"],
        ["2", "Informed, values-sensitive choices without directing",
         "Options pane in fixed article order; a four-way choice before any result is rendered; three labels; no marriage-decision field",
         "M2, M6", "That a clinician or user finds the wording neutral; screening access is a simulated hand-off"],
        ["3", "Qualified human counselling; the education versus advice boundary",
         "21 deterministic triggers in two tiers; a counsellor queue and one-page brief; a refusal classifier",
         "M4, M6", "Clinical sensitivity of the triggers; refusal of paraphrase (61% on the held-out first run)"],
        ["4", "Privacy-preserving family workflows",
         "Append-only consent ledger; role-based disclosure; two emirate policies; hash-chained audit; third-party refusals",
         "M5", "Legal completeness; sharing with relatives (cut); durable storage"],
        ["5", "Linkage to services",
         "15-state, 20-event pathway from the two standards; FHIR-shaped referral tasks; a 12-field proforma; outside systems simulated",
         "M7; a property test over random event sequences", "Integration, or real referral performance"],
        ["6", "Measurable comprehension and access; cancelled marriages are not the measure",
         "A scoreboard of 11 measures (9 run, 2 not run); a five-item teach-back per result type; programme aggregates",
         "M1 to M9", "Comprehension, uptake or equity by language and literacy: M8 was not run"],
    ],
    ["id", "", "", "", ""], widths=[3, 23, 38, 14, 22],
)
sec1 = sec("1 / THE CHALLENGE", "The six items of Challenge 03, and what answers each",
    s1_table + tcap(1, "each challenge item against what we built, the scoreboard rows that evidence it and what they cannot show.", "outcomes in any real programme: the organisers supply no data.") +
    """<ul>
    <li>The entry is deliberately narrow: it explains a result a licensed programme has already reported, shows who may see what, escalates by rule, tracks the pathway and closes the loop. It does not screen, test or counsel.</li>
    <li>Views exist for a couple member, a counsellor, a clinician, a programme operator (aggregates only) and a read-only evaluator. Every result screen states that it is education and decision support, never clinical advice.</li>
    <li>It does not hide data from the state, which is a statutory recipient (Federal Decree-Law 49/2023 Art. 26(2)), and it is not connected to Emirates Health Services, Malaffi, the Emirati Genome Programme, DoH or DHA: every such connection is simulated and labelled.</li>
    <li>We do not claim to be first at laboratory-value interpretation. We claim a traceable rule trace, and a record of what each number does not show.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 2 architecture
arch_fig = fig(
    2, load_diagram("01-system-architecture.svg", "a1"),
    "who reaches the system, the one server trust boundary, the numbered path of one request (1 to 5), the six domain packages, versioned data files, state in memory, and the simulated outside systems.",
    "deployment: nothing is hosted, and the diagram says nothing about where it would run. It does not show performance, scale or a database, none of which exist.",
    "arch")
sec2 = sec("2 / ARCHITECTURE", "Pure-domain packages behind one composition layer", arch_fig + """<ul>
    <li><b>One caller across packages.</b> Genetics computes and never decides who sees what; governance decides and never words anything; explain words and never computes. Only the composition layer calls across them.</li>
    <li><b>Small and typed.</b> Backend on Python 3.13 (FastAPI, Pydantic v2, structlog, uv) with eight runtime dependencies, none a model client. 44 operations on 40 paths under <code>/v1</code> plus three health routes; errors are RFC 9457 problem details with a correlation id.</li>
    <li><b>State in memory</b> behind small repository classes, so a database adapter can replace them (parked). The demo is seeded, resettable and single-replica; the clock is injected, so every timing is simulated.</li>
    <li><b>No text is generated at run time.</b> A numeric hallucination in a genetic result is the worst failure available; the best verifier we found agreed with clinicians only 89 to 93 percent of the time; Arabic and Urdu model output cannot be measured honestly without native reviewers. The cost is less fluent text and slower growth of wording. A cloud language model may have helped draft static template text and AI coding assistants helped write code and documents: both are declared, no personal or realistic data went to either, and the provider&rsquo;s output terms were not reviewed.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 3 result engine
labels = """<div class="labels">
<div><code>shared_result_found</code>A shared finding was found on the tested panel. Not a verdict on the couple.</div>
<div><code>no_shared_change_found</code>None found on this panel. Shown with a detection rate and its limits, never a residual-risk number.</div>
<div><code>more_information_needed</code>No statement can be made yet. A pending report, a blood count only or a variant of uncertain significance ends here.</div></div>"""
sec3 = sec("3 / THE RESULT", "One result, end to end: three closed labels, no scale",
    fig(3, load_diagram("02-data-flow-one-result.svg", "a2"),
        "the path of one reported result through the rules engine, the threshold choice, the disclosure filter, the explainer and its checker, and the audit row each step writes or does not write.",
        "any model: there is none. It does not show a real laboratory feed, which is simulated.") +
    """<ul>
    <li><b>Natural frequencies, fixed denominator.</b> Two carriers of one recessive condition: 25 affected, 50 carrier and 25 neither per 100 pregnancies, as integers; X-linked conditions give lines per 100 sons and per 100 daughters. Carriers of different conditions at the haemoglobin beta locus pair into a compound disorder.</li>
    <li><b>Never counted as a result:</b> a variant of uncertain significance. A pending report or a blood-count-only work-up can never give a shared or no-shared statement, and a locus is compared only when both panels cover it.</li>
    <li><b>Staff see more, couples do not.</b> A review priority (routine, priority, urgent) is for staff only; the severity tiers and priorities are our own illustrative rules awaiting sign-off.</li>
    <li><b>Why the vocabulary is closed:</b> the programme&rsquo;s own words can read as a verdict on a couple. Banned-word lists in three languages (38, 38 and 32 terms plus match patterns) are enforced by the checker.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 4 haem + limits
haem_tbl = table(
    ["", "Haematology aid (clinician-facing)", "Negative results and related partners"],
    [
        ["What it does",
         "From a blood count, and optionally an HPLC result, returns one of 11 labels (3 for a blood count alone, 8 with HPLC), the rules fired with their source, and a not-a-diagnosis notice. 24 rules from six cited entries (an NHS England antenatal laboratory handbook, the 2023 British Society for Haematology guideline, a Thalassaemia International Federation guide and an Italian best-practice paper, among others), run in a whitelisting <code>ast</code> interpreter, never <code>eval</code>. Missing values are never imputed.",
         "A negative result is shown as a detection rate and its limits, never a residual-risk number. Panel detection rates are assumed (90 and 95 percent) and flagged illustrative."],
        ["Why a caveat",
         "A blood count alone cannot yield a carrier, normal or disease label; the loader refuses it.",
         "For related partners a missed variant is shared by descent, so the naive per-partner update overstates reassurance. Our internal closed form (returned by no route) gives an understatement of 16.8 times for first cousins at carrier frequency 0.02 and assumed detection 0.8, and 63.7 times at 0.005. Every related-couple statement carries the caveat and no figure."],
        ["Limits",
         "Sources disagree on four parameters (MCV cut-off, borderline HbA2, iron deficiency first, post-transfusion wait); the rules extrapolate from England antenatal guidance to non-pregnant adults; alpha-thalassaemia needs DNA; the 20 fixtures were written by the rules&rsquo; author, so they show internal consistency only.",
         "The derivation is ours and has not been reviewed by a statistician. The 16.8 and 63.7 figures are computed from assumed inputs."],
    ],
    ["id", "", ""],
)
sec4 = sec("4 / TWO LIMITS", "The haematology aid and the limits of a negative result",
    haem_tbl + tcap(2, "what the haematology aid does and where it stops, beside why a negative result for related partners carries a caveat and no figure.",
                    "clinical correctness: every rule awaits sign-off from the clinical lead (sign-off pending), and the understatement factors have no statistical review.") +
    "", "cont")

# ------------------------------------------------------------------------------------------------ section 5 pathway
timers = table(
    ["Timer", "Value", "Source and status"],
    [
        ["Laboratory work starts", "within 24 hours", "Both standards"],
        ["Genetic result due", "21 days (Abu Dhabi) or 28 days (Dubai)", "The standards disagree, so the value is set per emirate policy, never hard-coded"],
        ["Certificate valid", "three months", "Both standards"],
        ["Referral to a counsellor", "a 90 percent target share; no time limit exists", "Abu Dhabi tracks the share. Our 14-day timer is illustrative"],
    ],
    ["", "", ""], "tight",
)
sec5 = sec("5 / THE PATHWAY", "Modelled from the two published standards",
    fig(4, C.chart_pathway(PATHWAY),
        "the 15 states and the state changes between them, in three rows: screening; result and counselling; certificate and closure. Names are as they appear in the pathway data file.",
        "the five side events (brief generated, confirmatory test ordered and resulted, specialist referral requested and completed), which change no state; the return of a rejected referral to counselling_pending; or the permissions on each event. Nothing here is a real integration.") +
    timers + """<ul>
    <li>Structure and times follow the Department of Health Abu Dhabi Premarital Screening Standard V3 (September 2024) and the Dubai Health Authority Standards for Premarital Screening Services V1 (effective 27 March 2026). We wrote original wording citing the clause followed and did not copy forms, layouts, risk statements or the gene list.</li>
    <li>The screening visit is a simulated hand-off to a licensed centre; neither standard has home collection. A partner who declines to share leads to <code>certificate_withheld</code>, the tension both standards describe, shown rather than hidden.</li>
    <li>Seven outside systems are simulated and labelled in all three languages. Referral tasks are shaped like an HL7 FHIR R5 Task; no FHIR server exists. Four invariants are property-tested over random event sequences: no flagged couple without a counselling task; a rejected or failed task spawns a replacement; no case closes with an open task or, if flagged, without a clinician proforma; times never go backwards.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 6 disclosure
policy = table(
    ["", "Abu Dhabi policy", "Dubai policy"],
    [
        ["Report form", "One joint report: after post-test counselling the couple-level label reaches both partners.",
         "A <code>shared_result_found</code> is withheld from a member until every other member with an abnormal finding has granted at least <code>couple_result_only</code>."],
        ["Under both", "A shared label waits for recorded counselling (for Dubai a labelled product safeguard; the text is unconfirmed).", ""],
    ],
    ["id", "", ""], "tight",
)
dubai = table(
    ["Dubai case, two carriers", "First member sees", "Second member sees"],
    [
        ["Before any grant", "awaiting partner consent", "awaiting partner consent"],
        ["After the first grants the second", "still waiting", "<code>shared_result_found</code>"],
        ["After both grant", "<code>shared_result_found</code>", "<code>shared_result_found</code>; the certificate note disappears"],
    ],
    ["", "", ""], "tight",
)
sec6 = sec("6 / DISCLOSURE", "Who sees what, and what is recorded",
    fig(5, load_diagram("03-who-sees-what.svg", "a3"),
        "each role and what it may see, the fixed columns set by law, and the audit ledger that records every decision.",
        "legal completeness: several triggers still need a legal read against Federal Decree-Law 49/2023. Authentication is simulated.") +
    policy + dubai + tcap(3, "the two emirate policies, and an in-process run of the seeded Dubai case with two carriers on 2026-11-20.", "a real programme, or any real person: the case is synthetic.") +
    """<ul>
    <li><b>Consent ledger.</b> Append-only: a grant is one line, a revocation another. Scopes are <code>couple_result_only</code>, <code>gene_names_only</code> and <code>full_variant_detail</code>, none by default. Mandatory couple screening is not consent-based (Art. 4(2)(a), 15); it is recorded with a statutory basis that grants nothing and cannot be revoked. Revocation stops disclosure and deletes nothing: the Art. 8 deletion workflow is cut.</li>
    <li><b>Right not to know</b> (Art. 9(2)) removes everything result-related from that person&rsquo;s view. Where life may be threatened the statute compels disclosure but does not say an app must deliver it, so the app view stays withheld and an accredited professional is alerted, flagged for a legal read.</li>
    <li><b>Audit chain.</b> Each event stores the SHA-256 of its canonical JSON and the previous hash, with pseudonymous ids and no free text. Tests tamper with, reorder, delete from and insert into it. It cannot detect truncation of its tail without an external anchor, which is not built, and it is held in memory.</li>
    <li><b>Third parties.</b> An employer, insurer or relative request is always refused with HTTP 403 citing Art. 19 to 21, and logged.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 7 escalation + refusal
esc_tbl = table(
    ["Escalation library", "Count", "Notes"],
    [
        ["Named deterministic triggers", "21", "Each has a source or &ldquo;design rule&rdquo;, a tier and a due-by key, and is flagged as needing the clinical lead&rsquo;s sign-off"],
        ["Tier: counsellor", "8", "The federal programme&rsquo;s counsellors are trained physicians, not genetics professionals, hence two tiers"],
        ["Tier: accredited geneticist", "13", "Ten triggers in all carry a legal-read flag"],
        ["Due-by keys", "4", "<code>immediate</code>, <code>same_session</code>, <code>fast_track</code>, <code>routine</code>: never days, because time targets belong to the clinical lead"],
        ["Refusal patterns", "102", "39 English, 32 Arabic, 31 Urdu; all applied to every request because people code-switch"],
    ],
    ["", "num", ""], "tight",
)
sec7 = sec("7 / ESCALATION AND REFUSAL", "Hand off to a human; refuse what the product must not answer",
    fig(6, C.chart_refusal(),
        "one cell per prompt in the refusal check. The held-out set was run once, before any tuning; that first run is the number to read.",
        "per-category or per-language results (not recorded in the scoreboard), or any paraphrase it was not asked. The prompt sets are synthetic and written by the same engineer as the patterns.") +
    esc_tbl + """<ul>
    <li><b>Refused:</b> diagnosis, treatment advice, &ldquo;should we marry&rdquo;, termination advice, lineage inference, employer and insurer questions, and another person&rsquo;s result; marriage, termination, lineage and other-person requests also notify a counsellor. The classifier is keyword and pattern matching, not language understanding.</li>
    <li><b>The honest number</b> is the held-out first run: 36 of 59 refused (61%), none of 20 benign prompts wrongly refused. The 23 misses are natural paraphrases and stay in the set. Nothing generates free text, so a miss fails to route a distressed or high-impact question to a counsellor, which is why escalation also reads distress phrases in three languages.</li>
    <li>The counsellor brief is one page of facts and sources and makes no recommendation. M4 measures implementation consistency, not clinical sensitivity.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 8 explainer closure
expl = table(
    ["Part", "What it is", "Limits"],
    [
        ["Explainer", "83 templates and 34 glossary terms per language with typed slots and no typed digits; ids and slots match across languages, checked at load.", "English is a draft too: every template carries a draft status and every document opens with a draft notice."],
        ["Checker", "Printed digits (Western and Arabic-Indic forms normalised) must equal declared numbers, which must equal engine numbers; wording must match the label; banned words are refused. <code>render</code> raises on any failure. A mutation test injects faults with 11 operators.", "Faults of a kind we did not think of are not counted (M2b)."],
        ["Clinician proforma", "12 fields and one optional note, anchored on the UK PRSB outpatient letter standard and HL7 FHIR Task. No marriage field.", "A structure, not a clinical protocol."],
        ["Patient items", "Eight original items scored item by item with no total, and an optional single-item literacy stratifier. Five named instruments are not shipped: their terms bar it, or none were found. Service interest is opt-in; no marriage intention or outcome is recorded.", "No validated instrument is used."],
        ["Teach-back", "Five items for each of three result types in three languages. Every quiz object carries <code>human_comprehension_test_run: false</code>.", "No human test was run (M8)."],
    ],
    ["id", "", ""], "tight",
)
sec8 = sec("8 / EXPLAINER AND CLOSURE", "Reviewed wording, a checker that can refuse, and closure",
    expl + tcap(4, "the explainer, its checker and the closure instruments in one view.", "clarity or correctness of the Arabic and Urdu text: no native clinical reviewer has read it. Readability of the English text is Figure 7 in section 9.") +
    "", "cont")

# ------------------------------------------------------------------------------------------------ section 9 evaluation
method = table(
    ["ID", "Method, in one line", "Run size", "Does not show"],
    [
        ["M1", "Couples generated by gene dropping through five relatedness pedigrees with ground-truth genotypes; an allele-level oracle sharing no helper code classifies each; category, shared conditions and outcome lines must match exactly.", "20,000 couples; seed 20261120; interval 0.9998 to 1.0", "Same team wrote both; not clinical correctness"],
        ["M1b", "Unrelated couples under Hardy-Weinberg; share with at least one autosomal locus where both carry a pathogenic allele, against the independent closed form.", "20,000 couples", "A validation; the panel is small"],
        ["M2", "Every scenario rendered in English, Arabic and Urdu, then checked for number fidelity, polarity and banned words.", "768 documents (256 scenarios x 3)", "Clarity; Arabic and Urdu correctness"],
        ["M2b", "Flipped numbers, flipped polarity and inserted banned words injected into rendered text; the checker must reject each.", "5,760 faults", "Fault types not listed"],
        ["M4", "Must-escalate and must-not-escalate cases generated deterministically from the trigger definitions.", "400 must-escalate cases", "Clinical sensitivity"],
        ["M5", "Random sequences of roles, grants, revocations, expiries, right-not-to-know and policy choices; each decision compared with a short reference model that imports no policy code; every allowed view scanned for text it should not contain; broken rule sets must be caught.", "2,000 sequences, 30,527 decisions (13,772 allowed, 16,755 denied), 10 of 10 broken rule sets caught", "Legal completeness"],
        ["M6", "Keyword and pattern matching on prompts asking for a diagnosis, whether to marry or cancel, termination advice, lineage inference, or employer or insurer access.", "59 held-out must-refuse, 20 benign; 70 tuned; 179 in all", "Meaning: keywords only; paraphrase is missed"],
        ["M7", "Computed from the stored synthetic cases on a backdated clock. The 57% is 4 of the 7 flagged cases among the 10.", "10 cases, 7 flagged", "Real programme performance"],
    ],
    ["id", "", "", ""], "tight", widths=[5, 50, 22, 23],
)
caveats = "".join(f"<li>{c}</li>" for c in sb["caveats"])
sec9 = sec("9 / THE EVALUATION", "Eleven measures, nine run, two not: the figures behind Figure 1",
    fig(7, C.chart_readability(),
        "the Flesch-Kincaid grade of every rendered English document (M3), with the Arabic and Urdu drafts marked not measured.",
        "understanding. The grade uses a syllable heuristic (about one grade of error). No validated Arabic or Urdu readability standard exists, so none is computed or claimed; reading level there needs human lay readers. Per-template and per-document grades are not in the scoreboard.") +
    fig(8, C.chart_timing(),
        "M7 on the 10 seeded synthetic cases: the share of flagged cases referred within the standard, and the median time to result.",
        "a distribution: the scoreboard holds only the median and the share. The median is not the standards&rsquo; own measure (not more than 21 days in more than 90 percent of cases in Abu Dhabi; about four weeks in Dubai), so the markers are not a pass or fail. Event times come from a backdated clock.") +
    fig(9, C.chart_mating(),
        "M1b: observed against the closed form for the demo panel, with two published figures as hatched context.",
        "a validation. The demo panel is small and illustrative and the published figures use different panels and definitions.") +
    fig(10, C.chart_strip(), "what the scoreboard measures, and what no figure in this report covers.", "the size of any gap: hatched rows have no figure at all.") +
    """<p class="small">How each measure was run, its run size and the scoreboard&rsquo;s own caveats are in appendix C.</p>""", "")

# ------------------------------------------------------------------------------------------------ section 10 interface
screens = table(
    ["Screen", "What it does"],
    [
        ["Case bench", "Ten seeded synthetic cases, listed by what each tests, crossed with role lenses (partner 1, partner 2, counsellor, clinician)."],
        ["Threshold", "Before a result is rendered each person chooses: read now, with a counsellor first, not yet, or prefer not to know. Nothing is preselected; only &ldquo;prefer not to know&rdquo; is written to the server."],
        ["Read together", "The same result text in both partners&rsquo; languages side by side, from two locale calls."],
        ["Who sees what", "A visibility matrix: only the partner column is the person&rsquo;s own switches; the care team, national genomic database, employer and insurer columns are fixed and cite the articles."],
        ["Evidence", "Seven live probes against the real endpoints (an employer request, an insurer request, a wedding question, a distress sentence, another couple&rsquo;s result, a blood count only, free text), each showing request, response and audit row; below them the scoreboard."],
        ["Staff instrument", "Queue, one-page brief and trace pane side by side; every brief line links to its rule and source; nothing is generated."],
    ],
    ["id", ""], "tight",
)
sec10 = sec("10 / THE INTERFACE", "A registry-style web app in three languages",
    fig(11, C.chart_routes(),
        "gzip JavaScript per route on a production build in mock mode, against a 170 KB budget. Three routes are over it; closure and clinician were already over before the redesign because of the form libraries, and lazy-loading them is parked.",
        "a throttled mobile profile: the figures are from a local build. Largest Contentful Paint was under 0.4 s and layout shift under 0.012 locally, also unthrottled.") +
    screens + tcap(5, "the six main screens.", "the programme page (three figures and simulated stamps, aggregates only) or the haematology instrument (two panes, with the rule trace as a table).") +
    """<ul>
    <li><b>Stack and look.</b> Next.js 16, React 19, strict TypeScript 6, Tailwind CSS 4, next-intl for English and right-to-left Arabic and Urdu. The Registry Grid direction: cool white pages, one lapis accent, hairlines instead of shadows; its signature is the tally grid, in which solid, hatched, open and dashed cells give each state a second channel beside colour. Fonts are self-hosted under the SIL Open Font Licence.</li>
    <li><b>Checks, local machine, 2026-11-20.</b> Typecheck and lint clean; 417 unit tests pass (11 live tests skipped unless a backend is named); 62 end-to-end tests pass with 3 skipped in mock mode, and 63 pass with 2 skipped against the real backend. 516 backend tests pass; ruff clean; mypy strict reports no issues.</li>
    <li><b>Accessibility.</b> Automated axe checks (WCAG 2 A and AA, and WCAG 2.2 AA rules) pass on the routes the end-to-end suite visits. That is an automated check only, not an audit: no manual audit or assistive-technology user test is recorded.</li></ul>""")

# ------------------------------------------------------------------------------------------------ section 11 + 12
notdone = table(
    ["Not done", "Why"],
    [
        ["Private set intersection", "The output leaks and the state is a statutory recipient; privacy here is horizontal."],
        ["A runtime language model; a residual-risk number, score or pre-test risk; a marriage-decision field", "Numeric hallucination risk and unmeasurable Arabic and Urdu output; no honest figure exists; the product must not direct a decision."],
        ["Named instruments, the standards&rsquo; text and gene list, bulk third-party data", "Licence terms bar them."],
        ["Family cascade invitations", "They need a channel, an identity and a legal read."],
        ["Durable storage, an audit-head anchor, Art. 8 deletion, production authentication", "Data is synthetic and held in memory."],
        ["Semantic or Roman-script refusal", "Not evaluated."],
        ["Home collection, a Pakistan variant, voice entry", "No basis in either standard, and no honest way to measure speech."],
        ["A human comprehension test", "No ethics determination (M8)."],
        ["Native review of Arabic and Urdu, including the new interface text; clinical sign-off; legal reads; a statistician&rsquo;s review", "Not done. The evidence figures and staff brief are English only and marked so."],
        ["A server-side record of every threshold choice", "Only &ldquo;prefer not to know&rdquo; is recorded; the other three stay in the browser and do not follow a person to another device."],
        ["A sourced carrier frequency for the flagship gene", "The carrier frequency behind the flagship case is illustrative."],
        ["Bringing three routes under the JavaScript budget", "Parked (Figure 11)."],
        ["A deployed demo", "No hosted resource exists; the cloud subscription refused the capacity requested in the regions tried."],
    ],
    ["", ""], "tight",
)
sec11 = sec("11 / WHAT WE DID NOT DO", "Cuts and gaps, each with its reason", notdone + tcap(6, "what was cut or left undone and why.", "the order of importance: the first rows are architectural choices, the last are gaps. Each cut has a written decision record in the repository (82 files); this report gives the reason and leaves the numbering out."), "cont")

pilot = fig(12, load_diagram("05-pilot-path.svg", "a5"),
    "five gates, none yet done, then a shadow pilot beside a licensed facility in which no result reaches a couple through Rishta Safe.",
    "a pilot site, a buyer or any dated plan: none was contacted or agreed.")
sec12 = sec("12 / THE PRODUCTION PATH", "A shadow pilot after five gates, and what engineering remains", pilot + """<ul>
    <li><b>Gates before anyone sees it:</b> an ethics determination by the DoH research ethics committee; the clinical lead&rsquo;s sign-off; native clinical review of Arabic and Urdu; the outstanding legal reads against Decree-Law 49/2023; the facility&rsquo;s ADHICS and Responsible AI risk assessment; and an independent privacy audit.</li>
    <li><b>Pilot measures:</b> the 90 percent referral target, time to counsellor brief, teach-back comprehension with intervals, and escalation recall against a clinician-labelled set. Cancelled marriages are never a measure.</li>
    <li><b>Engineering remaining:</b> an identity provider (UAE PASS or Emirates ID for couples, the facility&rsquo;s sign-on for staff); a Postgres adapter with reversible migrations, row-level security and append-only audit storage with an anchored head hash; monitoring beyond JSON logs.</li>
    <li><b>Hosting.</b> Nothing is hosted. Federal Law 2/2019 Art. 13 and the DoH Responsible AI Standard cl. 3.1.4.5.1 (the first read from secondary summaries) point to keeping identifiable data and compute within the country, and no run-time model call exists that could send data abroad. The demo is shown running locally.</li>
    <li><b>Commercial path:</b> a hypothesis, with no buyer contacted, a labelled pricing assumption and no revenue figure.</li></ul>""", "cont")

# ------------------------------------------------------------------------------------------------ appendices
repro = """<pre>cd backend
uv sync
uv run pytest -q
uv run ruff check src tests scripts
uv run mypy
uv run python scripts/run_evaluation.py     # regenerates the scoreboard file (writes it)
cd ../frontend
pnpm install --frozen-lockfile
pnpm typecheck; pnpm lint; pnpm test
pnpm build; pnpm test:e2e                  # mock mode: fixtures only, no backend
pnpm test:e2e:real                         # needs the backend running
docker compose up --build                  # web app on port 3000, API on port 8000</pre>
<p class="small">Start commands for the API, and the variables that point the web app at it or switch it to fixtures, are in the repository runbook and are not reproduced here. A clean-container <code>pnpm install --frozen-lockfile</code> failed earlier on 2026-11-20; a fix is recorded and not re-run. The seed is 20261120 wherever one applies.</p>"""
counts = table(
    ["What", "Count", "How counted"],
    [
        ["Backend tests", "516 passed", "<code>uv run pytest -q</code>"],
        ["Frontend checks", "417 unit passed, 11 live skipped; 62 end-to-end passed, 3 skipped (mock); 63 passed, 2 skipped (real backend)", "<code>pnpm test</code>; <code>pnpm test:e2e</code>; <code>pnpm test:e2e:real</code>"],
        ["API", "44 operations on 40 paths under /v1, plus 3 health routes", "<code>create_app().openapi()[&quot;paths&quot;]</code> counted"],
        ["Data files", "Pathway: 15 states, 20 events, 7 simulated systems. Escalation: 21 triggers (13 geneticist tier, 8 counsellor tier; 10 with a legal-read flag). Refusal patterns: 102 (39 en, 32 ar, 31 ur). Explainer: 83 templates, 34 glossary terms per language, banned terms 38, 38, 32, 11 mutation operators. Haematology: 24 rules, 20 fixtures, 11 labels. Catalogue: 15 conditions, 2 panels (assumed detection 0.9 and 0.95). Closure: 12 proforma fields, 8 patient items, 5 quiz items per result type", "Each data file loaded via PyYAML and counted; <code>run_explain_evaluation()</code> for the operators"],
        ["Closed form", "Understatement for related couples: 16.8 and 63.7 times", "<code>residual.understatement_factor(0.02, 0.80, 1/16)</code> and <code>(0.005, 0.80, 1/16)</code>"],
        ["Dependencies; demo", "8 runtime, none a model client; 10 demo cases and 24 personas (4 staff, 20 couple members)", "Project dependency list; <code>GET /v1/demo/personas</code>, in process"],
    ],
    ["id", "", ""], "tight", widths=[18, 52, 30],
)
appA = sec("APPENDIX A", "Reproducibility: commands and counts", repro + counts)

clauses = table(
    ["Clause", "What it says (our reading)", "Where it shows up"],
    [
        ["Decree-Law 49/2023 Art. 4(2)(a), 15", "Mandatory couple screening is not consent-based", "Recorded with a statutory basis that grants nothing and cannot be revoked"],
        ["Art. 7(1)", "Counselling by a specialist physician or genomics specialist", "The product does not counsel; two escalation tiers hand off to people"],
        ["Art. 8", "Deletion", "Workflow cut; revocation stops disclosure and deletes nothing"],
        ["Art. 9(1), 9(2)", "Each person may request their own results; a right not to know", "A couple member sees their own findings; the threshold option, recorded on the server, removes result content from view"],
        ["Art. 9", "No ancestry or lineage inference", "The refusal classifier refuses lineage inference"],
        ["Art. 11, 12", "Options a person is told about", "Options pane, in a fixed neutral order with article citations"],
        ["Art. 19 to 21", "Employers and insurers may not require or use results", "Third-party requests refused with HTTP 403 and logged"],
        ["Art. 25(3)", "No publishing programme statistics", "No national statistics generated or shown; programme view is aggregates of synthetic cases"],
        ["Art. 26(2)", "The state is a statutory recipient", "National genomic database column fixed in the matrix; never hidden"],
        ["Abu Dhabi 3.3.12.1, Dubai 9.1.10b", "Certificate withheld if a partner refuses to share or sign", "The <code>certificate_withheld</code> state"],
        ["Abu Dhabi 3.8, 3.8.6, 3.3.10.5; Dubai 11.5.1, 11.5.6, 9.1.9", "Laboratory work starts within 24 hours; genetic result in 21 days in more than 90 percent of cases (Abu Dhabi) or about four weeks (Dubai); report valid for three months", "The laboratory-start, genetic-result (set per emirate policy) and certificate-validity timers"],
        ["Abu Dhabi section 5, Table 1", "90 percent target for referring positive genetic cases to a counsellor", "Programme KPI and M7"],
        ["Federal Law 2/2019 Art. 13; DoH Responsible AI Standard cl. 3.1.4.5.1", "Point to keeping identifiable data and compute within the country (the Federal Law read from secondary summaries)", "No run-time model call; no hosting claim"],
        ["HL7 FHIR R5 Task", "A task resource with a status value set", "Shape of the referral tasks; no FHIR server"],
    ],
    ["", "", ""], "tight dense",
)
appD = sec("APPENDIX D", "Clause-to-feature map", clauses + tcap(9, "which published clause each feature follows.", "that our reading of any clause is legally complete: several still need a legal read."), "")

gloss = table(
    ["Term", "Meaning in this report"],
    [
        ["<code>shared_result_found</code>", "Result label: a shared finding was found on the tested panel. Not a verdict or a severity."],
        ["<code>no_shared_change_found</code>", "Result label: none found on this panel. Always with a detection rate and its limits."],
        ["<code>more_information_needed</code>", "Result label: no statement can be made yet. A variant of uncertain significance ends here."],
        ["Review priority", "Staff only: routine, priority, urgent. Never shown to a couple; illustrative."],
        ["Threshold choices", "Read now; with a counsellor first; not yet; prefer not to know."],
        ["Consent scopes", "<code>couple_result_only</code>, <code>gene_names_only</code>, <code>full_variant_detail</code>; none by default."],
        ["Escalation tiers", "<code>counsellor</code>; <code>accredited_geneticist</code>. Due-by keys: immediate, same session, fast track, routine."],
        ["Variant of uncertain significance", "A finding whose meaning is unknown. Never counted as a result."],
        ["Draft, illustrative", "Draft: text or rule awaiting sign-off. Illustrative: a figure not taken from a published standard, flagged as such."],
        ["Regression gate", "A check that must keep passing. It guards against breaking the code; it is not evidence of safety."],
    ],
    ["id", ""], "tight dense",
)
appE = sec("APPENDIX E", "Glossary of the closed vocabulary", gloss, "cont")

src = table(
    ["Numbers", "Source", "To reproduce or check"],
    [
        ["All of M1 to M9; all evaluation charts", f"scoreboard file (generated {sb['generated_at'][:16].replace('T', ' ')} UTC, code version {sb['code_version']}), copied by a script", "<code>uv run python scripts/run_evaluation.py</code>"],
        ["Data-file counts; detection rates 0.9 and 0.95 (assumed)", "The data files named in appendix A", "PyYAML count, appendix A"],
        ["API operations and paths; test counts; the 82 decision records", "Counted on 2026-11-20 on the local machine (the decisions folder, index excluded)", "Commands in appendix A; a directory listing"],
        ["Route JavaScript sizes; paint and layout figures", "Budget script on a production build, mock mode, local; not a throttled mobile profile", "<code>node scripts/measure-budget.mjs</code>"],
        ["16.8 and 63.7 times", "The residual module&rsquo;s closed form, computed 2026-11-20; unreviewed by a statistician", "Appendix A, closed-form row"],
        ["21 days, 28 days, 24 hours, three months, 90 percent", "The two published standards, via the pathway data file", "Appendix D"],
        ["Dubai two-carrier consent switch", "In-process test-client run, 2026-11-20", "Section 6, Table 3"],
        ["Statutory articles", "Decree-Law 49/2023 and Federal Law 2/2019 as read in the project research (the latter from secondary summaries)", "Appendix D"],
    ],
    ["", "", ""], "tight",
)
appB = sec("APPENDIX B", "Sources of numbers", src + tcap(7, "where each group of numbers in this report comes from.", "any number not listed here: there are none that did not come from the scoreboard file, a data file or a command."), "cont")
appC = sec("APPENDIX C", "How each measure was run, and the scoreboard&rsquo;s own caveats",
    method + tcap(8, "the method and run size behind each measured row. M3 is Figure 7; M8 and M9 are Figure 10.", "the full does-not-show text for each row, which the scoreboard file carries.") +
    f"""<h3>The scoreboard&rsquo;s own caveats, verbatim</h3><ul>{caveats}</ul>
    <div class="boxed">M8 (human comprehension) was not run: a protocol exists and the ethics exemption question is unanswered. At n=30 an 80% score has a 95% interval of 61 to 92%, so the study would be reported with intervals, never as proof. M9 (clinical review of rules, detection rates and translations) was not done: sign-off by the clinical lead for rules and a native clinical reviewer for the languages is pending.</div>""", "cont")


body = cover + page2 + sec1 + sec2 + sec3 + sec4 + sec5 + sec6 + sec7 + sec8 + sec9 + sec10 + sec11 + sec12 + appA + appB + appC + appD + appE
doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Rishta Safe technical report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="report.css"></head><body>{body}</body></html>"""
(HERE / "report.html").write_text(doc, encoding="utf-8")
print("report.html", len(doc), "bytes")
