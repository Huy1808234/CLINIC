-- Migration: Restrict set_staff_active_with_admin_guard RPC to service_role only
-- Spec Reference: STAFF-GOV1B-FIX1 RPC Privilege Hardening

-- Invariant:
-- The governance RPC protects the database last-usable-ADMIN invariant.
-- It does NOT prove caller authorization to manage target staff (owned by Server Actions).
-- Therefore, direct invocation from authenticated browsers or anon is strictly revoked.

REVOKE EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) TO service_role;
