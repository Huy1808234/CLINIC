# Thuận Thiên Clinic — Frontend Architecture & UI Guidelines

## 1. Frontend Stack

Primary frontend stack:

- Next.js App Router
- React
- TypeScript strict
- Ant Design as the primary UI component system

React Server Components are the default.

Use `"use client"` only when required for:

- user interaction;
- browser APIs;
- local interactive state;
- Ant Design components that require client behavior.

Do not convert an entire page to a Client Component only because one small section is interactive.

---

# 2. Directory Responsibilities

## `src/app/`

Responsible for:

- routes;
- layouts;
- loading/error boundaries;
- route composition;
- route handlers;
- server actions where appropriate.

Keep `page.tsx` small.

A page should primarily:

```text
load data
→ compose domain components
→ render