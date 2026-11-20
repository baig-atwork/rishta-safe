import type { NextActionOption, PathwayView } from "./api/types";

export interface NextActionPlan {
  /** The next main-path step the signed-in role may record, if any. */
  primary: NextActionOption | null;
  /** When the role may record no main-path step: the step that is waiting, and so whose turn it is. */
  waitingOn: NextActionOption | null;
  /** Branch events (declined, missed, rejected) the role may record: demo options, never the headline. */
  branches: NextActionOption[];
}

function options(view: PathwayView): NextActionOption[] {
  if (view.next_actions !== undefined) return view.next_actions;
  // Fixture mode publishes one next action without role information: anyone may record it.
  return view.next_action ? [{ ...view.next_action, roles: [], branch: false }] : [];
}

const allowed = (option: NextActionOption, role: string): boolean => option.roles.length === 0 || option.roles.includes(role);

/**
 * Chooses what to put in front of a signed-in role: the next MAIN-path step if they may record it; otherwise a plain
 * statement of whose turn it is; branch events only in a separate, collapsed list.
 */
export function planNextActions(view: PathwayView, role: string): NextActionPlan {
  const all = options(view);
  const main = all.filter((o) => !o.branch);
  const primary = main.find((o) => allowed(o, role)) ?? null;
  return {
    primary,
    waitingOn: primary === null ? (main[0] ?? null) : null,
    branches: all.filter((o) => o.branch && allowed(o, role)),
  };
}
