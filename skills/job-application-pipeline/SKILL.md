---
name: job-application-pipeline
description: "End-to-end job application pipeline: searches for matching roles via JSearch (Google for Jobs index), filters to the top 3 qualifying positions, then automatically produces a tailored ATS-optimized resume for each one — all from a single set of inputs collected once. Trigger this skill whenever the user wants to find jobs AND prepare applications, says \"find me jobs and tailor my resume\", \"run the full pipeline\", \"find roles that match my profile and get me ready to apply\", \"job search and resume\", or provides a candidate profile asking what to apply for. Also trigger when the user has job results and wants tailored resumes generated from them. Always run the full flow: search → filter → tailor → deliver."
---

# Job Application Pipeline

Searches for qualifying roles via JSearch (aggregates Indeed, LinkedIn, Glassdoor, ZipRecruiter, and others through Google for Jobs), filters to the top 3, presents them as a **numbered list with role summaries and gap analysis**, lets the user **pick which roles they want**, then auto-produces a tailored one-page ATS-optimized resume for each selected one — all from a single set of inputs collected once.

The portfolio is the source of truth throughout. It drives job fit scoring during the search phase and resume evidence during the tailoring phase. The existing resume is a contact info and formatting reference only — never treat its stated content as canonical.

---

## Step 1 — Collect Inputs (Once)

Extract from conversation history first. Ask only for what is genuinely missing, in a single message.

**Required:**
- Job titles to search
- Candidate profile: certifications, tech stack, experience level, key projects
- Years of professional experience (exact figure — used for experience floor enforcement)
- Employment type preference: FTE, W2 contract, or open to both (default: FTE only)
- **Portfolio HTML file** — hard requirement; see below
- **Existing resume (PDF or DOCX)** — for contact info, job titles, companies, and dates only

**Optional:**
- Target salary range — used to flag underpaying roles, not a hard filter
- Hard excludes — sectors, clearance, travel, or anything the candidate has ruled out
- Resume format preference: **keep existing format** (rewrite content only, preserve layout/design) or **generate from scratch** (new layout produced by OpenCode). Ask this explicitly — it's a meaningful choice. Default: keep existing format.

### Portfolio Requirement

The portfolio is required before any work begins. It is the primary source of truth for what the candidate has actually built — it drives fit scoring during the job search and content generation during resume tailoring.

If missing, say:

> *"Before I start, I need your portfolio file (e.g. index.html from your site). It's the evidence base for everything in this pipeline — it drives job fit scoring AND the resume tailoring afterward. Results will be significantly more accurate with it. Please attach it."*

Do not proceed to Step 2 without it.

### Existing Resume Requirement

Also required — needed for contact info, titles, companies, and employment dates.

If missing, say:

> *"I also need your current resume (PDF or DOCX) — I'll use it only for contact info and dates. Everything else gets rewritten based on your portfolio."*

---

## Step 2 — Parse Portfolio (Once, Shared)

Read the portfolio HTML in full. Build a proof-of-work inventory that will be reused across all downstream steps — job search filtering and every resume tailoring pass.

- Every named project: description, tools used, outcome or finding
- Every lab or investigation: category, tools, result
- All certifications with status (held vs. in progress)
- All skills, platforms, and languages mentioned anywhere on the page

**Evidence standard:** "Candidate knows KQL" is not sufficient evidence — a specific named project demonstrating KQL is. This distinction is what makes fit scoring and resume tailoring meaningful rather than generic.

Do not re-parse the portfolio between steps. This inventory is the shared source of truth for the rest of the pipeline.

---

## Step 3 — Job Search

### API

All searches use the JSearch MCP tools (`jsearch` server). No curl or API keys needed — the MCP server handles authentication.

**Base parameters (applied to every search):**
- `work_from_home=true`
- `country=us`
- `num_pages=2` (20 results per call)

**Employment type mapping:**
- FTE only → `employment_types=FULLTIME`
- W2 contract only → `employment_types=CONTRACTOR`
- Open to both → `employment_types=FULLTIME,CONTRACTOR`

**Search calls:** Use the `jsearch_Job_Search_V2` MCP tool with a `query` string containing the job title and "United States", plus the date/filter parameters for the current round.

