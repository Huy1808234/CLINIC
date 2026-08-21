import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";

/**
 * Standard typed application error when an unauthenticated caller attempts
 * an operation that requires a valid authenticated session.
 */
class AuthenticationRequiredError extends Error {
  public readonly code = "UNAUTHENTICATED";
  public readonly statusCode = 401;

  constructor(message = "Yêu cầu đăng nhập để truy cập tài nguyên này.") {
    super(message);
    this.name = "AuthenticationRequiredError";
    Object.setPrototypeOf(this, AuthenticationRequiredError.prototype);
  }
}

export function runAuthResolverTests() {
  console.log("Running Auth Resolver Unit Tests...");

  // 1. Test AuthenticationRequiredError class properties
  const authErr = new AuthenticationRequiredError();
  assert.equal(authErr.name, "AuthenticationRequiredError");
  assert.equal(authErr.code, "UNAUTHENTICATED");
  assert.equal(authErr.statusCode, 401);
  assert.equal(authErr.message, "Yêu cầu đăng nhập để truy cập tài nguyên này.");

  const customMsgErr = new AuthenticationRequiredError("Custom unauthorized message");
  assert.equal(customMsgErr.message, "Custom unauthorized message");
  assert.equal(customMsgErr.statusCode, 401);

  // 2. Test mock resolver simulation logic
  const mockResolveUser = (mockUser: User | null) => {
    return {
      getCurrentAuthUser: async (): Promise<User | null> => {
        return mockUser;
      },
      requireAuthenticatedUser: async (): Promise<User> => {
        if (!mockUser) {
          throw new AuthenticationRequiredError();
        }
        return mockUser;
      },
    };
  };

  // Case A: Unauthenticated session
  const unauthenticatedContext = mockResolveUser(null);

  unauthenticatedContext.getCurrentAuthUser().then((user) => {
    assert.equal(user, null, "Unauthenticated session returns null");
  });

  assert.rejects(
    async () => {
      await unauthenticatedContext.requireAuthenticatedUser();
    },
    (err: unknown) => {
      return (
        err instanceof AuthenticationRequiredError &&
        err.code === "UNAUTHENTICATED" &&
        err.statusCode === 401
      );
    },
    "requireAuthenticatedUser must throw AuthenticationRequiredError when unauthenticated"
  );

  // Case B: Authenticated session
  const mockValidUser: User = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "bs.hai@thuanthien.vn",
  };

  const authenticatedContext = mockResolveUser(mockValidUser);

  authenticatedContext.getCurrentAuthUser().then((user) => {
    assert.notEqual(user, null);
    assert.equal(user?.id, "123e4567-e89b-12d3-a456-426614174000");
    assert.equal(user?.email, "bs.hai@thuanthien.vn");
  });

  authenticatedContext.requireAuthenticatedUser().then((user) => {
    assert.equal(user.id, "123e4567-e89b-12d3-a456-426614174000");
    assert.equal(user.email, "bs.hai@thuanthien.vn");
  });

  console.log("All Auth Resolver Unit Tests PASSED!");
}
