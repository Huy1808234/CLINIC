import { runNormalizerTests } from "./unit/normalizers.test";
import { runTreatmentCourseTests } from "./unit/treatment-course.test";
import { runSchedulingTests } from "./unit/scheduling.test";
import { runMigrationTests } from "./unit/migration.test";
import { runMultiClinicTests } from "./unit/multi-clinic.test";
import { runStaffManagementTests } from "./unit/staff-management.test";
import { runAuthResolverTests } from "./unit/auth-resolver.test";
import { runStaffResolverTests } from "./unit/staff-resolver.test";
import { runClinicResolverTests } from "./unit/clinic-resolver.test";
import { runRoleResolverTests } from "./unit/role-resolver.test";
import { runSignInTests } from "./unit/sign-in.test";
import { runClinicContextTests } from "./unit/clinic-context.test";
import { runSignOutTests } from "./unit/sign-out.test";
import { runRouteGateTests } from "./unit/route-gate.test";
import { runApplicationAccessTests } from "./unit/application-access.test";
import { runActionAuthorizationTests } from "./unit/action-authorization.test";
import { runStaffGovernanceTests } from "./unit/staff-governance.test";

async function main() {
  try {
    runNormalizerTests();
    runTreatmentCourseTests();
    runSchedulingTests();
    runMigrationTests();
    runMultiClinicTests();
    runStaffManagementTests();
    runAuthResolverTests();
    runStaffResolverTests();
    runClinicResolverTests();
    runRoleResolverTests();
    runSignInTests();
    runClinicContextTests();
    runSignOutTests();
    runRouteGateTests();
    runApplicationAccessTests();
    runActionAuthorizationTests();
    runStaffGovernanceTests();
    console.log("All unit test suites executed successfully.");
  } catch (err) {
    console.error("Test failure:", err);
    process.exit(1);
  }
}

main();
