import React from "react";
import { redirect } from "next/navigation";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import { AuthenticationRequiredError } from "@/lib/auth/auth-resolver";
import { StaffNotLinkedError, StaffInactiveError } from "@/lib/auth/staff-resolver";
import { NoActiveClinicSelectedError } from "@/lib/auth/clinic-context";
import {
  StaffClinicAccessDeniedError,
  getCurrentStaffRolesForClinic,
} from "@/lib/auth/role-resolver";
import { StaffNoActiveClinicError } from "@/lib/auth/clinic-resolver";
import { AccessDeniedView } from "@/components/auth/AccessDeniedView";
import type { ClinicRoleCode } from "@/types/clinic";
import { ClientAppLayout } from "./ClientAppLayout";

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Server-side application shell that enforces full Application Access Context
 * (authenticated user + active staff + verified active clinic selection).
 *
 * Specific Error Handling:
 * - No active clinic / Clinic access denied / Zero active clinics -> redirect to /select-clinic
 * - Staff not linked -> renders AccessDeniedView(code="STAFF_NOT_LINKED") with Logout available
 * - Staff inactive -> renders AccessDeniedView(code="STAFF_INACTIVE") with Logout available
 * - Unauthenticated -> redirect to /login
 * - Unknown errors -> re-thrown to application error boundary
 */
export async function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  let accessContext;
  let activeRoles: ClinicRoleCode[] = [];

  try {
    accessContext = await requireApplicationAccessContext();
    activeRoles = await getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest?: unknown }).digest || "");
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }

    if (
      error instanceof NoActiveClinicSelectedError ||
      error instanceof StaffClinicAccessDeniedError ||
      error instanceof StaffNoActiveClinicError
    ) {
      redirect("/select-clinic");
    }

    if (error instanceof StaffNotLinkedError) {
      return <AccessDeniedView code="STAFF_NOT_LINKED" />;
    }

    if (error instanceof StaffInactiveError) {
      return <AccessDeniedView code="STAFF_INACTIVE" />;
    }

    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }

    // Re-throw any unknown or unexpected infrastructure errors
    throw error;
  }

  return (
    <ClientAppLayout
      currentStaff={accessContext.staff}
      activeClinic={{
        clinic_id: accessContext.clinic.clinic_id,
        clinic_code: accessContext.clinic.clinic_code,
        name: accessContext.clinic.clinic_name,
      }}
      activeRoles={activeRoles}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </ClientAppLayout>
  );
}
