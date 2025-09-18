# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working inside this repository.

## Development Commands
- `npm run start` – Execute the deep-research pipeline non-interactively. The run reads query/config values from `RESEARCH_INPUT.json` instead of prompting in the CLI.
- `npm run api` – Start the Express API server on port 3051, exposing `/api/research` for automation flows.
- `npm run docker` – Mirror the containerised run configuration (reads env from the runtime environment, not `.env.local`).
- `npm run format` – Apply Prettier with automatic import sorting to all TypeScript sources; run before committing.

## Pipeline Overview
1. **Scheduler Trigger** – A cron job (GitHub Action or external) invokes the CLI or API on the cadence defined in infrastructure code.
2. **Input Load** – `RESEARCH_INPUT.json` supplies the user query, auditing criteria, breadth, depth, and desired output format.
3. **Contact Scraping** – The agent scrapes `{n}` contacts according to `{search_params}`, building the `{data_structure}` defined in the feature docs.
4. **Verification** – Contacts are checked against `{verify_contacts}` so hallucinated or low-confidence entries are dropped before persistence.
5. **Auditing Flow** – Randomly sample contacts, re-run research, and repair inaccuracies; log remediation notes in the final report.
6. **Persistence** – Verified contacts are written to the shared contacts database in the schema below, keeping email flow applications in sync.
7. **Reporting & Delivery** – Generate the final research report and deliver it via Resend email after successful DB insertion.

### Core Modules & Files
- `src/deep-research.ts` – Orchestrates scraping, verification, and auditing passes.
- `src/run.ts` – Cron-facing entrypoint that boots the pipeline and ingests `RESEARCH_INPUT.json`.
- `src/api.ts` – Provides REST hooks for triggering research runs programmatically.
- `src/feedback.ts` / `src/prompt.ts` – Prompting and follow-up generation used during auditing.
- `test/mock-output.json` & `test/mock-report.html` – Mock data served when bypassing the live research flow.

## Input & Configuration
- Maintain `RESEARCH_INPUT.json` at the project root; update it whenever query, depth, breadth, or output shape changes. Use consistent casing (e.g. `auditingCriteria`).
- `.env.local` (or deployment secrets) must include provider keys (`FIRECRAWL_KEY`, `OPENAI_KEY`/`FIREWORKS_KEY`) plus email/DB credentials required for persistence and Resend delivery.
- Toggle `BYPASS_DEEP_RESEARCH=true` during local development to skip external calls and rely on mock outputs for fast iteration.

## Output Schema
Structured JSON written to the contacts database must mirror the contacts table in `docs/emailflow-db-schemas.md`:
- `name`, `email`, `company`, `position`, `department`
- `city`, `stateProvince`, `country`, `timeZone`
- `number`, `priority`, `signal`, `signalLevel`, `compliment`
- `industry`, `tags` (array of strings), `links` (string), `source` (set to `"deep-research"`)
Reference `example_output.md` for concrete formatting. Use an array for `tags`; for `links`, use a string (comma-separated if multiple URLs). Keep `signalLevel` as a string (e.g., '1' through '10').

## Auditing & Reporting Expectations
- Document every correction made during auditing inside the final report payload.
- Ensure reports and structured JSON remain synchronised; failures to insert into the DB should block email delivery.
- When adjusting the pipeline, preserve compatibility with the email flow app that reads from the shared database.

## Testing & Mocking
- Use Node’s built-in runner for targeted tests (e.g. `node --test src/ai/text-splitter.test.ts`).
- Under bypass mode, validate that the pipeline still writes mock contacts and emits `mock-report.html` to keep downstream automation exercised.

## Claude Code Execution Guidelines

### Plan and Execute Mode
- Understand the request, clarify ambiguity, and break work into deliberate steps before modifying code.
- Produce a written plan for multi-step tasks and execute sequentially.

### Concise, Targeted Changes
- Keep modifications scoped and modular; avoid ripples outside the intended feature.
- Maintain separation between backend logic and any UI-facing artefacts.

### UI/UX Considerations
- Apply incremental, consistent changes; reuse existing components and styles.

### System-wide Changes
- Analyse the full impact of refactors before coding; confirm alignment with pipeline requirements described above.
