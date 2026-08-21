# THUẬN THIÊN — AGENT MICRO-GOAL EXECUTION PLAYBOOK V3

**Vai trò:** Tài liệu thực thi cho Antigravity/Gemini.  
**Không phải:** quyền implement toàn bộ roadmap.  
**Source of truth kiến trúc:** `THUAN_THIEN_CLINIC_MANAGEMENT_TECHLEAD_SPEC_V3_FULL.md`  
**Permanent rules:** `AGENTS.md`, `.agent/frontend.md`, `.agent/supabase.md`.

---

# 0. Cách sử dụng tài liệu này

Mỗi lần chỉ copy **MỘT prompt** vào Goal Mode.

Không paste 5–10 Goal cùng lúc.

Quy trình:

```text
Tech Lead chọn 1 micro-goal
        ↓
Agent inspect targeted context
        ↓
Implement đúng 1 capability
        ↓
Self-review 1 lần
        ↓
Fix tối đa 1 lần
        ↓
Targeted validation
        ↓
STOP
        ↓
Tech Lead review
        ↓
Goal kế tiếp
```

Rule:

```text
Roadmap = knowledge
CURRENT_GOAL = permission
```

Nếu capability đã tồn tại và đúng:

```text
RESULT = ALREADY_SATISFIED
```

Không rewrite/refactor chỉ để agent "có việc làm".

---

# 1. Prompt Wrapper — dùng cho mọi Goal

Mỗi prompt bên dưới mặc định kế thừa wrapper này:

```text
READ FIRST:
- AGENTS.md
- docs/architecture/CURRENT_STATE.md
- only the relevant .agent rule file
- only relevant sections of the V3 Tech Lead Spec

SEARCH BEFORE READ.
Do not scan the entire repository unless necessary.
Repository/current schema is implementation truth.

GOAL LOCK:
Implement ONLY CURRENT_GOAL.
Roadmap/future work is context only.

QUOTA CONTROL:
- smallest relevant context only
- no repeated full repo scans
- no repeated full spec reads
- targeted validation first
- SELF_REVIEW_PASSES = 1
- FIX_PASSES = 1

IF ALREADY IMPLEMENTED CORRECTLY:
Do not rewrite it.
Validate targeted behavior and return ALREADY_SATISFIED.

IF GOAL EXPANDS ACROSS MULTIPLE DOMAINS:
Return SPLIT_REQUIRED and STOP.

FINAL RESPONSE:
CURRENT_GOAL
CHANGED
SELF REVIEW
VALIDATION
ISSUES FOUND
FIX PASS
DEFERRED
SCOPE CHECK
RESULT

Final line:
STOPPED. Waiting for Tech Lead approval.
```

---

# PHASE A — Refresh Repository Truth

## A0.1 — Refresh CURRENT_STATE only

```text
CURRENT_GOAL = A0.1

GOAL:
Refresh docs/architecture/CURRENT_STATE.md from the ACTUAL repository state.

AUTHORIZED:
- inspect package.json, src/, supabase/, tests/, relevant migrations
- document IMPLEMENTED / PARTIAL / NOT IMPLEMENTED / LEGACY
- preserve old bootstrap audit under docs/architecture/audits/ if needed

FORBIDDEN:
- application code changes
- migrations
- dependencies
- feature implementation

CURRENT_STATE must cover briefly:
Stack
Multi-Clinic
Auth
Staff
Catalogs
Patient
Reception
Clinical/Treatment
Scheduling
BHXH Integration
RLS
Tests

Do not present target V3 architecture as implemented unless repository evidence proves it.

VALIDATE:
git diff documentation only.
```

**Tech Lead gate:** Không làm Goal tiếp theo cho tới khi CURRENT_STATE mới được review.

---

# PHASE B — Organization & Clinic Foundation

## MC1.1 — Organization schema only

```text
CURRENT_GOAL = MC1.1

GOAL:
Ensure the Organization database foundation exists correctly.

AUTHORIZED:
organizations table only.
Required concept:
id UUID DB-generated
code
name
is_active
timestamps
UNIQUE(code)

May seed THUAN_THIEN only if existing seed convention supports it.

FORBIDDEN:
clinics
staff memberships
roles
login
catalogs
patient
reception
BHXH

DATABASE:
maximum one forward migration.
```

## MC1.2 — Clinics schema only

```text
CURRENT_GOAL = MC1.2

GOAL:
Ensure clinics are normalized rows under Organization.

AUTHORIZED:
clinics table only.
Required concept:
organization_id
clinic_code
name
short_name nullable
facility_code nullable
address nullable
phone nullable
timezone
is_active
timestamps
UNIQUE(organization_id, clinic_code)

Do not hardcode six clinics.
Do not invent real clinic data.

FORBIDDEN:
Clinic UI
ClinicSwitcher
Auth
Staff membership
Operational clinic_id migrations
```

