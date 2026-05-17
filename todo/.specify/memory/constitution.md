# Narvalha Constitution

## Core Principles

### I. Security-First Multi-tenancy
All data access MUST be isolated by `barbershop_id` via Row Level Security (RLS) on the Supabase backend. Security is non-negotiable; no client shall ever access data from another.

### II. Mobile-First UX
The user interface is designed for barbers who use mobile devices. Every interaction must be accessible, responsive, and functional for single-handed use during high-paced work.

### III. React + Tailwind (Beige Theme)
All components follow the React/TypeScript stack. UI design must consistently use the defined beige color palette configured in `index.css` to maintain brand identity.

### IV. Type Safety & Maintainability
Strict TypeScript typing is required for all data models. Logic should be modular and testable, preferring composition over complex inheritance patterns.

### V. Iterative SaaS Evolution
Evolution towards a full SaaS model (Stripe integration, subdomains) is iterative, prioritized by the roadmap in `AGENTE.md`, and governed by rigorous validation.

## Technical Standards
- **Backend**: Supabase (PostgreSQL), Edge Functions, RLS.
- **Frontend**: React (Vite), Tailwind CSS, Lucide React.
- **Compliance**: LGPD adherence and data transparency are mandatory for all customer-facing features.

## Governance
- **Documentation**: `AGENTE.md` is the ground truth for progress. All new tasks must be verified against current priorities.
- **Commitments**: No code is committed without validation or testing.
- **Amendments**: Changes to this constitution require team review and synchronization with architectural directives.

**Version**: 1.0.0 | **Ratified**: 2026-05-16
