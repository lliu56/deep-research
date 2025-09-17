# Repository Guidelines

## Project Structure & Module Organization
- Application logic lives under `src/`, with orchestrator entrypoints in `src/run.ts` (CLI) and `src/api.ts` (Express API).
- Agent orchestration and prompt helpers sit in `src/deep-research.ts`, `src/prompt.ts`, and `src/feedback.ts`.
- Reusable AI utilities are in `src/ai/`, including `text-splitter.ts` and provider wiring. Keep shared helpers in this folder.
- Tests should mirror source paths under `src/**`, using `.test.ts` co-located like `src/ai/text-splitter.test.ts`.

## Build, Test, and Development Commands
- `npm install` installs TypeScript, tsx, and AI SDK dependencies (Node 22.x).
- `npm run start` launches the CLI research flow via `src/run.ts`, loading secrets from `.env.local`.
- `npm run api` boots the REST API server locally.
- `npm run docker` matches container startup configuration without loading local env files.
- Format with `npm run format` (Prettier + import sorting). Run it before committing.

## Coding Style & Naming Conventions
- Codebase uses TypeScript with ES modules; stick with 2-space indentation and single quotes.
- Prefer descriptive function names (`fetchReportSummary`) and kebab-case filenames (`text-splitter.ts`).
- Leverage `prettier.config.mjs` defaults; no manual line wrapping unless readability demands.
- Group imports by module domain; rely on the sort-imports plugin rather than manual rearrangement.

## Testing Guidelines
- Current tests rely on Node’s built-in runner; execute `node --test src/ai/text-splitter.test.ts`.
- Add new `.test.ts` files next to the modules they cover and keep assertions deterministic.
- Aim for meaningful coverage on prompt construction, provider selection, and failure handling paths.
- Document any external service stubs or fixtures in the test file header comments.

## Commit & Pull Request Guidelines
- Follow the existing history: imperative, lowercase messages with prefixes like `feat:`, `fix:`, or `docs:`.
- Each commit should isolate a logical change and include formatting updates when they affect touched files.
- Pull requests need a problem statement, summary of changes, validation notes (commands run), and linked issues.
- Include screenshots or sample JSON responses when tweaking API surfaces or run output.

## Environment & Configuration
- Copy `.env.example` (if present) to `.env.local` and supply provider keys before running agents.
- Keep sensitive keys out of commits—use the provided Docker setup for sharing reproducible environments.
- Set `BYPASS_DEEP_RESEARCH=true` in `.env.local` to use mock data from `/test/mock-output.json` for testing.

## Contact Research Pipeline (Refactored Architecture)

### Input Configuration
The system now reads configuration from `RESEARCH_INPUT.json` instead of CLI prompts:
```json
{
  "query": "Research query for contact discovery",
  "auditing_criteria": "Verification criteria for contact accuracy", 
  "depth": 2,
  "breadth": 4,
  "output_format": "structured_json"
}
```

### Automated Execution Flow
1. **Cron Job Trigger** - Scheduled execution every {x} days at {n} intervals
2. **Contact Scraping** - Deep research to discover {n} contacts matching search parameters
3. **Contact Verification** - Auditing flow that randomly samples contacts to verify accuracy
4. **Database Insertion** - Structured JSON output synced with contact database schemas
5. **Email Delivery** - Research report delivered via Resend email after completion

### Contact Database Schema
Each discovered contact must include these fields:
- `name` - Contact's full name
- `email` - Contact's email (must be unique)
- `company` - Company name
- `tags` - Comma-separated tags (e.g., "new york,private school")
- `position` - Official job title (e.g., Director of Technology, Principal)
- `city` - City location of school
- `state-province` - State or province
- `country` - Country
- `number` - Phone number with extension if available (leave blank if not found)
- `time_zone` - Local time zone (e.g., "EST", "PST")
- `department` - Department or division (leave blank if unclear)
- `priority` - Decision-maker priority (1 = highest, increasing numbers = lower)
- `signal` - Type of signal detected (e.g., Funding, Hiring, Article)
- `signal_level` - Numeric signal strength (1 = highest priority, larger = lower)
- `compliment` - One-sentence compliment referencing the signal
- `industry` - Contact's industry (e.g., Education)
- `links` - Comma-separated signal source links
- `source` - Hard-coded as "deep-research"

### Output Modes
- **Structured JSON** - Database-ready contact records for insertion
- **Verification Report** - Auditing results and accuracy metrics
- **Email Report** - Comprehensive research summary delivered to stakeholders

### Task Excution Must Do's (Claude Code Should Follow):
# Claude Code Guidelines

## 1. Plan and Execute Mode
- **Understand the User's Request**: Fully comprehend the user's requirements. 
- **Clarify Ambiguities**: If the request is unclear, ask for further clarification.
- **Break Down Tasks**: Divide complex tasks into smaller, manageable chunks.
- **Plan Before Executing**: Ensure that each task is well-planned and that execution follows the plan.

## 2. Changes Should Be Concise and Targeted
- **Simplicity**: Changes should be straightforward and easy to understand.
- **Modularity**: Keep changes modular to allow for easy maintenance and testing.
- **No Unintended Impact**: Ensure changes don’t interfere with other parts of the code.

## 3. Backend and Frontend Separation
- **Backend Changes**: Ensure that backend modifications do not affect the UI.
- **Frontend Changes**: UI adjustments should not interfere with backend logic or functionality.

## 4. UI/UX Changes
- **Small, Modular Changes**: Focus on small, isolated modifications to improve UX.
- **Consistency**: Use existing UI colors, styles, and elements to ensure consistency across the platform.

## 5. Systematic Changes
- **Plan Thoroughly**: For systematic changes, take time to plan and analyze the entire system.
- **Evaluate Requirements**: Ensure that the changes align with the system’s goals and requirements before executing.