## MC1.3 — Organization/Clinic generated types

```text
CURRENT_GOAL = MC1.3

GOAL:
Synchronize generated Supabase DB types after approved Organization/Clinic schema changes.

AUTHORIZED:
Generated DB type workflow only.
Minimal compile fixes caused directly by generated type change if required.

FORBIDDEN:
New schema
UI
Business features
```

## MC1.4 — Active clinic read layer

```text
CURRENT_GOAL = MC1.4

GOAL:
Implement/reuse server-side read functions for active clinics.

Required capabilities only:
getActiveClinics(...)
getClinicByCode(...)

Follow current repository layout and server-only boundaries.

FORBIDDEN:
create/edit clinic UI
ClinicSwitcher
Auth permission system
```

---

# PHASE C — Staff Multi-Clinic Foundation

## ST0.1 — Audit current Staff implementation

```text
CURRENT_GOAL = ST0.1

GOAL:
READ-ONLY audit of current Staff implementation.

Report:
- current staff columns
- user_id behavior
- role_type behavior
- clinic_id if any
- all FKs referencing staff
- current doctor dropdown query path
- existing seeds
- current Staff UI if any

NO CODE CHANGES.
```

## ST1.1 — Align Staff Master organization scope

```text
CURRENT_GOAL = ST1.1

GOAL:
Ensure staff represents an Organization employee/person, not one clinic assignment.

AUTHORIZED:
Only schema alignment genuinely required for staff master, such as organization_id or missing profile fields proven necessary.

Do not destructively remove legacy role_type/clinic_id if callers still use them.
Mark migration/deprecation need in DEFERRED.

FORBIDDEN:
memberships
roles
Staff UI
Auth provisioning
```

## ST1.2 — Staff clinic memberships schema

```text
CURRENT_GOAL = ST1.2

GOAL:
Create/reuse staff_clinic_memberships only.

Required:
staff_id FK
clinic_id FK
is_primary
is_active
joined_at nullable
left_at nullable
timestamps
UNIQUE(staff_id, clinic_id)

FORBIDDEN:
staff_clinic_roles
login
Staff UI
backfill guesses
```

## ST1.3 — Staff clinic roles schema

```text
CURRENT_GOAL = ST1.3

GOAL:
Create/reuse staff_clinic_roles only.

Required:
membership FK
role_code
created_at
UNIQUE(membership, role_code)

Canonical clinic role codes:
DOCTOR
RECEPTIONIST
TECHNICIAN
Y_SI
CSKH
MANAGER
ADMIN

FORBIDDEN:
SUPER_ADMIN implementation unless already explicitly modeled
login
role UI
permission engine
```

## ST1.4 — Existing staff backfill PLAN ONLY

```text
CURRENT_GOAL = ST1.4

GOAL:
Create a read-only backfill plan from legacy staff role/clinic representation to memberships + roles.

DO NOT execute assignments without verified clinic mapping.
DO NOT guess clinic membership from staff names.

Output exact rows/data needing business confirmation.
```

## ST1.5 — Execute verified Staff membership backfill

```text
CURRENT_GOAL = ST1.5

GOAL:
Backfill only the staff→clinic memberships explicitly verified by Tech Lead/business input.

AUTHORIZED:
Verified mapping only.
Idempotent/duplicate-safe migration or seed mechanism.

FORBIDDEN:
guessing missing mappings
removing legacy columns
UI changes
```

## ST1.6 — Doctor query by Clinic

```text
CURRENT_GOAL = ST1.6

GOAL:
Make active doctor lookup clinic-aware.

Required logical filter:
staff active
membership active
membership clinic = target clinic
role = DOCTOR

Reuse service/rsc-data architecture.

FORBIDDEN:
Reception redesign
Staff CRUD
ClinicSwitcher
```

---

# PHASE D — Authentication

## AUTH1.1 — Supabase server auth identity

```text
CURRENT_GOAL = AUTH1.1

GOAL:
Implement/reuse the smallest server-side helper to resolve the authenticated Supabase user/session according to existing SSR architecture.

FORBIDDEN:
/login UI
staff lookup
roles
clinic selection
Staff CRUD
```

## AUTH1.2 — Auth User → Staff resolver

```text
CURRENT_GOAL = AUTH1.2

GOAL:
Implement server-side resolveCurrentStaff() from auth user id → staff.user_id.

Required:
no client-trusted user id
no service-role shortcut unless explicitly justified

FORBIDDEN:
clinic selection
role permission engine
login page
```

