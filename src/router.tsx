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
    dehydrate: () => ({ queryClientState: dehydrate(queryClient) }),
    hydrate: (state: { queryClientState?: DehydratedState }) => {
      if (state.queryClientState) hydrate(queryClient, state.queryClientState);
    },
  });

  return router;
};
