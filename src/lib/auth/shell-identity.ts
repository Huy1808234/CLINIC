import type { ClinicRoleCode } from "@/types/clinic";

export const ROLE_DISPLAY_LABELS: Record<ClinicRoleCode, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  DOCTOR: "Bác sĩ",
  Y_SI: "Y sĩ",
  TECHNICIAN: "Kỹ thuật viên",
  RECEPTIONIST: "Tiếp nhận",
  CSKH: "CSKH",
};

/**
 * Deterministic display-only priority order for displaying a single primary role badge/label
 * when a staff member holds multiple roles at the active clinic.
 *
 * NOTE: This is strictly for visual presentation and does NOT affect authorization checks.
 */
export const ROLE_DISPLAY_PRIORITY: ClinicRoleCode[] = [
  "ADMIN",
  "MANAGER",
  "DOCTOR",
  "Y_SI",
  "TECHNICIAN",
  "RECEPTIONIST",
  "CSKH",
];

/**
 * Centralized navigation route definitions with allowed role mappings at the active clinic context.
 */
export interface NavigationRouteAccess {
  label: string;
  href: string;
  allowedRoles: ClinicRoleCode[];
}

export const NAVIGATION_ROUTE_ACCESS: NavigationRouteAccess[] = [
  {
    label: "Tiếp Nhận Khám",
    href: "/reception",
    allowedRoles: ["ADMIN", "RECEPTIONIST"],
  },
  {
    label: "Lịch Hẹn & Ma Trận",
    href: "/schedule",
    allowedRoles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "Y_SI", "TECHNICIAN"],
  },
  {
    label: "Hồ Sơ Bệnh Nhân",
    href: "/patients",
    allowedRoles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "Y_SI", "TECHNICIAN", "MANAGER", "CSKH"],
  },
  {
    label: "Nhân Sự & Cơ Sở",
    href: "/staff",
    allowedRoles: ["ADMIN"],
  },
  {
    label: "Nhập Dữ Liệu Excel",
    href: "/migration",
    allowedRoles: ["ADMIN"],
  },
];

/**
 * Checks if a specific route is visible to a staff member based on their active clinic roles (UNION semantics).
 * If any of the caller's active roles is in the route's allowedRoles, the route is visible.
 *
 * @param href Navigation target URL.
 * @param activeRoles Role codes assigned at the current active clinic.
 * @returns boolean indicating UI menu visibility.
 */
export function isRouteVisibleForRoles(
  href: string,
  activeRoles: ClinicRoleCode[]
): boolean {
  if (!activeRoles || activeRoles.length === 0) {
    return false;
  }

  const routeConfig = NAVIGATION_ROUTE_ACCESS.find((item) => item.href === href);
  if (!routeConfig) {
    return false;
  }

  return routeConfig.allowedRoles.some((role) => activeRoles.includes(role));
}

/**
 * Generates compact avatar initials from the staff member's full name.
 *
 * Examples:
 * - "BS Anh Thư" -> "AT"
 * - "Nguyễn Hải Huy" -> "HH"
 * - "Thảo" -> "T"
 * - "Nguyễn Văn A" -> "VA"
 *
 * @param fullName Staff member full name.
 * @returns 1-2 character uppercase initials.
 */
export function getAvatarInitials(fullName: string): string {
  if (!fullName || !fullName.trim()) {
    return "NV";
  }

  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return "NV";
  }

  if (tokens.length === 1) {
    return tokens[0][0].toUpperCase();
  }

  const lastToken = tokens[tokens.length - 1];
  const secondLastToken = tokens[tokens.length - 2];

  const firstChar = secondLastToken[0]?.toUpperCase() || "";
  const secondChar = lastToken[0]?.toUpperCase() || "";

  return firstChar + secondChar || lastToken.slice(0, 2).toUpperCase();
}

/**
 * Resolves the primary user-facing role label for display at the active clinic context.
 *
 * @param roles Array of role codes assigned at the active clinic.
 * @returns Localized Vietnamese role label.
 */
export function getPrimaryRoleLabel(roles: ClinicRoleCode[]): string {
  if (!roles || roles.length === 0) {
    return "Nhân viên";
  }

  for (const role of ROLE_DISPLAY_PRIORITY) {
    if (roles.includes(role)) {
      return ROLE_DISPLAY_LABELS[role] || role;
    }
  }

  return ROLE_DISPLAY_LABELS[roles[0]] || roles[0];
}

/**
 * Formats the secondary account line: `<Role label> • <Active clinic name>`
 *
 * Example:
 * - "Bác sĩ • Thuận Thiên"
 * - "Quản trị viên • Phúc Nguyên"
 */
export function formatSecondaryAccountLabel(
  roles: ClinicRoleCode[],
  clinicName: string
): string {
  const roleLabel = getPrimaryRoleLabel(roles);
  const clinic = clinicName?.trim() || "Phòng khám";
  return `${roleLabel} • ${clinic}`;
}
