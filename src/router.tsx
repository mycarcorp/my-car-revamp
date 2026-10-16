import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Query results are plain DTOs; JSON keeps the router payload serializable.
    dehydrate: () => ({ queryClientState: JSON.stringify(dehydrate(queryClient)) }),
    hydrate: (state: { queryClientState?: string }) => {
      if (state.queryClientState) hydrate(queryClient, JSON.parse(state.queryClientState) as DehydratedState);
    },
  });

  return router;
};
