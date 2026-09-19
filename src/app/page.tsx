import { redirect } from "next/navigation";

/**
 * The root route has no content of its own. Middleware already enforces
 * auth for every non-public path, so by the time a request reaches here
 * the visitor is authenticated; send them to Cards — the primary nav's
 * first tab since v3.8.0 (Dashboard was hidden from nav that same
 * version but this redirect kept pointing at it until v4.0.0).
 */
export default function HomePage() {
  redirect("/cards");
}