## AUTH1.3 — Active Staff gate

```text
CURRENT_GOAL = AUTH1.3

GOAL:
Deny operational access when authenticated user has no linked staff or staff.is_active=false.

Friendly typed outcome for later UI.

FORBIDDEN:
clinic membership UI
role system
```

## AUTH1.4 — Login page

```text
CURRENT_GOAL = AUTH1.4

GOAL:
Implement /login using Supabase Auth email/password.

UI:
Ant Design
professional clinic style
email
password
show/hide password
loading/error states
no public signup

Successful auth must flow through existing server auth/staff gate.

FORBIDDEN:
Staff CRUD
forgot-password unless explicitly already required
clinic selector
```

## AUTH1.5 — Logout

```text
CURRENT_GOAL = AUTH1.5

GOAL:
Implement logout only.

signOut
→ clear session according to architecture
→ /login

FORBIDDEN:
profile management
password settings
```

## AUTH1.6 — Protected operational routes

```text
CURRENT_GOAL = AUTH1.6

GOAL:
Protect existing operational app routes from unauthenticated access using current Next.js proxy/middleware architecture.

/login remains public.

FORBIDDEN:
clinic authorization
RBAC beyond authenticated active staff gate
```

---

# PHASE E — Active Clinic Context

## CL1.1 — Load active Staff memberships

```text
CURRENT_GOAL = CL1.1

GOAL:
Implement getCurrentStaffClinics() server read.

Return active memberships + safe clinic metadata only.

FORBIDDEN:
/select-clinic UI
ClinicSwitcher
permission mutation
```

## CL1.2 — Single-clinic auto resolution

```text
CURRENT_GOAL = CL1.2

GOAL:
When current active staff has exactly one authorized clinic, resolve it as the target clinic without user selection.

Do not implement visual ClinicSwitcher.
```

## CL1.3 — Multi-clinic selection page

```text
CURRENT_GOAL = CL1.3

GOAL:
Implement /select-clinic for staff with >1 active memberships.

Show only authorized active clinics.
Use Ant Design cards/list with clear clinic name and role summary.

FORBIDDEN:
clinic management
Staff management
```

## CL1.4 — Clinic route foundation

```text
CURRENT_GOAL = CL1.4

GOAL:
Introduce/reuse /c/[clinicCode] routing boundary and safe clinic resolution.

Do not migrate every application page at once.
Implement only the minimum route shell/context authorized by current repo state.

If broad route rewrite is required: SPLIT_REQUIRED.
```

## CL1.5 — requireClinicAccess helper

```text
CURRENT_GOAL = CL1.5

GOAL:
Implement a centralized server helper:
requireClinicAccess(clinicCode)

It must resolve:
clinic
current staff
active membership
roles needed for later permission checks

Client-provided clinicCode is target only, not authorization proof.
```

## CL1.6 — Clinic Switcher

```text
CURRENT_GOAL = CL1.6

GOAL:
Add a header ClinicSwitcher only for users with multiple authorized clinics.

Navigation must preserve clinic route semantics safely.
Do not show unauthorized clinics.

Visual review required once.
```

---

# PHASE F — Multi-Clinic RLS Foundation

## RLS1.1 — current_staff_id helper

```text
CURRENT_GOAL = RLS1.1

GOAL:
Create/reuse a safe DB helper for current authenticated staff id if architecture requires it.

Review SECURITY DEFINER/search_path/execute grants carefully.

FORBIDDEN:
all-table RLS rewrite
```

## RLS1.2 — has_clinic_membership helper

```text
CURRENT_GOAL = RLS1.2

GOAL:
Implement/reuse database helper that verifies active staff membership for a clinic.

Targeted SQL tests only.
```

## RLS1.3 — has_clinic_role helper

```text
CURRENT_GOAL = RLS1.3

GOAL:
Implement/reuse clinic role resolver helper at database boundary.

No full permission framework unless already required.
```

## RLS1.4 — Organization/Clinic/Staff foundation policies

```text
CURRENT_GOAL = RLS1.4

GOAL:
Apply the minimum correct RLS to organization/clinic/staff membership/role foundation.

Do not apply patient/reception/schedule policies yet.
No USING(true) convenience policy on sensitive data.
```

## RLS1.5 — Multi-clinic RLS tests

```text
CURRENT_GOAL = RLS1.5

GOAL:
Add targeted SQL/security tests proving:
PK01 staff can access permitted PK01 foundation data
PK01-only staff cannot gain PK06 access
inactive membership denied
anonymous denied where required

NO FEATURE CHANGES.
```

---

