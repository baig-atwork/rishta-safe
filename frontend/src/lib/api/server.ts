import { ApiError, problemFromUnknown, type ApiRequest, type Transport } from "./transport";
import { createApi } from "./endpoints";
import { callBackend } from "./upstream";
import { readSession } from "../session";

const serverTransport: Transport = async <T,>(req: ApiRequest): Promise<T> => {
  const session = await readSession();
  const result = await callBackend(req, session?.token ?? null);
  if (result.status >= 200 && result.status < 300) return result.body as T;
  throw new ApiError(problemFromUnknown(result.status, result.body, "The request failed"));
};

/** Server components and server actions use this: same adapter, no browser hop. */
export function serverApi() {
  return createApi(serverTransport);
}

/** Runs a server-side read and turns a failure into data so a page can render its error state. */
export async function settle<T>(run: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    return { data: await run(), error: null };
  } catch (error) {
    if (error instanceof ApiError) return { data: null, error };
    return {
      data: null,
      error: new ApiError({
        type: "about:blank",
        title: "Something went wrong",
        status: 500,
        detail: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}
