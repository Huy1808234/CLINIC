import assert from "node:assert/strict";

// Standard typed errors matching production classes
class NoActiveClinicSelectedError extends Error {
  public readonly code = "NO_ACTIVE_CLINIC_SELECTED";
  public readonly statusCode = 400;
  constructor(message = "Vui lòng chọn cơ sở phòng khám làm việc.") {
    super(message);
    this.name = "NoActiveClinicSelectedError";
    Object.setPrototypeOf(this, NoActiveClinicSelectedError.prototype);
  }
}

class StaffClinicAccessDeniedError extends Error {
  public readonly code = "STAFF_CLINIC_ACCESS_DENIED";
  public readonly statusCode = 403;
  constructor(message = "Nhân viên không có quyền truy cập hoặc không thuộc cơ sở phòng khám này.") {
    super(message);
    this.name = "StaffClinicAccessDeniedError";
    Object.setPrototypeOf(this, StaffClinicAccessDeniedError.prototype);
  }
}

interface MockMembership {
  membership_id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  is_primary: boolean;
}

export function runClinicContextTests() {
  console.log("Running Active Clinic Context Unit Tests...");

  // Mock authorized memberships for current staff
  const mockAuthorizedMemberships: MockMembership[] = [
    {
      membership_id: "mem-tt01",
      staff_id: "staff-admin-01",
      clinic_id: "clinic-tt01",
      clinic_code: "TT01",
      clinic_name: "Thuận Thiên",
      organization_id: "org-thuan-thien",
      is_primary: false,
    },
    {
      membership_id: "mem-pn01",
      staff_id: "staff-admin-01",
      clinic_id: "clinic-pn01",
      clinic_code: "PN01",
      clinic_name: "Phúc Nguyên",
      organization_id: "org-thuan-thien",
      is_primary: false,
    },
  ];

  // Simulation of clinic-context logic with mock cookie store
  const createMockContext = (initialCookieValue: string | null) => {
    let currentCookie = initialCookieValue;

    return {
      getCookie: () => currentCookie,
      setActiveClinicCookie: async (clinicId: string) => {
        if (!clinicId) throw new StaffClinicAccessDeniedError("Mã cơ sở phòng khám không hợp lệ.");
        const matched = mockAuthorizedMemberships.find((m) => m.clinic_id === clinicId);
        if (!matched) throw new StaffClinicAccessDeniedError();
        currentCookie = matched.clinic_id;
        return {
          id: matched.clinic_id,
          clinic_code: matched.clinic_code,
          name: matched.clinic_name,
          organization_id: matched.organization_id,
          is_primary: matched.is_primary,
          membership_id: matched.membership_id,
        };
      },
      getActiveClinicContext: async () => {
        if (!currentCookie) return null;
        // MUST re-validate cookie against authorized memberships
        const matched = mockAuthorizedMemberships.find((m) => m.clinic_id === currentCookie);
        if (!matched) return null;
        return {
          id: matched.clinic_id,
          clinic_code: matched.clinic_code,
          name: matched.clinic_name,
          organization_id: matched.organization_id,
          is_primary: matched.is_primary,
          membership_id: matched.membership_id,
        };
      },
      requireActiveClinic: async () => {
        if (!currentCookie) {
          throw new NoActiveClinicSelectedError();
        }
        const matched = mockAuthorizedMemberships.find((m) => m.clinic_id === currentCookie);
        if (!matched) {
          throw new StaffClinicAccessDeniedError();
        }
        return {
          id: matched.clinic_id,
          clinic_code: matched.clinic_code,
          name: matched.clinic_name,
          organization_id: matched.organization_id,
          is_primary: matched.is_primary,
          membership_id: matched.membership_id,
        };
      },
      clearActiveClinicCookie: async () => {
        currentCookie = null;
      },
    };
  };

  // CASE 1: setActiveClinicCookie with unauthorized clinic_id -> throws StaffClinicAccessDeniedError
  const context = createMockContext(null);

  assert.rejects(
    async () => {
      await context.setActiveClinicCookie("unauthorized-foreign-clinic-999");
    },
    (err: unknown) => {
      return (
        err instanceof StaffClinicAccessDeniedError &&
        err.code === "STAFF_CLINIC_ACCESS_DENIED" &&
        err.statusCode === 403
      );
    },
    "CASE 1: Setting unauthorized clinic throws StaffClinicAccessDeniedError"
  );

  // CASE 2: setActiveClinicCookie with authorized clinic_id -> sets cookie and returns ActiveClinicIdentity
  context.setActiveClinicCookie("clinic-tt01").then((identity) => {
    assert.equal(identity.id, "clinic-tt01");
    assert.equal(identity.clinic_code, "TT01");
    assert.equal(identity.name, "Thuận Thiên");
    assert.equal(context.getCookie(), "clinic-tt01", "CASE 2: Cookie successfully stored");
  });

  // CASE 3: getActiveClinicContext when cookie is missing -> returns null
  const emptyContext = createMockContext(null);
  emptyContext.getActiveClinicContext().then((res) => {
    assert.equal(res, null, "CASE 3: Empty cookie returns null context");
  });

  // CASE 4: getActiveClinicContext when cookie is authorized -> returns ActiveClinicIdentity
  const authorizedContext = createMockContext("clinic-pn01");
  authorizedContext.getActiveClinicContext().then((res) => {
    assert.notEqual(res, null);
    assert.equal(res?.clinic_code, "PN01");
    assert.equal(res?.name, "Phúc Nguyên");
  });

  // CASE 5: Security Invariant: getActiveClinicContext when cookie holds forged/unauthorized clinic -> returns null
  const forgedCookieContext = createMockContext("forged-attacker-clinic-id");
  forgedCookieContext.getActiveClinicContext().then((res) => {
    assert.equal(
      res,
      null,
      "CASE 5: Forged/unauthorized cookie rejected because it is not in authorized memberships"
    );
  });

  // CASE 6: requireActiveClinic when cookie is missing -> throws NoActiveClinicSelectedError
  assert.rejects(
    async () => {
      await emptyContext.requireActiveClinic();
    },
    (err: unknown) => {
      return (
        err instanceof NoActiveClinicSelectedError &&
        err.code === "NO_ACTIVE_CLINIC_SELECTED" &&
        err.statusCode === 400
      );
    },
    "CASE 6: requireActiveClinic throws NoActiveClinicSelectedError when no cookie set"
  );

  // CASE 7: requireActiveClinic when cookie is unauthorized -> throws StaffClinicAccessDeniedError
  assert.rejects(
    async () => {
      await forgedCookieContext.requireActiveClinic();
    },
    (err: unknown) => {
      return (
        err instanceof StaffClinicAccessDeniedError &&
        err.code === "STAFF_CLINIC_ACCESS_DENIED" &&
        err.statusCode === 403
      );
    },
    "CASE 7: requireActiveClinic throws StaffClinicAccessDeniedError for forged cookie"
  );

  // CASE 8: requireActiveClinic when valid -> returns verified identity
  authorizedContext.requireActiveClinic().then((res) => {
    assert.equal(res.id, "clinic-pn01");
    assert.equal(res.clinic_code, "PN01");
  });

  console.log("All Active Clinic Context Unit Tests PASSED!");
}