# PHASE G — Staff Admin Module

## ADM-ST1.1 — Staff list read-only

```text
CURRENT_GOAL = ADM-ST1.1

GOAL:
Implement Staff Management read-only list using Ant Design Table.

Features only:
search
clinic filter if authorized
role filter
status filter
loading/empty/error states

No create/edit/deactivate yet.
```

## ADM-ST1.2 — Create Staff Master

```text
CURRENT_GOAL = ADM-ST1.2

GOAL:
Implement create Staff Master only.

Use Ant Design Drawer.
Fields only from actual approved schema.
Do not create Auth account automatically.
Do not assign clinic roles in same Goal unless Staff cannot be created otherwise.
```

## ADM-ST1.3 — Edit Staff Master

```text
CURRENT_GOAL = ADM-ST1.3

GOAL:
Edit Staff Master profile only.

Do not silently change Supabase Auth email if auth identity already exists.
Do not change memberships/roles here.
```

## ADM-ST1.4 — Deactivate/reactivate Staff

```text
CURRENT_GOAL = ADM-ST1.4

GOAL:
Implement staff.is_active deactivate/reactivate behavior.

Use confirmation UI.
No hard delete.
Historical references preserved.
```

## ADM-ST1.5 — Assign Clinic Membership

```text
CURRENT_GOAL = ADM-ST1.5

GOAL:
Admin can assign/deactivate a Staff membership for an authorized clinic.

No role assignment yet.
No staff deletion.
```

## ADM-ST1.6 — Assign Clinic Roles

```text
CURRENT_GOAL = ADM-ST1.6

GOAL:
Admin can assign/remove canonical roles on an existing active membership.

Validate actor authorization server-side.
Do not scatter role checks through UI.
```

## ADM-ST1.7 — Provision Auth account

```text
CURRENT_GOAL = ADM-ST1.7

GOAL:
Implement secure server-side account provisioning/invite for an existing Staff record.

Link auth.users.id → staff.user_id.
Never call Supabase Admin Auth from browser.
Never hardcode default production password.
```

---

# PHASE H — Visit Reason Master Data

## VR1.1 — Visit Reason schema

```text
CURRENT_GOAL = VR1.1

GOAL:
Create/reuse visit_reason_catalog only.

Required concepts:
organization_id
code
name
normalized_name optional
category optional
sort_order
is_active
timestamps
UNIQUE(organization_id, code)

FORBIDDEN:
Reception integration
Admin UI
Diagnosis schema
```

## VR1.2 — Visit Reason read service

```text
CURRENT_GOAL = VR1.2

GOAL:
Implement active Visit Reason search/read layer for organization context.

Search by code/name.
No mutations.
```

## VR1.3 — Visit Reason admin list

```text
CURRENT_GOAL = VR1.3

GOAL:
Ant Design admin Table for Visit Reason catalog.

Search + status + category if available.
Read-only in this Goal.
```

## VR1.4 — Visit Reason create/edit Modal

```text
CURRENT_GOAL = VR1.4

GOAL:
Implement create/edit Visit Reason using one reusable Ant Design Modal form.

Server-side permission required.
Validation errors in Vietnamese.
No direct Supabase mutation from presentation component.
```

## VR1.5 — Visit Reason deactivate/reactivate

```text
CURRENT_GOAL = VR1.5

GOAL:
Implement is_active lifecycle for Visit Reasons.

No hard delete.
New selectors hide inactive entries.
Historical references must remain resolvable.
```

---

# PHASE I — Reception Reasons

## REC-R1.1 — Reception Visit Reason relation schema

```text
CURRENT_GOAL = REC-R1.1

GOAL:
Create/reuse reception_visit_reasons relation and symptom_note support only.

A Reception may have multiple reasons.
Support primary reason if current business model needs it.

FORBIDDEN:
Reception UI redesign
Diagnosis
DVKT
```

## REC-R1.2 — Reception reason DTO/service

```text
CURRENT_GOAL = REC-R1.2

GOAL:
Extend Reception create/read service to persist selected Visit Reason IDs + symptom note safely.

Server validates reason belongs to correct organization and is active for new selection.
```

## REC-R1.3 — Replace free-text reason UI

```text
CURRENT_GOAL = REC-R1.3

GOAL:
Replace Reception free-text "Lý do đến khám" as the primary structured field with searchable Ant Design multi-select backed by Visit Reason catalog.

Keep separate symptom note textarea.
No quick-add catalog button for ordinary Receptionist.

Do NOT change Diagnosis/DVKT yet.
```

---

# PHASE J — Diagnosis Catalog

## DX1.1 — Diagnosis schema audit/alignment

