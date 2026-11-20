"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export type NavLabelKey =
  | "how"
  | "governance"
  | "demo"
  | "home"
  | "evidence"
  | "result"
  | "sharing"
  | "practice"
  | "closure"
  | "queue"
  | "haem"
  | "programme";

export interface NavItem {
  href: string;
  labelKey: NavLabelKey;
}

/** The role's navigation links (at most five). Used in the header row and, under 1024 px, inside the menu panel. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const t = useTranslations("shell.nav");
  const pathname = usePathname();
  return (
    <ul>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MainNav({ items }: { items: NavItem[] }) {
  const t = useTranslations("shell.nav");
  return (
    <nav aria-label={t("label")} className="main-nav">
      <NavLinks items={items} />
    </nav>
  );
}
