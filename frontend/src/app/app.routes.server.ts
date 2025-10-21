import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'transactions-list/:accountId',
    renderMode: RenderMode.Client
  },
  {
    path: 'transactions/:accountId/:financialFlowId',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