```text
CURRENT_GOAL = DX1.1

GOAL:
Inspect and align diagnosis_catalog for organization scope and stable code-system identity.

Do not rewrite course_diagnoses unless required for schema compatibility.
No admin UI.
```

## DX1.2 — Diagnosis read/search layer

```text
CURRENT_GOAL = DX1.2

GOAL:
Implement active diagnosis search by code system/code/name.

No mutations.
```

## DX1.3 — Diagnosis admin list

```text
CURRENT_GOAL = DX1.3

GOAL:
Read-only Ant Design diagnosis catalog Table.

Search:
code system
code
name
status
```

## DX1.4 — Diagnosis create/edit

```text
CURRENT_GOAL = DX1.4

GOAL:
Implement admin create/edit Diagnosis catalog only.

Do not implement patient diagnosis assignment yet.
Do not let catalog permission imply clinical permission.
```

## DX1.5 — Diagnosis deactivate/reactivate

```text
CURRENT_GOAL = DX1.5

GOAL:
Soft lifecycle for Diagnosis catalog.
No hard delete.
Historical course diagnosis remains renderable.
```

## DX1.6 — Doctor diagnosis selector

```text
CURRENT_GOAL = DX1.6

GOAL:
Implement Doctor-facing searchable diagnosis selector backed by active diagnosis catalog.

Persist through course_diagnoses.
Support primary diagnosis and additional diagnoses only if current schema already supports it.

Receptionist UI must not gain diagnosis permission automatically.
```

---

# PHASE K — Service / DVKT Catalog

## SVC1.1 — Service catalog audit/alignment

```text
CURRENT_GOAL = SVC1.1

GOAL:
Align service_catalog to organization scope and current fields.

No clinic override yet.
No UI.
```

## SVC1.2 — Service admin list

```text
CURRENT_GOAL = SVC1.2

GOAL:
Read-only Ant Design Service/DVKT Table.

Show:
code
name
group
default duration
status
```

## SVC1.3 — Service create/edit Drawer

```text
CURRENT_GOAL = SVC1.3

GOAL:
Implement create/edit Service using Ant Design Drawer.

Fields from actual schema only:
code/name/group/duration/setup/cleanup/resource type/status.

No scheduler changes.
```

## SVC1.4 — Service deactivate/reactivate

```text
CURRENT_GOAL = SVC1.4

GOAL:
Soft lifecycle for Service catalog.
Historical orders preserved.
```

## SVC1.5 — Clinic Service Settings schema

```text
CURRENT_GOAL = SVC1.5

GOAL:
Create/reuse clinic_service_settings only.

Required:
clinic_id
service_id
is_enabled
override durations/resource config as approved
PRIMARY/UNIQUE clinic+service

No UI.
```

## SVC1.6 — Clinic service override resolver

```text
CURRENT_GOAL = SVC1.6

GOAL:
Implement server-side service configuration resolution:
clinic override → organization default.

No scheduling algorithm changes.
```

## SVC1.7 — Doctor DVKT selector

```text
CURRENT_GOAL = SVC1.7

GOAL:
Doctor-facing service/DVKT selector using services enabled for active clinic.

Persist course_service_orders according to existing order source model.

No auto scheduler changes.
```

---

# PHASE L — Reception V3 UI Cleanup

## REC2.1 — Initial Doctor selector clinic-aware

```text
CURRENT_GOAL = REC2.1

GOAL:
Ensure Reception initial doctor selector uses active DOCTOR membership for current clinic.

No hardcoded names.
No Staff editing from Reception.
```

## REC2.2 — Reception Modal responsibility cleanup

```text
CURRENT_GOAL = REC2.2

GOAL:
Refactor Reception Modal so it contains only reception responsibilities:
patient basic fields needed now
initial doctor
visit reasons
symptom note

Remove/move Diagnosis, DVKT and planned session count from Receptionist modal ONLY if their actual downstream clinical UI/service exists or a safe transition is explicitly planned.

Do not break current workflow silently.
If dependent clinical workflow does not yet exist: return BLOCKED/DEFERRED rather than deleting functionality.
```

---

# PHASE M — Clinical / Treatment Course

## CLIN1.1 — Clinical workspace read-only

```text
CURRENT_GOAL = CLIN1.1

GOAL:
Create/reuse Doctor clinical workspace read-only context:
Patient summary
Reception reasons
symptom note
current course
existing diagnosis/orders

No mutations yet.
```

## CLIN1.2 — Treatment Course create policy

```text
CURRENT_GOAL = CLIN1.2

GOAL:
Implement the approved treatment-course creation boundary only.

Must support LT1/LT2/LT3/LT4+ as rows.
No maximum 3 hardcode.
No scheduling.
```

