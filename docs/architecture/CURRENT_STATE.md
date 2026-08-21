# Current Implementation State

Last updated: 2026-08-21

## Stack

- **Framework**: Next.js 16.3.1 (App Router, Turbopack)
- **UI & Styling**: React 19, Tailwind CSS v4, Vanilla CSS design tokens (`src/styles/globals.css`)
- **Language**: TypeScript 5.9.3 (strict mode)
- **Database & Auth Platform**: Supabase (PostgreSQL 17.6) via `@supabase/supabase-js` & `@supabase/ssr`
- **Validation**: Zod 3.25
- **File Processing**: `xlsx` (Excel migration)
- **Package Manager**: npm 11.16.0 / Node.js v24.18.1

---

## Repository Foundation

- **Status**: `IMPLEMENTED`
- **App Shell & Layout**: `src/components/layout/` (`AppShell.tsx`, `Sidebar.tsx`, `Header.tsx`)
- **Primitive UI Components**: `src/components/ui/` (`Button.tsx`, `Input.tsx`, `Badge.tsx`, `Card.tsx`, `Modal.tsx`, `Alert.tsx`)
- **Supabase Clients**: `src/supabase-clients/` (`browser.ts`, `server.ts`, `middleware.ts`, `admin.ts`)
- **App Router Pages**:
  - `/` (Dashboard overview)
  - `/reception` (Reception & patient intake)
  - `/schedule` (Month Matrix & Day Timeline)
  - `/patients` (Patient Master directory)
  - `/patients/[id]` (360° patient clinical history)
  - `/staff` (Staff management & clinic assignment)
  - `/migration` (Excel migration & staging workbench)

---

## Multi-Clinic

- **Status**: `IMPLEMENTED`
- **Tables**: `organizations`, `clinics`, `staff_clinic_memberships`, `staff_clinic_roles`
- **Migration**: `supabase/migrations/20260821000008_multi_clinic_foundation.sql`
- **Domain Types**: `src/types/clinic.ts`
- **Capabilities**:
  - Organization Master with default seed `THUAN_THIEN` (Thuận Thiên).
  - Multi-clinic support (clinics are rows, data-driven, unlimited count).
  - Staff-to-clinic many-to-many relationship with primary clinic flag.
  - Multi-role assignment per clinic membership (`DOCTOR`, `RECEPTIONIST`, `TECHNICIAN`, `Y_SI`, `CSKH`, `MANAGER`, `ADMIN`).

---

## Authentication

- **Status**: `PARTIAL`
- **Implemented**: Supabase SSR client architecture (`src/supabase-clients/server.ts`, `browser.ts`, `middleware.ts`, `admin.ts`).
- **Not Implemented**: End-user login page, password reset, session-bound clinic context selector (DEFERRED to G-MC3).

---

## Staff

- **Status**: `IMPLEMENTED`
- **Staff Master Table**: `public.staff` (Canonical person/employee identity).
- **Legacy Column**: `staff.role_type` (`LEGACY / TEMPORARY`, retained for backward compatibility).
- **Service & Queries**: `src/rsc-data/staff/get-staff.ts` (`getStaffList`, `getClinicsList`, `getOrganizationsList`).
- **Server Actions**: `src/app/actions/staff-actions.ts` (`createStaffAction`, `updateStaffAction`, `assignStaffClinicAction`, `toggleStaffStatusAction`, `deactivateMembershipAction`).
- **Validation**: `src/lib/validation/staff-schemas.ts`.
- **UI**: `src/components/staff/` (`StaffTable.tsx`, `StaffModal.tsx`, `StaffClientView.tsx`) & route `/staff`.

---

## Master Data

- **Status**: `IMPLEMENTED`
- **Diagnosis Catalog**: `diagnosis_catalog` table (ICD-10 codes, `is_primary`, `raw_text`).
- **Service Catalog (DVKT)**: `service_catalog` table (YHCT & PHCN services, durations, resource types).
- **Resource Management**: `resources`, `resource_groups`, `resource_group_members` (15 machine combos seeded in migration 2).
- **Scheduling Settings**: `scheduling_settings` table (open/close times, lunch break 11:30–13:00, 5-minute slot intervals).
- **Migrations**: `supabase/migrations/20260821000002_catalogs_and_resources.sql`, `20260821000006_seed_default_data.sql`.

---

## Patient

- **Status**: `IMPLEMENTED`
- **Tables**: `patients`, `patient_insurance_cards`, `patient_measurements`, `patient_alerts`.
- **Deduplication Engine**: `src/lib/patients/deduplication.ts` (5-tier priority matching: BHYT -> CCCD -> Phone+DOB+Name -> Name+DOB+Address -> Review candidate).
- **Normalizers**: `src/utils/` (`normalize-phone.ts`, `normalize-cccd.ts`, `normalize-bhyt.ts`, `format-person-name.ts`, `format-date.ts`, `format-time.ts`).
- **Validation**: `src/lib/validation/patient-schemas.ts`.
- **Queries**: `src/rsc-data/patients/` (`get-patient.ts`, `search-patients.ts`, `get-patient-history.ts`).
- **UI**: `/patients` (directory with search) and `/patients/[id]` (360° clinical history timeline).

---

## Reception

- **Status**: `IMPLEMENTED`
- **Table**: `receptions`.
- **Service**: `src/lib/reception/reception-service.ts` (`processReceptionIntake`).
- **Server Action**: `src/app/actions/reception-actions.ts` (`submitReceptionAction`).
- **Validation**: `src/lib/validation/reception-schemas.ts`.
- **Queries**: `src/rsc-data/reception/` (`get-receptions.ts`, `get-reception-stats.ts`).
- **UI**: `/reception` with `DeduplicationBanner.tsx`, `ReceptionStatsCards.tsx`, `ReceptionQueueTable.tsx`, and `ReceptionClientView.tsx`.

