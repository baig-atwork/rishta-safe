import type { Locale, NextActionOption } from "./api/types";
import type { NextActionPlan } from "./next-actions";

/** The next-step panel's content, resolved to plain strings (no JSX, so a server page can hand it to a client island). */
export interface NextText {
  kind: "action" | "waiting" | "none";
  heading: string;
  /** Owner line or the waiting explanation; null when there is nothing more to say. */
  body: string | null;
  /** The demo pathway event the panel may offer (labelled as a simulation by the button); null when none. */
  event: string | null;
}

type Translate = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };

export interface NextTextTranslators {
  /** "pathway" namespace: event.<code>, nextBy.<code>, nextByGeneric, next.<key>, owner.<owner> */
  pathway: Translate;
  /** "couple" namespace: who.<role>, waiting.title, nextNone, nextNoneBody, owner */
  couple: Translate;
}

/**
 * The step's name in the page language. The API sends its label in English only, so the pathway event code is mapped
 * to a message first (en, ar, ur); a code with no message falls back to the API's own text rather than hiding it.
 */
export function actionLabel(option: NextActionOption, pathway: Translate): string {
  if (option.event !== null && pathway.has(`event.${option.event}`)) return pathway(`event.${option.event}`);
  if (pathway.has(`next.${option.key}`)) return pathway(`next.${option.key}`);
  return option.label ?? pathway("next.generic");
}

/** What to put in front of the person: the step they may record, whose turn it is, or "nothing to do". Strings only. */
export function describeNext(plan: NextActionPlan, locale: Locale, tr: NextTextTranslators): NextText {
  const whoText = (option: NextActionOption): string => {
    const names = option.roles.map((role) => (tr.couple.has(`who.${role}`) ? tr.couple(`who.${role}`) : role));
    return names.length === 0 ? tr.pathway(`owner.${option.owner}`) : new Intl.ListFormat(locale, { type: "disjunction" }).format(names);
  };
  /** "Next: the clinician records the signed declaration." when the event has a sentence; otherwise a plain wrapper. */
  const waitingSentence = (option: NextActionOption): string => {
    const who = whoText(option);
    if (option.event !== null && tr.pathway.has(`nextBy.${option.event}`)) return tr.pathway(`nextBy.${option.event}`, { who });
    return tr.pathway("nextByGeneric", { who, action: actionLabel(option, tr.pathway) });
  };
  if (plan.primary) {
    return {
      kind: "action",
      heading: actionLabel(plan.primary, tr.pathway),
      body: tr.couple("owner", { owner: tr.pathway(`owner.${plan.primary.owner}`) }),
      event: plan.primary.event,
    };
  }
  if (plan.waitingOn) {
    return {
      kind: "waiting",
      heading: tr.couple("waiting.title", { who: whoText(plan.waitingOn) }),
      body: waitingSentence(plan.waitingOn),
      event: null,
    };
  }
  return { kind: "none", heading: tr.couple("nextNone"), body: tr.couple("nextNoneBody"), event: null };
}