## CLIN1.3 — Planned session count

```text
CURRENT_GOAL = CLIN1.3

GOAL:
Implement/edit planned_session_count in Doctor/Treatment workflow according to permission.

Do not hardcode 5/7/10 allowed values unless business has explicitly approved a restricted catalog.
```

## CLIN1.4 — Clinical save/confirm boundary

```text
CURRENT_GOAL = CLIN1.4

GOAL:
Implement the smallest approved save/confirm/lock behavior for diagnosis + DVKT + treatment plan.

Do not add scheduling in this Goal.
```

---

# PHASE N — Patient Master

## PAT1.1 — Patient schema organization scope

```text
CURRENT_GOAL = PAT1.1

GOAL:
Ensure Patient Master is organization-wide, not owned by one clinic.

No Patient UI redesign.
```

## PAT1.2 — Production identifier normalization

```text
CURRENT_GOAL = PAT1.2

GOAL:
Implement/review safe production normalizers for BHYT/CCCD/phone/DOB boundaries.

Do NOT include legacy Excel repair assumptions such as blindly prepending 0.
```

## PAT1.3 — Exact patient search

```text
CURRENT_GOAL = PAT1.3

GOAL:
Search Patient Master organization-wide by exact normalized BHYT/CCCD/phone identifiers.

No fuzzy name yet.
```

## PAT1.4 — Fuzzy patient name search

```text
CURRENT_GOAL = PAT1.4

GOAL:
Add safe name search to complement exact identifier search.
Do not use name as identity/foreign key.
```

## PAT1.5 — Patient create dedupe gate

```text
CURRENT_GOAL = PAT1.5

GOAL:
Before creating Patient, perform approved duplicate checks and return candidate/conflict outcome.

Do not auto-merge uncertain identities.
```

---

# PHASE O — Basic Appointment & Schedule

## APT1.1 — Appointment clinic integrity

```text
CURRENT_GOAL = APT1.1

GOAL:
Ensure appointment schema and constraints preserve clinic/course/patient/doctor integrity.

No UI.
```

## APT1.2 — Manual appointment create

```text
CURRENT_GOAL = APT1.2

GOAL:
Create one manual appointment safely within active clinic context.
No auto-scheduler.
```

## APT1.3 — Appointment query by clinic/date/doctor

```text
CURRENT_GOAL = APT1.3

GOAL:
Implement server read query for schedule data scoped by clinic + date range + optional doctor.
```

## APT1.4 — Month Matrix read-only

```text
CURRENT_GOAL = APT1.4

GOAL:
Render Month Matrix as a derived projection of appointment rows.

No day_1...day_31 schema.
No drag/drop yet.
```

## APT1.5 — Day Timeline read-only

```text
CURRENT_GOAL = APT1.5

GOAL:
Render daily timeline from appointment rows for active clinic.
No rescheduling yet.
```

## APT1.6 — Appointment Drawer

```text
CURRENT_GOAL = APT1.6

GOAL:
Appointment detail Drawer only.
Read data and allowed local actions already implemented.
Do not invent future scheduling actions.
```

## APT1.7 — Reschedule

```text
CURRENT_GOAL = APT1.7

GOAL:
Implement one appointment reschedule safely.
Validate clinic, doctor and relevant conflicts according to current basic rules.
No full resource scheduler.
```

## APT1.8 — Cancel / No-show state transitions

```text
CURRENT_GOAL = APT1.8

GOAL:
Implement approved appointment status transitions for CANCELLED/NO_SHOW only.
Audit if architecture already requires it.
```

## APT1.9 — Realtime schedule updates

```text
CURRENT_GOAL = APT1.9

GOAL:
Realtime subscription scoped by active clinic + relevant date range.
Do not subscribe to entire organization appointment table.
```

---

# PHASE P — Basic Auto-Fill

## AUTO1.1 — Treatment date generator

```text
CURRENT_GOAL = AUTO1.1

GOAL:
Generate treatment dates from approved policy only.
No time slots.
```

## AUTO1.2 — Clinic scheduling settings read

```text
CURRENT_GOAL = AUTO1.2

GOAL:
Resolve clinic open hours/lunch/slot interval/current scheduling settings.
No scheduling writes.
```

## AUTO1.3 — Doctor slot candidates

```text
CURRENT_GOAL = AUTO1.3

GOAL:
Generate candidate doctor slots using clinic settings and doctor availability.
No machine/resource pipeline yet.
```

## AUTO1.4 — Basic conflicts

```text
CURRENT_GOAL = AUTO1.4

GOAL:
Reject patient duplicate appointment and doctor overlap according to currently implemented basic appointment model.
```