---

## Treatment Course

- **Status**: `IMPLEMENTED`
- **Tables**: `treatment_courses`, `course_diagnoses`, `course_service_orders`, `treatment_course_tags`.
- **Service**: `src/lib/treatment/course-service.ts` (Sequential course incrementation: LT1 -> LT2 -> LT3).
- **Validation**: `src/lib/validation/treatment-schemas.ts`.
- **Queries**: `src/rsc-data/treatment/` (`get-treatment-courses.ts`, `get-course-details.ts`, `get-catalogs.ts`).

---

## Scheduling

- **Status**: `IMPLEMENTED`
- **Tables**: `appointments`, `appointment_steps`, `treatment_sessions`.
- **Scheduling Engine**:
  - `src/lib/scheduling/auto-scheduler.ts` (RPC `schedule_treatment_course` + TypeScript fallback).
  - `src/lib/scheduling/generate-slots.ts` (5-minute intervals, lunch break exclusion).
  - `src/lib/scheduling/detect-conflicts.ts` & `src/lib/scheduling/slot-scoring.ts`.
  - `src/lib/scheduling/appointment-service.ts` (`rescheduleAppointment` with manual override lock, `updateAppointmentStatus`).
- **Derived Presentation Views**:
  - Month Matrix (31 days) dynamic grouping: `src/rsc-data/schedule/get-month-schedule.ts`.
  - Day Timeline (5-minute agenda) dynamic slots: `src/rsc-data/schedule/get-day-schedule.ts`.
- **Realtime Sync**: `src/hooks/useRealtimeSchedule.ts` (Supabase Realtime subscription on `appointments`).
- **Server Actions**: `src/app/actions/scheduling-actions.ts` (`autoScheduleAction`, `rescheduleAppointmentAction`, `updateAppointmentStatusAction`).
- **UI**: `/schedule` with `MonthMatrixGrid.tsx`, `DayTimelineGrid.tsx`, `AutoScheduleModal.tsx`, `ScheduleClientView.tsx`.

---

## BHXH Integration

- **Status**: `NOT IMPLEMENTED`
- **Target Architecture**: Clinic $\rightarrow$ Clinic Integration $\rightarrow$ BHXH Credential.
- **Notes**: Credentials will be stored separately per clinic integration; not yet authored in schema.

---

## Database / RLS

- **Status**: `IMPLEMENTED`
- **Applied Migrations** (8 forward-only SQL files in `supabase/migrations/`):
  1. `20260821000001_core_schema.sql` (Patients, Insurance, Measurements, Alerts, Staff, Receptions, Treatment Courses)
  2. `20260821000002_catalogs_and_resources.sql` (ICD-10, Services, Machine Combos)
  3. `20260821000003_scheduling_and_attendance.sql` (Appointments, Sessions, Staging)
  4. `20260821000004_rpc_schedule_treatment_course.sql` (Atomic auto-scheduling RPC)
  5. `20260821000005_rls_and_policies.sql` (Row Level Security & policies)
  6. `20260821000006_seed_default_data.sql` (Baseline 4 Doctors, 15 Machine Combos, YHCT services)
  7. `20260821000007_allow_anon_clinic_ops.sql` (Operational RLS policies)
  8. `20260821000008_multi_clinic_foundation.sql` (Organizations, Clinics, Memberships, Roles)
- **Security**: RLS enabled on all operational tables.

---

## Tests / Validation

- **Status**: `IMPLEMENTED`
- **Test Suites** (`tests/unit/`):
  - `normalizers.test.ts` (Phone, CCCD, BHYT, Name, Date/Time parsing)
  - `treatment-course.test.ts` (Course schemas, reception intake validation)
  - `scheduling.test.ts` (Slot generation, conflict detection, auto-scheduler)
  - `migration.test.ts` (Excel workbook parser, row normalizer, validation report)
  - `multi-clinic.test.ts` (8 Multi-Clinic relationship and constraint cases)
  - `staff-management.test.ts` (Staff creation, multi-clinic assignments, multi-role validation, deactivation)
- **Validation Commands**:
  - `npm run test` $\rightarrow$ PASS (6/6 suites)
  - `npx tsc --noEmit` $\rightarrow$ PASS (0 errors)
  - `npm run lint` $\rightarrow$ PASS (0 errors)
  - `npm run build` $\rightarrow$ PASS (9 routes generated)

---

## Architecture Invariants

1. **Patient Master is Organization-Wide**: Deduplication and patient identity span across clinics.
2. **Operational Records are Clinic-Scoped**: Receptions, appointments, and machine resources belong to specific clinics.
3. **Staff May Belong to Multiple Clinics**: Connected via `staff_clinic_memberships`.
4. **Staff Roles May Differ by Clinic**: Controlled via `staff_clinic_roles`.
5. **Clinic Count is Data-Driven**: Never hardcoded.
6. **Schedule is a Derived View**: Never store `day_1 ... day_31` columns in the database.
7. **No Name-Based Foreign Keys**: All relational identities use database UUIDs.
8. **Forward-Only Database Migrations**: Historical migrations are immutable.

---

## Known Deferred

- `G-MC3`: Authentication & Login Flow with post-login clinic context.
- `G-MC4`: Global Header Clinic Switcher and clinic-scoped navigation context.
- `G-MC5`: Fine-grained Multi-Clinic RLS data isolation.
- `BHXH Integration`: Clinic BHXH gateway connection and XML export.
- `Real Clinic Seed Data`: Production clinic names and addresses to be provided by business.