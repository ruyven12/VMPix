## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.
### Available skills
- openai-docs: Use when the user asks how to build with OpenAI products or APIs and needs up-to-date official documentation with citations, help choosing the latest model for a use case, or explicit GPT-5.4 upgrade and prompt-upgrade guidance; prioritize OpenAI docs MCP tools, use bundled references only as helper context, and restrict any fallback browsing to official OpenAI domains. (file: C:/Users/deysx/.codex/skills/.system/openai-docs/SKILL.md)
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations. (file: C:/Users/deysx/.codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: C:/Users/deysx/.codex/skills/.system/skill-installer/SKILL.md)
### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.

## Project Rules
- Treat the Wrestling side as an active first-class area of this workspace. Do not treat it as secondary to Music.
- For future threads, assume Wrestling is the default focus whenever the user asks for archive work, fixes, rebuilds, routing, people index work, show data work, or admin tool work unless the user explicitly says Music or another section.
- Prefer making the change directly in this workspace instead of telling the user what to edit manually.
- The Wrestling frontend source of truth in this workspace is:
  - `hud-app.js`
  - `wrestling-archive.js`
  - `wrestling-archive-shows.js`
  - `wrestling-archive-people.js`
  - `index.html`
- The deployed Wrestling backend currently lives outside this workspace and is referenced by `https://wrestling-archive.onrender.com`. When a task depends on backend behavior, say that clearly and continue as far as possible from this repo instead of stopping early.
- Preserve the existing VMPix visual system and route shell unless the user asks for a redesign. Wrestling should feel native to the same site, not like a separate temporary add-on.
- Prefer operational improvements that reduce repeat manual work. Good examples:
  - adding or improving rebuild tools
  - documenting the workflow
  - creating validation scripts
  - centralizing config
  - reducing hard-coded one-off steps
- The Wrestling admin route is part of the intended workflow. Rebuild and verification tools should be treated as production-facing maintenance features, not throwaway debug code.
- If a Wrestling task requires changes in both frontend and backend, complete the frontend side here and document exactly what backend counterpart is still needed.
- When adding new Wrestling logic, keep the path and naming conventions aligned with the existing route structure:
  - `/wrestling`
  - `/wrestling/shows/...`
  - `/wrestling/people/...`
- Do not remove or weaken existing Music functionality while improving Wrestling unless the user explicitly asks for a shared refactor.
- If the user asks for "make it work" on the Wrestling side, prefer this order:
  1) fix broken runtime behavior
  2) stabilize data/rebuild flow
  3) improve admin tooling
  4) document the workflow
  5) polish UX
- Reference `WRESTLING-WORKFLOW.md` for repo-specific operating guidance before inventing a new process.
