"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-secondary mt-4"
      aria-busy={pending}
      onClick={() => start(() => router.refresh())}
    >
      {label}
    </button>
  );
}
