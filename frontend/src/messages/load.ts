import type { AppLocale } from "@/i18n/routing";

/**
 * Messages are split by area so lanes and translators can work in parallel:
 * core (shell, status, roles, states, pathway), marketing (landing, how, gov, demo, couple), result,
 * consent (sharing), closure (closure, quiz), clinical (staff, haem), oversight (programme, judge).
 */
export type Messages = Record<string, unknown>;

export const MESSAGE_FILES = ["core", "marketing", "result", "consent", "closure", "clinical", "oversight"] as const;

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  const parts = await Promise.all(
    MESSAGE_FILES.map(async (file) => {
      const mod = (await import(`./${locale}/${file}.json`)) as { default: Messages };
      return mod.default;
    }),
  );
  return Object.assign({}, ...parts) as Messages;
}