**Detail fetching:** After collecting job IDs from search results, call the `jsearch_Job_Details` MCP tool with up to 20 IDs at once. The response adds `required_technologies`, `preferred_technologies`, `seniority_level`, `required_experience_years`, and `education_required` as structured fields — use these directly in the filter pipeline rather than parsing the description text.

### Search Strategy

Run in gated rounds, widening the date window only when needed. **At every round, search all primary job titles AND all alternate title variants simultaneously** — variants are not a separate round, they run at every round alongside the primary titles.

Each round fires all title queries in parallel. After Round 1, emit the Search Digest and **pause for user input** — do not proceed to Round 2 unless the user explicitly requests it. This keeps turn count low and prioritizes fresh postings.

**Before Round 1:** Generate alternate title variants for each primary title. For example:
- "SOC Analyst" → also search "Security Operations Analyst", "Cybersecurity Analyst", "Information Security Analyst"
- "Cloud Security Engineer" → also search "Cloud Security Analyst", "Cloud Infrastructure Security", "DevSecOps Engineer"
Include these variants in every round.

**Round 1 — 3-day window (ALWAYS RUN)**
- `date_posted=3days`
- Search: all primary titles + all variants in parallel
- Run the filter pipeline on results
- Emit Search Digest (Step 5)
- **PAUSE. Present the user's options (see Step 5).**

**Round 2 — 7-day window (USER-TRIGGERED ONLY)**
- Only run if user explicitly says "expand to 7 days", "run week window", "not satisfied", or similar
- `date_posted=week`
- Search: all primary titles + all variants in parallel
- Filter new results only (skip anything already evaluated in Round 1)
- Re-evaluate shortlist count
- Re-emit Search Digest with updated totals
- **PAUSE again. Re-present the user's options.**

**Round 3 — No date filter (USER-TRIGGERED ONLY)**
- Only run if user explicitly says "expand to all", "no date filter", "widest net", or similar
- `date_posted=all`
- Search: all primary titles + all variants in parallel
- Filter new results only
- Re-emit Search Digest with final totals
- **Proceed to Step 5b only if user confirms.**

If Round 1 returns zero qualifying roles, immediately offer Round 2 as the default next step (one prompt, do not auto-run).

If the user says "proceed", "tailor resumes", or "I'm satisfied" at any round gate, skip to Step 5b immediately — do not run additional rounds even if the shortlist has fewer than 3 roles.

> **Rationale:** Fresher postings (3-day window) have the highest response rates and are least likely to be stale or already filled. Auto-running all rounds burns 6–10 turns before the user sees results. Gated rounds respect the user's judgment and cut search-phase turns by 50–70% in the common case.

---

## Step 4 — Filter Pipeline

Every result passes through this pipeline in full. A role that fails any hard exclude is dropped immediately.

### Hard Excludes

Drop without exception:
- Security clearance explicitly required (Secret, TS, TS/SCI, or equivalent)
- Role is not fully remote (on-site or hybrid both fail) — check `job_is_remote`, `work_arrangement`, and the description
- Content annotation or AI trainer roles masquerading as security positions
- Defense/federal prime contractors with high implicit clearance likelihood (CACI, AEVEX, Accenture Federal Services, and similar)
- Employment type mismatch: if candidate preference is FTE, drop W2 contract, corp-to-corp, and staffing agency posts. Use `job_employment_types` field first; fall back to description parsing.

### Seniority Mismatch

If the candidate has fewer than 3 years of professional experience, drop any role where:
- The title contains: Architect, Senior, Lead, Principal, Staff, Manager, Director, Head of, VP
- `seniority_level` field is `"senior"` or higher
- `required_experience_years` exceeds the candidate's experience by more than 2×

### Experience Floor

- Pass: role requires 0–2 years, or states entry-level
- Pass with note: role requires up to 2 years more than candidate has
- Fail: role requires more than 2× the candidate's stated experience

Use `required_experience_years` from `/job-details` where available; fall back to description parsing.

Degree substitution realism: only pass a degree-plus-substitution clause if the substitution threshold is realistically within reach.

