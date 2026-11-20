import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import arMessages from "@/test/messages-ar";
import enMessages from "@/test/messages-en";
import urMessages from "@/test/messages-ur";

type Tree = Record<string, unknown>;

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object" && value !== null ? leaves(value as Tree, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const en = new Set(leaves(enMessages));

describe("message files", () => {
  it.each([
    ["ar", arMessages],
    ["ur", urMessages],
  ] as const)("%s has exactly the English key set", (_locale, tree) => {
    const got = new Set(leaves(tree));
    const missing = [...en].filter((k) => !got.has(k));
    const extra = [...got].filter((k) => !en.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("keeps every placeholder in every translation", () => {
    const flat = (tree: Tree) => Object.fromEntries(leaves(tree).map((k) => [k, k.split(".").reduce<unknown>((acc, p) => (acc as Tree)[p], tree) as string]));
    const e = flat(enMessages);
    for (const tree of [arMessages, urMessages]) {
      const t = flat(tree);
      for (const key of Object.keys(e)) {
        const want = [...(e[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const have = [...(t[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect({ key, have }).toEqual({ key, have: want });
      }
    }
  });

  it("uses Western digits in Arabic and Urdu", () => {
    for (const tree of [arMessages, urMessages]) {
      expect(JSON.stringify(tree)).not.toMatch(/[٠-٩۰-۹]/);
    }
  });

  it("contains none of the banned result words in English", () => {
    const banned = [/\bcompatible\b/i, /\bincompatible\b/i, /\bpass\b/i, /\bfail\b/i, /\bno risk\b/i, /\bsafe\b/i, /\bhigh risk\b/i, /\bmoderate risk\b/i, /\blow risk\b/i, /\byou should\b/i, /\byou must not\b/i, /proceed with the marriage/i, /\bcancel\b/i];
    const lines = leaves(enMessages).map((k) => k.split(".").reduce<unknown>((acc, p) => (acc as Tree)[p], enMessages) as string);
    const hits = lines.flatMap((line) => banned.filter((re) => re.test(line.replaceAll("Rishta Safe", ""))).map((re) => `${re.source}: ${line}`));
    expect(hits).toEqual([]);
  });

  it("has no message key used in source that is missing from English", () => {
    const used = new Set<string>();
    for (const file of walk(join(process.cwd(), "src"))) {
      const src = readFileSync(file, "utf8");
      const namespaces = [...src.matchAll(/use(?:Translations)\(\s*"([\w.]+)"\s*\)|getTranslations\(\s*(?:\{[^}]*namespace:\s*)?"([\w.]+)"/g)].map((m) => m[1] ?? m[2]);
      if (namespaces.length !== 1) continue;
      const ns = namespaces[0];
      for (const m of src.matchAll(/\bt[a-z]?\(\s*"([\w.]+)"/g)) used.add(`${ns}.${m[1]}`);
    }
    const missing = [...used].filter((key) => !en.has(key));
    expect(missing).toEqual([]);
  });
});
