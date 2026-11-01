import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { responseJson } from "../_shared/utils.ts";

// Keep a tombstone so deploying all functions cannot revive account relabeling.
Deno.serve((req: Request) =>
  responseJson({
    status: req.method === "OPTIONS" ? 200 : 410,
    body:
      req.method === "OPTIONS"
        ? undefined
        : {
            error:
              "This upload endpoint is retired. Update Soothsayer to continue sharing.",
          },
  }),
);
