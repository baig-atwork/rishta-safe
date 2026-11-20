"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { RntkStatus } from "@/lib/api/types";

/**
 * Declare or withdraw the right not to know (PUT and DELETE /v1/couples/{id}/right-not-to-know). Each call writes one
 * audit row, so the audit queries (the tape and the table share the key) are refreshed, and the server component that
 * decided what to show is re-run (router.refresh) so the result is read again with the new state.
 */
export function useRntk(coupleId: string, onDone?: (active: boolean) => void) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation = useMutation<RntkStatus, ApiError, boolean>({
    mutationFn: (declare) => (declare ? clientApi.declareRightNotToKnow(coupleId) : clientApi.withdrawRightNotToKnow(coupleId)),
    onSuccess: (status) => {
      void queryClient.invalidateQueries({ queryKey: ["audit", coupleId] });
      void queryClient.invalidateQueries({ queryKey: ["result", coupleId] });
      onDone?.(status.active);
      router.refresh();
    },
  });
  return {
    declare: () => mutation.mutate(true),
    withdraw: () => mutation.mutate(false),
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