### Hard Technical Requirement Mismatch

Use `required_technologies` from `/job-details` as the authoritative list, supplemented by description parsing.

- Two or more explicitly required tools absent from the portfolio inventory with no reasonable functional analog → drop
- One hard-required item absent → pass but flag it in the fit rationale

Do not claim functional equivalence without noting it explicitly.

### Quality Threshold

A role must meet all of the following to be added to the shortlist:
- Passes all hard excludes above
- Has at least 2 specific tool or skill overlaps evidenced by named projects or labs in the portfolio inventory — a tool appearing only in the stated stack without a corresponding project does not count as evidence
- Has no more than 1 hard technical gap
- Not stale beyond 60 days — use `job_posted_at_datetime_utc`

### Degree Filter

- Pass: degree listed as preferred, equivalent experience accepted, or not mentioned
- Pass with note: degree listed alongside a realistic experience substitution
- Fail: degree required with no substitution, or substitution threshold is unreachable

Use `education_required` from `/job-details` where available.

### Clearance Risk Annotation

If a role does not explicitly require clearance but comes from a defense-adjacent employer, annotate with a clearance risk flag rather than dropping it. Include in the shortlist only if it otherwise clears all filters and the quality threshold.

### Deduplication

Cross-platform duplicates (same `employer_name` + `job_title` from multiple publishers): keep one, prefer the listing with salary data. Same-contract multi-agency spam: collapse to a single entry. Note collapsing in the iteration log.

---

## Step 5 — Search Digest

Emit this digest before moving to resume tailoring. It is self-contained — readable without any prior conversation context.

**Header block** (always present, even for zero results):
- Date and time of run
- Job titles searched
- Rounds completed before stopping
- Total raw results evaluated
- Total dropped by filter (with primary drop reason breakdown)
- Total qualifying results

**For each qualifying role (up to 3), produce a numbered entry:**

Format each entry exactly like this:

```
[1] [Job Title] @ [Company]
    Role summary: [2–3 sentences summarizing the actual day-to-day work described in the JD — what they'd monitor, investigate, build, or respond to]
    Salary: [salary range or "not listed"], Posted: [days since posted]
    Fit: [2–3 sentences grounded in specific portfolio evidence. Name exact project/lab for each matched skill. Flag gaps honestly by name.]
    Gaps: [concise list of 1–3 skills with no portfolio evidence, or "none significant"]
    Clearance risk: [yes / no / flagged]
```

Repeat for roles `[2]` and `[3]` if they exist.

---

**User selection prompt** (must appear at the end of every Search Digest):

After presenting all numbered roles, emit exactly this prompt:

```
---
Search complete. Found [N] qualifying role(s) from [date window searched].

Which roles would you like tailored resumes for?
Enter numbers: e.g. "1", "1,3", or "all"
```

Wait for the user to reply. Do not proceed to Step 5b or Step 6 until the user has explicitly selected at least one number.

**If the user selects specific numbers:** Proceed to Step 5b and Step 6 for ONLY those selections.
**If the user says "all" or "everyone":** Proceed for all listed roles.
**If the user says "none", "0", or declines all:** Acknowledge respectfully and STOP. Do not proceed.
**If zero roles qualified:** Immediately offer Round 2 as the default next step with this prompt:
```
No roles qualified from the past 3 days.
[1] Expand search to past 7 days
[2] Expand search to all dates
```

---

## Step 5b — Gap Analysis (Selected Roles Only)

Before tailoring any resumes, emit a concise gap summary **only for the roles the user selected** in Step 5.

For each selected role, produce one block:

```
Role [N]: [Job Title] @ [Company]
Strong matches: [list skills/tools evidenced by named portfolio projects]
Partial matches: [list tools in stated stack but without a dedicated project]
Gaps: [list required skills with no portfolio evidence]
Degree requirement: [pass / pass with note / fail]
Clearance risk: [yes / no / flagged]
```

Keep this tight — one block per selected role, no prose padding. Then proceed automatically to Step 6 for those same selections.

---

## Step 6 — Resume Tailoring (Per Selected Role)

