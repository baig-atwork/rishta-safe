import type { ReactNode } from "react";
import { Cell } from "@/components/grid/Cell";
import { Link } from "@/i18n/navigation";
import type { Role } from "@/lib/api/types";
import { HeaderMenu } from "./HeaderMenu";
import { LensControl, type LensOption, type LensPersona } from "./LensControl";
import { LocaleSwitch } from "./LocaleSwitch";
import { MainNav, type NavItem } from "./MainNav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Role-aware navigation, at most five items (02-ux-concept section 2). Staff see their working surfaces; the
 * programme link appears only for the programme role (the API refuses the rest); judges see Evidence first.
 */
export function navItemsFor(role: Role | null): NavItem[] {
  switch (role) {
    case "couple_member":
      return [
        { href: "/couple", labelKey: "home" },
        { href: "/couple/result", labelKey: "result" },
        { href: "/couple/sharing", labelKey: "sharing" },
        { href: "/couple/teach-back", labelKey: "practice" },
        { href: "/couple/closure", labelKey: "closure" },
      ];
    case "counsellor":
      return [
        { href: "/staff", labelKey: "queue" },
        { href: "/demo", labelKey: "demo" },
        { href: "/governance", labelKey: "governance" },
        { href: "/how-it-works", labelKey: "how" },
      ];
    case "clinician":
      return [
        { href: "/staff", labelKey: "queue" },
        { href: "/clinician", labelKey: "haem" },
        { href: "/demo", labelKey: "demo" },
        { href: "/governance", labelKey: "governance" },
      ];
    case "programme":
      return [
        { href: "/programme", labelKey: "programme" },
        { href: "/judge", labelKey: "evidence" },
        { href: "/demo", labelKey: "demo" },
        { href: "/governance", labelKey: "governance" },
      ];
    case "judge":
      return [
        { href: "/judge", labelKey: "evidence" },
        { href: "/demo", labelKey: "demo" },
        { href: "/governance", labelKey: "governance" },
      ];
    default:
      return [
        { href: "/how-it-works", labelKey: "how" },
        { href: "/governance", labelKey: "governance" },
        { href: "/judge", labelKey: "evidence" },
        { href: "/demo", labelKey: "demo" },
      ];
  }
}

export interface SiteHeaderProps {
  role: Role | null;
  persona: LensPersona | null;
  personaOptions: LensOption[];
  /** SLOT for the LensControl dialog (Lane C's compact CaseBench). */
  lensSlot?: ReactNode;
}

/** The 52 px one-row header: wordmark, role nav, Lens, locale switch, theme toggle (an overflow menu under 1024 px). */
export function SiteHeader({ role, persona, personaOptions, lensSlot }: SiteHeaderProps) {
  const items = navItemsFor(role);
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            <Cell fill="solid" tone="ink" />
            <Cell fill="hatch" tone="ink" />
            <Cell fill="open" tone="ink" />
          </span>
          <span>Rishta Safe</span>
        </Link>
        <MainNav items={items} />
        <div className="end">
          <LensControl persona={persona} options={personaOptions}>
            {lensSlot}
          </LensControl>
          <LocaleSwitch />
          <div className="theme-inline">
            <ThemeToggle showLabel={false} />
          </div>
          <HeaderMenu items={items} />
        </div>
      </div>
    </header>
  );
}
