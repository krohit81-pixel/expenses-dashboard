import { redirect } from "next/navigation";

/**
 * The root route has no content of its own. Middleware already enforces
 * auth for every non-public path, so by the time a request reaches here
 * the visitor is authenticated; send them to the dashboard.
 */
export default function HomePage() {
  redirect("/dashboard");
}