For each role the user **selected by number** in Step 5, produce a tailored one-page ATS-optimized resume. Process selections in sequence, not in parallel.

If the user selected fewer than 3 roles, do not pad with unselected roles. If the user selected zero roles (or said "none"), do not proceed to this step.

Use the proof-of-work inventory from Step 2 — do not re-parse the portfolio.

### 6a — Extract ATS Keywords from the JD

- **Required skills** — stated as must-have
- **Preferred skills** — nice-to-have
- **Exact tool/platform names** — must appear verbatim for ATS parsing
- **Action verbs** — words the JD uses to describe the work
- **Concepts and frameworks** — MITRE ATT&CK, SIEM, SOAR, etc.

Rank by frequency and explicitness: required skills that appear multiple times are highest priority.

### 6b — Map Keywords to Portfolio Evidence

For each extracted keyword:
- **Strong match** — a named project or lab directly demonstrates the skill → use it
- **Partial match** — tool appears in stated stack but no dedicated project → usable, flag it
- **Gap** — no portfolio evidence → note it honestly, do not fabricate it

### 6c — Draft Resume Content

**If keeping existing format:** Use the candidate's resume as the structural template. Preserve all formatting, layout, and section order. Rewrite only the text content — summary, bullet points, and project descriptions — to match the JD keywords. Do not add, remove, or reorder sections.

**If generating from scratch:** Use the structure defined below. Use the candidate's name, contact info, job titles, companies, and dates from the existing resume. Build everything else fresh.

In both cases, rewrite everything else.

**Summary** (60 words max): Lead with the 2–3 strongest JD keyword matches grounded in portfolio evidence. Name certifications. Do not exceed 60 words.

**Experience**: Keep exact titles, companies, dates. Rewrite bullets to emphasize JD-relevant actions using the JD's own verb choices where natural.
- Primary role: 5 bullets max
- Secondary roles: 4 bullets max

**Projects** (3 max): Order by JD relevance — strongest match leads. One-sentence description of what was built and what was found, then `Tools: X, Y, Z` inline on the same paragraph.

**Certifications**: Single line. Current certs first. In-progress labeled `(In Progress)`.

**Education**: Single line.

**Additional Skills & Technologies**: Two lines max. List only tools and concepts not already named above. If all relevant items are already covered, keep this section minimal or omit it.

### 6d — One-Page Enforcement

If content overflows, trim in this order:
1. Shorten summary (target 50 words)
2. Drop secondary role to 3 bullets
3. Shorten project descriptions to one sentence each
4. Reduce skills section to one line or remove it
5. Drop the weakest project if still overflowing

Do not drop experience entries. Do not drop certifications.

---

## Step 7 — Output Delivery

Generate all resumes as `.docx` files. Do not ask the user for a format preference — always produce `.docx`.

### How to generate and deliver the files

1. **Write a Node.js build script** (`make_resumes.js`) in the current working directory. Use the `docx` npm package. Install if needed:
   ```bash
   npm init -y && npm install docx
   ```
   Then execute:
   ```bash
   node make_resumes.js
   ```

2. **Write files to the current working directory** — the folder OpenCode is running from. Do not attempt to copy or move files after generation; write them directly to their final destination from the script.

3. **After the script runs successfully**, tell the user the filenames and that they are in the working directory. Example:
   ```
   Files written to the working directory:
   - resume_acme_soc-analyst.docx
   - resume_contoso_cloud-security-engineer.docx
   - resume_initech_devsecops.docx
   ```

4. **Label each file** with company name and role title: `resume_<company>_<role>.docx`

---

## Pipeline Rules

- Do not insert keywords the candidate cannot evidence from their portfolio
- Mirror the JD's verb choices in bullets where they fit naturally
- Always reorder projects by JD relevance — portfolio order is irrelevant
- If a required JD skill has no portfolio match, flag it as a gap rather than burying it
- If a qualifying role implies clearance, federal contracting, or a sector the candidate has excluded, flag it before tailoring its resume
- The proof-of-work inventory from Step 2 is the shared source of truth — do not re-parse the portfolio per role
- Zero qualifying roles is a valid output — do not pad results or lower the quality bar in order to produce resumes