## AUTO1.5 — Atomic create N appointments

```text
CURRENT_GOAL = AUTO1.5

GOAL:
Atomically create the approved course appointments using basic slot logic.
Return FULL/PARTIAL/FAILED where appropriate.
No appointment_steps/resources yet.
```

## AUTO1.6 — Connect clinical plan to schedule action

```text
CURRENT_GOAL = AUTO1.6

GOAL:
Connect approved Treatment Course plan to "Lưu & Xếp lịch" using existing basic scheduler.

Do not expand resource-aware scheduling.
```

---

# PHASE Q — Attendance

## ATT1.1 — Treatment Session schema/integrity

```text
CURRENT_GOAL = ATT1.1

GOAL:
Ensure treatment_sessions safely represents actual attended treatment day/session.
No UI.
```

## ATT1.2 — Check-in

```text
CURRENT_GOAL = ATT1.2

GOAL:
Appointment CHECKED_IN transition only.
Idempotent behavior required.
```

## ATT1.3 — Complete treatment session

```text
CURRENT_GOAL = ATT1.3

GOAL:
Complete one treatment session and update course progress atomically/idempotently.
```

---

# PHASE R — Resources & Full Scheduler

## RES1.1 — Resources per clinic

```text
CURRENT_GOAL = RES1.1

GOAL:
Ensure resources are clinic-scoped with unique clinic+resource_code.
No groups yet.
```

## RES1.2 — Resource groups

```text
CURRENT_GOAL = RES1.2

GOAL:
Create/reuse clinic-scoped resource groups and safe group membership integrity.
```

## RES1.3 — Staff shifts

```text
CURRENT_GOAL = RES1.3

GOAL:
Implement/reuse staff shifts with clinic scope.
No scheduler rewrite.
```

## RES1.4 — Appointment steps

```text
CURRENT_GOAL = RES1.4

GOAL:
Ensure appointment_steps can represent service pipeline staff/resource assignments.
No scoring algorithm.
```

## SCH1.1 — Build service pipeline

```text
CURRENT_GOAL = SCH1.1

GOAL:
Build appointment step pipeline from service orders and resolved service settings.
No reservation algorithm yet.
```

## SCH1.2 — Resource capacity checker

```text
CURRENT_GOAL = SCH1.2

GOAL:
Check capacity for required clinic resources over proposed time windows.
No writes.
```

## SCH1.3 — Technician/staff availability

```text
CURRENT_GOAL = SCH1.3

GOAL:
Check required staff availability based on active membership + shift + existing assignments.
No writes.
```

## SCH1.4 — Cross-clinic doctor overlap

```text
CURRENT_GOAL = SCH1.4

GOAL:
Detect doctor overlap across ALL clinics where the same staff_id is assigned.
No scheduling write changes beyond validation integration if required.
```

## SCH1.5 — Candidate scoring

```text
CURRENT_GOAL = SCH1.5

GOAL:
Score valid candidates using approved preferences only.
Do not invent weights without configuration/business rule.
```

## SCH1.6 — Full atomic scheduler RPC

```text
CURRENT_GOAL = SCH1.6

GOAL:
Implement/upgrade atomic scheduling RPC using approved pipeline, resource capacity, staff availability and cross-clinic conflicts.

Return explicit FULL/PARTIAL/FAILED.
No UI redesign.
```

---

# PHASE S — Follow-Up

## FU1.1 — Follow-up schema

```text
CURRENT_GOAL = FU1.1

GOAL:
Ensure follow_up_cases/contact_attempts are clinic-aware and preserve history.
No automation.
```

## FU1.2 — Inactivity detector

```text
CURRENT_GOAL = FU1.2

GOAL:
Detect treatment-course inactivity using configurable clinic threshold.
No contact UI.
```

## FU1.3 — CSKH queue

```text
CURRENT_GOAL = FU1.3

GOAL:
Render clinic-scoped follow-up queue with safe status/actions already supported.
```

---

# PHASE T — Excel Migration

## IMP1.1 — Import batch/raw staging

```text
CURRENT_GOAL = IMP1.1

GOAL:
Implement import_batches + legacy_source_rows staging only.
Each operational import batch must resolve source clinic before production course/appointment writes.
```

## IMP1.2 — Legacy repair utilities

```text
CURRENT_GOAL = IMP1.2

GOAL:
Implement source-aware Excel repair utilities separately from production normalizers.

Keep raw value, confidence/review metadata where needed.
No production import execution.
```

## IMP1.3 — DSKHTT adapter

```text
CURRENT_GOAL = IMP1.3

GOAL:
Parse DSKHTT source shape into staging/candidate model only.
No monthly/schedule adapter.
```

