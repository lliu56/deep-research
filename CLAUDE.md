# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Main Commands
- `npm start` - Run the interactive CLI research tool
- `npm run api` - Start the Express API server on port 3051
- `npm run format` - Format code using Prettier

### Docker Commands
- `docker build -f Dockerfile` - Build Docker image
- `docker compose up -d` - Run container in background
- `docker exec -it deep-research npm run docker` - Run research tool in container

## Architecture Overview

This is an AI-powered deep research tool that performs iterative web research using search engines and LLMs. The core architecture follows this flow:

1. **Query Generation** (`src/deep-research.ts:generateSerpQueries`) - Converts user queries into multiple SERP search queries
2. **Search & Processing** (`src/deep-research.ts:processSerpResult`) - Executes searches via Firecrawl and extracts learnings
3. **Recursive Research** (`src/deep-research.ts:deepResearch`) - Iteratively deepens research based on findings
4. **Report Generation** - Produces final markdown reports or concise answers

### Key Components

- **`src/deep-research.ts`** - Core research engine with recursive depth/breadth control
- **`src/run.ts`** - Interactive CLI interface for research sessions
- **`src/api.ts`** - Express REST API with `/api/research` and `/api/generate-report` endpoints
- **`src/ai/providers.ts`** - LLM provider abstraction supporting OpenAI o3-mini, DeepSeek R1, and custom models
- **`src/feedback.ts`** - Generates follow-up questions to refine research direction
- **`src/prompt.ts`** - System prompts for LLM interactions

### Environment Configuration

Required environment variables:
- `FIRECRAWL_KEY` - For web search and content extraction
- `OPENAI_KEY` or `FIREWORKS_KEY` - For LLM processing

Optional configuration:
- `FIRECRAWL_CONCURRENCY` - Concurrent search limit (default: 2)
- `CONTEXT_SIZE` - LLM context size (default: 128,000)
- `OPENAI_ENDPOINT` - Custom OpenAI-compatible endpoint
- `CUSTOM_MODEL` - Override model selection

### Research Parameters

- **Breadth** (2-10, default 4) - Number of parallel search queries per iteration
- **Depth** (1-5, default 2) - Number of recursive research iterations
- The system automatically reduces breadth and depth in recursive calls to manage complexity

### Output Modes

- **Report Mode** (default) - Generates comprehensive markdown reports saved to `report.md`
- **Answer Mode** - Produces concise answers saved to `answer.md`
- **API Mode** - Returns JSON responses via REST endpoints

## Code Style

Uses Prettier with:
- 2-space indentation
- Single quotes
- Trailing commas
- Automatic import sorting via `@ianvs/prettier-plugin-sort-imports`

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
