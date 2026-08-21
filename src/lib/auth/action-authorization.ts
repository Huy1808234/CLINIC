import "server-only";
import type { ClinicRoleCode } from "@/types/clinic";
import {
  requireApplicationAccessContext,
  type ApplicationAccessContext,
} from "./application-access";
import { requireCurrentStaffRolesForClinic } from "./role-resolver";
import { requireCurrentStaff } from "./staff-resolver";

/**
 * Standard typed application error when an authenticated staff member does not
 * possess the required role(s) to execute a server mutation.
 */
export class ActionForbiddenError extends Error {
  public readonly code = "ACTION_FORBIDDEN";
  public readonly statusCode = 403;

  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "ActionForbiddenError";
    Object.setPrototypeOf(this, ActionForbiddenError.prototype);
  }
}

/**
 * Verified context for active-clinic Server Actions.
 */
export interface ActionAuthorizationContext {
  access: ApplicationAccessContext;
  roles: ClinicRoleCode[];
}

/**
 * Verified context for target-clinic Server Actions (e.g. staff clinic assignment).
 */
export interface TargetClinicAuthorizationContext {
  staff: {
    id: string;
    staff_code: string;
    full_name: string;
  };
  clinic: {
    clinic_id: string;
    clinic_code: string;
    clinic_name: string;
    organization_id: string;
    membership_id: string;
    is_primary: boolean;
  };
  roles: ClinicRoleCode[];
}

/**
 * Authorizes a Server Action operating within the current active clinic context.
 *
 * Verification Pipeline:
 * 1. Enforces `requireApplicationAccessContext()` (Auth User + Active Staff + Verified Active Clinic)
 * 2. If `requiredRoles` provided: resolves caller's active roles at `access.clinic.clinic_id`
 * 3. Verifies that caller holds AT LEAST ONE of `requiredRoles` (ANY-role semantics)
 * 4. Throws `ActionForbiddenError` if unauthorized.
 *
 * @param options Optional required roles array.
 * @returns Verified `ActionAuthorizationContext`.
 */
export async function requireActionAuthorization(options?: {
  requiredRoles?: ClinicRoleCode[];
}): Promise<ActionAuthorizationContext> {
  const access = await requireApplicationAccessContext();

  const requiredRoles = options?.requiredRoles;
  if (!requiredRoles || requiredRoles.length === 0) {
    return { access, roles: [] };
  }

  const roleContext = await requireCurrentStaffRolesForClinic(access.clinic.clinic_id);
  const hasAuthorizedRole = requiredRoles.some((role) => roleContext.roles.includes(role));

  if (!hasAuthorizedRole) {
    throw new ActionForbiddenError();
  }

  return {
    access,
    roles: roleContext.roles,
  };
}

/**
 * Authorizes a Server Action operating on a specific target clinic (e.g. staff assignment).
 *
 * Verification Pipeline:
 * 1. Enforces `requireCurrentStaff()` (Auth User + Active Staff)
 * 2. Resolves caller's active roles at `targetClinicId` directly
 * 3. Verifies that caller holds AT LEAST ONE of `requiredRoles` at `targetClinicId`
 * 4. Throws `StaffClinicAccessDeniedError` if caller does not belong to target clinic
 * 5. Throws `ActionForbiddenError` if caller lacks required role at target clinic.
 *
 * Note: An active clinic role at Clinic A NEVER grants authorization at Clinic B.
 *
 * @param targetClinicId Target clinic UUID to verify caller's authorization for.
 * @param requiredRoles Array of permitted roles at the target clinic.
 * @returns Verified `TargetClinicAuthorizationContext`.
 */
export async function requireTargetClinicRole(
  targetClinicId: string,
  requiredRoles: ClinicRoleCode[]
): Promise<TargetClinicAuthorizationContext> {
  if (!targetClinicId) {
    throw new ActionForbiddenError("Mã cơ sở phòng khám mục tiêu không hợp lệ.");
  }

  const staff = await requireCurrentStaff();
  const roleContext = await requireCurrentStaffRolesForClinic(targetClinicId);

  if (requiredRoles && requiredRoles.length > 0) {
    const hasAuthorizedRole = requiredRoles.some((role) => roleContext.roles.includes(role));
    if (!hasAuthorizedRole) {
      throw new ActionForbiddenError();
    }
  }

  return {
    staff: {
      id: staff.id,
      staff_code: staff.staff_code,
      full_name: staff.full_name,
    },
    clinic: {
      clinic_id: roleContext.clinic_id,
      clinic_code: roleContext.clinic_code,
      clinic_name: roleContext.clinic_name,
      organization_id: roleContext.organization_id,
      membership_id: roleContext.membership_id,
      is_primary: roleContext.is_primary,
    },
    roles: roleContext.roles,
  };
}