## IMP1.4 — Monthly/ThongTuyen adapters

Split further if needed. Never use one hardcoded column-letter parser for all sheets.

## IMP1.5 — Patient matching + Merge Review

Do not auto-merge uncertain candidates.

## IMP1.6 — Schedule adapter + reconciliation

Only after patient/course mapping is reliable.

---

# PHASE U — BHXH Integration Foundation

## INT1.1 — Clinic Integration schema

```text
CURRENT_GOAL = INT1.1

GOAL:
Create/reuse clinic_integrations metadata only.

No plaintext password.
No external BHXH call.
No integration session yet unless required by existing model.
```

## INT1.2 — Secret reference abstraction

```text
CURRENT_GOAL = INT1.2

GOAL:
Define/implement approved server-only secret storage abstraction for clinic integration credentials.

Do not expose secret to client.
Do not invent provider if environment decision is unresolved; return BLOCKED if necessary.
```

## INT1.3 — Integration Settings status UI

```text
CURRENT_GOAL = INT1.3

GOAL:
Show safe BHXH integration metadata for current clinic:
configured status
facility code
masked username
last verified/success/error

No raw secret.
No external login yet.
```

## INT1.4 — Configure/rotate credential

```text
CURRENT_GOAL = INT1.4

GOAL:
Authorized clinic admin can configure/rotate integration credential server-side using approved secret abstraction.

Audit safe metadata.
Invalidate old session if current architecture has sessions.
No BHXH lookup yet.
```

---

# PHASE V — BHXH Authorized Adapter

Chỉ thực hiện khi endpoint/protocol/permission chính thức đã được xác nhận.

## BHXH1.1 — Provider authentication only

```text
CURRENT_GOAL = BHXH1.1

GOAL:
Implement BHXH provider authentication/session acquisition only, using credential resolved server-side from active clinic.

Do not implement patient lookup in same Goal.
Do not log password/token/cookie.
```

## BHXH1.2 — Session lifecycle

```text
CURRENT_GOAL = BHXH1.2

GOAL:
Implement safe reuse/refresh/expiry behavior for BHXH session only.
Concurrency-safe per clinic integration.
```

## BHXH2.1 — One patient lookup capability

```text
CURRENT_GOAL = BHXH2.1

GOAL:
Implement exactly one authorized BHXH patient/card lookup capability.

Input from application:
clinicId target
cardNumber/patient context
actor

Server:
authorize clinic
resolve clinic integration
resolve secret/session
call provider
normalize safe response
audit job

Client never supplies external username/password.
```

Mỗi endpoint/chức năng BHXH khác phải là Goal riêng.

---

# 2. Checkpoint Validation — không chạy full build mỗi Goal

## Checkpoint C1 — Multi-Clinic Identity

Sau khi hoàn thành Organization + Clinic + Staff Membership + Roles:

```text
lint
typecheck
build
relevant DB tests
```

## Checkpoint C2 — Auth + Clinic Context + RLS

Run full auth/security checkpoint.

## Checkpoint C3 — Staff + Master Data

Verify:

```text
Admin Staff CRUD/deactivate
Doctor selector dynamic
Visit Reason CRUD/select
Diagnosis CRUD/search
Service CRUD/clinic override
```

## Checkpoint C4 — Reception + Clinical

E2E:

```text
Receptionist creates Reception with reasons
Doctor assigns diagnosis/DVKT/session plan
```

## Checkpoint C5 — Basic Schedule

E2E:

```text
Course → appointments → Month Matrix
```

## Checkpoint C6 — Full Scheduler

DB concurrency/resource/cross-clinic tests.

## Checkpoint C7 — BHXH

Security + integration routing + secret exposure review.

---

# 3. Tech Lead Review Template

Sau mỗi Goal, gửi cho Tech Lead:

```text
CURRENT_GOAL:

AGENT RESULT:

FILES CHANGED:

MIGRATION CREATED:

SELF REVIEW:

VALIDATION:

DEFERRED:

GIT DIFF:
(optional paste/file)
```

Tech Lead chỉ cấp Goal tiếp theo sau:

```text
APPROVE
```

Nếu:

```text
NEEDS_FIX
```

thì tạo Goal sửa riêng:

```text
FIX-<goal-id>-1
```

Không nói "sửa hết các lỗi còn lại".

---

# 4. Final Rule

Agent không được tự chuyển:

```text
CURRENT_GOAL = X
```

thành:

```text
CURRENT_GOAL = X+1
```

Chỉ Tech Lead/user cấp Goal mới.

**STOPPED means STOPPED.**
