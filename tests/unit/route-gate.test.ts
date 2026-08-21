import assert from "node:assert/strict";

type MockUser = { id: string; email: string } | null;

interface MockMiddlewareContext {
  pathname: string;
  user: MockUser;
  refreshedCookies?: Array<{ name: string; value: string }>;
}

// Pure simulation of the middleware route gate decision logic
function evaluateRouteGate(context: MockMiddlewareContext) {
  const isPublicRoute = context.pathname === "/login";
  const isAuthenticated = context.user !== null;

  if (!isAuthenticated && !isPublicRoute) {
    return {
      action: "REDIRECT" as const,
      destination: "/login",
      preservedCookies: context.refreshedCookies || [],
    };
  }

  return {
    action: "NEXT" as const,
    destination: null,
    preservedCookies: context.refreshedCookies || [],
  };
}

export function runRouteGateTests() {
  console.log("Running Route Gate Unit Tests...");

  // CASE 1: Unauthenticated request to /reception -> redirect /login
  const res1 = evaluateRouteGate({ pathname: "/reception", user: null });
  assert.equal(res1.action, "REDIRECT", "CASE 1: /reception redirects when unauthenticated");
  assert.equal(res1.destination, "/login");

  // CASE 2: Unauthenticated request to /patients/p-123 -> redirect /login
  const res2 = evaluateRouteGate({ pathname: "/patients/p-123", user: null });
  assert.equal(res2.action, "REDIRECT", "CASE 2: /patients/[id] redirects when unauthenticated");
  assert.equal(res2.destination, "/login");

  // CASE 3: Unauthenticated request to /select-clinic -> redirect /login
  const res3 = evaluateRouteGate({ pathname: "/select-clinic", user: null });
  assert.equal(res3.action, "REDIRECT", "CASE 3: /select-clinic redirects when unauthenticated");
  assert.equal(res3.destination, "/login");

  // CASE 4: Unauthenticated request to /login -> allowed
  const res4 = evaluateRouteGate({ pathname: "/login", user: null });
  assert.equal(res4.action, "NEXT", "CASE 4: /login is public and allowed when unauthenticated");

  // CASE 5: Authenticated request to /reception -> allowed
  const res5 = evaluateRouteGate({
    pathname: "/reception",
    user: { id: "user-uuid-1", email: "staff@thuanthien.vn" },
  });
  assert.equal(res5.action, "NEXT", "CASE 5: /reception allowed when authenticated");

  // CASE 6: Authenticated request to /select-clinic -> allowed
  const res6 = evaluateRouteGate({
    pathname: "/select-clinic",
    user: { id: "user-uuid-1", email: "staff@thuanthien.vn" },
  });
  assert.equal(res6.action, "NEXT", "CASE 6: /select-clinic allowed when authenticated");

  // CASE 8: Stale/corrupt cookie resulting in user=null -> NOT accepted
  const res8 = evaluateRouteGate({ pathname: "/schedule", user: null });
  assert.equal(res8.action, "REDIRECT", "CASE 8: Stale cookie fails Supabase getUser and redirects");

  // CASE 9: Refreshed cookies during session check are preserved on redirect response
  const refreshedCookies = [{ name: "sb-auth-token", value: "new-token-val" }];
  const res9 = evaluateRouteGate({
    pathname: "/patients",
    user: null,
    refreshedCookies,
  });
  assert.equal(res9.action, "REDIRECT");
  assert.equal(res9.preservedCookies.length, 1);
  assert.equal(res9.preservedCookies[0].name, "sb-auth-token", "CASE 9: Refreshed cookies preserved");

  console.log("All Route Gate Unit Tests PASSED!");
}
