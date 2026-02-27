# Technology Stack

**Analysis Date:** 2026-02-28

## Languages

**Primary:**
- TypeScript 5.x - All source code (frontend + backend)
- JavaScript (ES2017 target) - Compiled output

**Secondary:**
- CSS - Styling with Tailwind CSS

## Runtime

**Environment:**
- Node.js (latest LTS implied by Next.js 16)
- Browser runtime (React 19 client-side)

**Package Manager:**
- npm (implied by package.json)
- Lockfile: `package-lock.json` (not present in initial scan, but standard)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework (App Router)
- React 19.2.3 - UI library

**Database:**
- Drizzle ORM 0.45.1 - Type-safe SQL query builder
- better-sqlite3 12.6.2 - SQLite3 driver

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind

**Validation:**
- Zod 4.3.6 - TypeScript-first schema validation

**Testing:**
- Not detected - No test framework configured

**Build/Dev:**
- ESLint 9 - Code linting
- TypeScript 5 - Type checking
- Drizzle Kit 0.31.9 - Database migrations

## Key Dependencies

**Critical:**
- next 16.1.6 - Framework
- react 19.2.3 - UI library
- drizzle-orm 0.45.1 - ORM
- better-sqlite3 12.6.2 - Database driver
- zod 4.3.6 - Validation

**Authentication:**
- jsonwebtoken 9.0.3 - JWT tokens
- bcryptjs 3.0.3 - Password hashing

**UI Components:**
- lucide-react 0.575.0 - Icons

**Markdown:**
- marked 17.0.3 - Markdown parser
- react-markdown 10.1.0 - React markdown renderer
- remark-gfm 4.0.1 - GitHub Flavored Markdown

**Utilities:**
- clsx 2.1.1 - Classname utility
- tailwind-merge 3.5.0 - Tailwind class merging

## Configuration

**Environment:**
- `.env.local` file present - Contains environment configuration
- Key config: `DATABASE_PATH` - SQLite database file path (default: `./bugbase.db`)

**Build:**
- `next.config.ts` - Next.js configuration (minimal, mostly empty)
- `tsconfig.json` - TypeScript configuration (paths: `@/*` → `./src/*`)
- `drizzle.config.ts` - Drizzle ORM configuration
- `postcss.config.mjs` - PostCSS with Tailwind
- `eslint.config.mjs` - ESLint with Next.js configs

## Platform Requirements

**Development:**
- Node.js 18+
- npm or compatible package manager

**Production:**
- Node.js runtime
- SQLite database file storage
- File system access for uploads (attachments)

---

*Stack analysis: 2026-02-28*
