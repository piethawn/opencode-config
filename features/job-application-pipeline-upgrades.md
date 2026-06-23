# Job Application Pipeline Upgrades — Implementation Plan

**Date:** 2026-06-22  
**Status:** Planned — awaiting go-ahead  
**Source:** Daily Notes/2026-06-22.md, Daily Notes/2026-06-20.md, SKILL.md

---

## Goal

Upgrade the existing job application pipeline by adding LinkedIn-native search capability (JobSpy MCP server), contact enrichment (Hunter.io), a startup targeting list, and a cold outreach template — all integrated into the current OpenCode / MCP setup.

---

## Context

- **Current pipeline:** Uses JSearch MCP via RapidAPI for broad search (Indeed, Glassdoor, ZipRecruiter). Skill lives at `~/.config/opencode/skills/job-application-pipeline/SKILL.md`.
- **Planned upgrades** (from 2026-06-20 research notes): JobSpy for LinkedIn/Wellfound roles that JSearch misses; Hunter.io for direct hiring manager emails; outreach template for bypassing ATS at startups; Series A/B target list.
- **Previous setup:** Was migrated to Hermes agent on 2026-06-19, but currently working in OpenCode.

---

## Step 1 — Install & Configure JobSpy MCP Server

1. **Clone repos:** Clone `borgius/jobspy-mcp-server` and the underlying `Bunsly/JobSpy` Python tool
2. **Install dependencies:** `npm install` in the MCP server directory; `pip install -r requirements.txt` in JobSpy directory
3. **Test standalone:** Run `npm start` and verify the server responds on port 9423
4. **Register in OpenCode:** Add a new `jobspy` entry to `mcp` section in `~/.config/opencode/opencode.json`
5. **Validate end-to-end:** Run a test search from OpenCode (e.g., "software engineer remote") and confirm results return

---

## Step 2 — Set Up Hunter.io

1. **Create free account** at hunter.io (25 lookups/month)
2. **Get API key** and store it securely (e.g., in `.zshrc` as `HUNTER_API_KEY`)
3. **Pick 5 test targets** from your Series A/B startup list (or from existing job search notes)
4. **Run lookups:** Test domain searches for `hiring@`, `recruiting@`, and find-verified emails for CTO/VP Engineering roles
5. **Document results:** Note hit rate, confidence scores, and any patterns (e.g., `{first}@company.com` vs `first.last@`)

---

## Step 3 — Draft 3-Sentence Outreach Template

Based on the 2026-06-20 tactical notes ("Don't send resumes. Send 3-sentence emails referencing a specific project and stack overlap"):

- **Sentence 1:** Hook referencing a specific project from portfolio + stack overlap with the company's tech
- **Sentence 2:** Evidence of shipping (1-2 lines on a relevant side project, lab, or GitHub repo)
- **Sentence 3:** Soft ask (10-min chat, referral, or application pointer)
- Create **2 variants:** one for technical founders/CTOs, one for recruiters

---

## Step 4 — Identify 10 Series A/B Startups

1. **Sources:** Wellfound (AngelList), Crunchbase, and YC company lists
2. **Filter criteria:** Series A or B, remote-first, cybersecurity / cloud / infrastructure / DevOps adjacent, non-defense, no clearance requirements
3. **Output format:** Table with company name, funding stage, tech stack signals from job posts/careers page, and Hunter.io domain
4. **Validation:** Cross-check 2-3 companies against active job postings to confirm they're actually hiring

---

## Step 5 — Update the SKILL.md (Optional but Recommended)

If you want the pipeline to *use* JobSpy in future runs, the skill needs minor additions:
- Add a note about when to trigger `jobspy` vs `jsearch` (JobSpy for LinkedIn/Wellfound, JSearch for broad coverage)
- Add Hunter.io lookup as a post-filter enrichment step for shortlisted roles
- Add outreach template as a final delivery step after resume generation

---

## Tradeoffs

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| **JobSpy install location** | `~/dev/tools/jobspy-mcp-server` (personal tools) | Inside `~/.config/opencode/` (bundled with config) | **Option A** — keeps config directory clean; tools can be versioned independently. Document the path in a setup note. |
| **Hunter.io integration** | Standalone Node script you run manually | Registered as an MCP server (if one exists or custom-built) | **Option A** for now — 25 lookups/month is low volume; manual is fine. Revisit if you automate outreach at scale. |
| **Outreach workflow** | Add to SKILL.md so pipeline auto-generates emails after resumes | Keep separate — manually send after reviewing resumes | **Option B** — Auto-generated cold emails feel impersonal. Better to have a template bank you manually adapt. |
| **Startup list maintenance** | Static markdown note in your vault | Firecrawl monitor on Wellfound / YC lists to auto-update | **Option A** for now — simpler, faster to set up. Option B is a nice-to-have later. |

---

## Risks & Unknowns

1. **JobSpy dependency hell:** The MCP server wraps a Python tool. The README references `../jobSpy/run.sh` — if the relative path breaks or Python dependencies conflict with your system Python, it may need Docker or a `venv`.
2. **Hunter.io free tier limits:** 25 lookups/month means you burn 5 on testing. Plan which domains matter most before running queries.
3. **OpenCode MCP timeout:** The JSearch MCP uses `mcp-remote` with a 60s default. JobSpy's LinkedIn scraping can be slow. May need to bump `timeout` in `opencode.json`.
4. **Targeting ambiguity:** Series A/B "cybersecurity" startups is broad. Are you looking for **security engineer roles at tech startups** or **cybersecurity product companies hiring any role**? This affects the outreach template voice and the startup list.
5. **Hermes vs OpenCode drift:** The skill was migrated to Hermes. If you plan to run the full pipeline in OpenCode, we should verify the skill instructions are MCP-agnostic (they reference JSearch tools generically, which is good).

---

## Clarifying Questions (To Resolve Before Implementation)

1. **Startup focus:** Are you targeting (a) *cybersecurity roles at tech startups* (e.g., SOC analyst at a fintech), or (b) *any role at cybersecurity product startups* (e.g., sales engineer at a YC security company)? This changes the outreach template and the startup list dramatically.

2. **JobSpy location preference:** Should I clone JobSpy into `~/Documents/Projects/tools/` or do you have a standard `~/dev/` or `~/repos/` directory you'd prefer?

3. **Hunter.io API key:** Do you already have a Hunter.io account, or should I walk you through sign-up as part of the plan?

---

## Files Referenced

- `~/.config/opencode/skills/job-application-pipeline/SKILL.md` — Current pipeline skill
- `Daily Notes/2026-06-22.md` — Today's to-do list
- `Daily Notes/2026-06-20.md` — Research notes on JobSpy and Hunter.io
- `Personal/Career/job-aplications/MIGRATION_COMPLETE.md` — Hermes migration status
- `~/.config/opencode/opencode.json` — MCP server configuration
