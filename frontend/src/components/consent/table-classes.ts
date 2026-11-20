/**
 * A real <table> at 40rem and wider; below that each row becomes a labelled card (CSS only, via data-label). The
 * restacking rules live in globals.css (.stack-*), not in utility strings, so they cost no route JavaScript.
 * Logical properties only: the stacked grid reads start-to-end in LTR and RTL alike.
 */
export const TABLE_WRAP = "stack-wrap overflow-x-auto rounded-lg border border-line bg-surface-raised";
export const TABLE = "data-table stack-table";
export const THEAD = "stack-thead";
export const TBODY = "stack-tbody";
export const TR = "stack-tr";
export const TD = "stack-td";
export const CAPTION = "stack-caption px-3 py-2 text-start text-sm text-fg-2";
