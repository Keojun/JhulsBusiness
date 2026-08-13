/**
 * Vercel Edge Middleware — reserved for future use.
 * Customer pages (home, shop) are public; login is required only for ordering and chat (client-side).
 */

export const config = {
  matcher: [],
};

export default async function middleware() {
  return new Response(null, {
    headers: { "x-middleware-next": "1" },
  });
}
