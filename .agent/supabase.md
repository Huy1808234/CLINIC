# Thuận Thiên Clinic — Supabase & Database Guidelines

## 1. Scope

This file defines rules for:

- Supabase/PostgreSQL schema
- migrations
- RLS
- database functions/RPC
- Supabase Auth database boundaries
- Supabase clients
- generated database types
- secrets/integration credential storage boundaries
- multi-clinic database integrity

All work is still subject to `AGENTS.md` and CURRENT_GOAL.

Do not implement database work outside CURRENT_GOAL.

---

# 2. Source of Truth

Before database changes, use this priority:

1. Actual applied/current database schema
2. Existing `supabase/migrations/**`
3. Generated database types
4. Existing Supabase client architecture
5. `AGENTS.md`
6. This file
7. `THUAN_THIEN_MULTI_CLINIC_BHXH_TECHLEAD_SPEC_V2_FULL.md`
8. CURRENT_GOAL

Never assume the Tech Lead Spec represents tables already implemented.

Inspect actual repository/database evidence first.

---

# 3. Migration Rules

All schema changes must use:

```text
supabase/migrations/