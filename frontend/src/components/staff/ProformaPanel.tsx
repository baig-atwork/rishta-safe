"use client";

import dynamic from "next/dynamic";
import { SkeletonBlock } from "@/components/ui/states";
import type { ProformaFormProps } from "./ProformaForm";

/**
 * The closure proforma, loaded only when the pane opens it. The form brings react-hook-form, zod and the resolver
 * (well over 20 KB gzip); the queue and the brief do not need them to read, so they stay out of the route's first load.
 * ProformaForm itself is unchanged.
 */
const ProformaForm = dynamic(() => import("./ProformaForm").then((module) => module.ProformaForm), {
  loading: () => <SkeletonBlock className="h-64 w-full" />,
});

export function ProformaPanel(props: ProformaFormProps) {
  return <ProformaForm {...props} />;
}
