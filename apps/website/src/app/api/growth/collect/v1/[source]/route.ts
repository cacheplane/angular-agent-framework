import {
  createCollectionRoute,
  defaultCollectionRouteDependencies,
} from '../../../../../../lib/growth/collection-route';

export const runtime = 'nodejs';
const handle = createCollectionRoute(defaultCollectionRouteDependencies());
type Context = { params: Promise<{ source: string }> };
export async function POST(request: Request, context: Context) {
  return handle(request, (await context.params).source);
}
export async function OPTIONS(request: Request, context: Context) {
  return handle(request, (await context.params).source);
}
