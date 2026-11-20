/**
 * The name to use in a greeting or heading: the given name only. The backend labels demo personas with a suffix such as
 * "Layla Demo (synthetic)"; the picker and the persona select keep the full label, headings do not.
 */
export function givenName(displayName: string): string {
  const beforeNote = displayName.split("(")[0] ?? displayName;
  const first = beforeNote.trim().split(/\s+/)[0] ?? "";
  return first === "" ? displayName.trim() : first;
}

export function givenNameOrNull(displayName: string | undefined): string | null {
  return displayName === undefined ? null : givenName(displayName);
}
