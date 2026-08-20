# Project Memory

## Core
Tutta l'interfaccia DEVE essere in italiano. Sempre. Nessun testo inglese nella UI.
Ogni modifica DEVE migliorare UI/UX: super semplice, intuitivo, moderno. Sempre.
Gestionale NCC: Plus Jakarta Sans headings, DM Sans body. Mobile-first responsive.
Supabase multi-tenant backend: Org-based RLS on all tables, strict RBAC via `user_roles`.
Security: SECURITY DEFINER for org/role checks. Rate-limiting and JWT mandatory for Edge functions.

## Memories
- [Lingua italiana](mem://preferences/language) — Tutti i testi UI devono essere in italiano, sempre
- [UX Quality](mem://preferences/ux-quality) — Ogni modifica deve migliorare UI/UX: semplice, intuitivo, moderno
- [Auth & Access Control](mem://auth/access-control) — Email/Google OAuth, strict RBAC in user_roles table, visibility rules
- [Architecture & DB Strategy](mem://architecture/database-strategy) — NCC multi-tenant, servizi/autisti/veicoli/fornitori tables
- [Security Hardening](mem://security/hardening-protocols) — Edge function validation, pgcrypto hashing, JWT requirements, rate limiting
- [UI/UX Guidelines](mem://style/design-direction) — Minimal Notion-like aesthetic, Plus Jakarta/DM Sans, mobile-first rules
- [Costi e scadenze](mem://features/costi-scadenze) — Inserisci Costi (autisti/mezzi/altri), fonte unica scadenze, notifiche dedup, tipi configurabili per org
