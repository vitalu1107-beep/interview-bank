# Growth Notebook UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the existing interview practice experience as 豆苗的成长手帖 while preserving every question and saved-state contract.
**Architecture:** Native static HTML/CSS, current app.js event system, a small pure notebook.mjs module for brand and learning statistics. Existing JSON, core module and storage format remain unchanged.
**Tech Stack:** HTML, CSS, ES modules, Node test runner, GitHub Pages/Actions.
**Spec:** docs/superpowers/specs/2026-10-26-notebook-ui-design.md

## Global Constraints
- questions.json byte-for-byte unchanged from main;122 questions A17/B16/C10/D79.
- Existing localStorage keys, backup formats, category IDs and DOM event IDs retained.
- No framework, CDN font, fake counts, empty future sections or main deployment.
- Review via PR only; existing workflow gains only the asset allowlist entry.

## Review Focus
- Historical/orphan progress must not inflate summary counts.
- Mobile menu must not discard unsaved edits or strand focus in hidden navigation.
- Fresh load/resize/hash navigation must retain reachable content on all four viewport widths.
- Draft conflicts and unavailable storage remain explicit; default published answer preserved.
- Long Chinese, Part/版本 headings, exports and modal keyboard navigation remain usable.

### Task 1: Baseline and contracts
- [x] Clone latest main in an independent directory and create a feature branch.
- [x] Run baseline npm run check and save original JSON SHA-256.
- [x] Capture original desktop and mobile screenshots from an untouched local snapshot.

### Task 2: Shared branding, summary and navigation behavior
**Files:** assets/notebook.mjs, assets/app.js, tests/notebook.test.mjs, package.json, .github/workflows/deploy.yml
**Interfaces:** SITE_CONFIG; getLearningSummary(items,progress); getNextPracticeId(items,progress). DOM overviewTotal/overviewPracticed/overviewFavorites/overviewProgress/continuePractice/continueHint; navToggle/navBody/mobileCurrentGroup; syncSummary.
- [x] Write failing tests for real counts, ignored obsolete IDs, empty bank, practice ordering and all-practiced state; verify failure before helper implementation.
- [x] Add centralized brand config, pure helpers and minimal app integration; preserve state contracts, apply mobile menu and focus behavior.
- [x] Include new tests in npm test and the module in existing site artifact allowlist; run full suite.

### Task 3: Complete visual system
**Files:** index.html, assets/style.css
**Interfaces:** Preserve prior DOM IDs and delegate data attributes; use contract from Task2.
- [x] Build semantic brand/welcome/overview/sidebar/read controls and backup/sync details.
- [x] Replace accumulated legacy CSS with one token-driven stationery design, responsive layouts, 44px touch targets, visible focus and reduced-motion support.
- [x] Validate real content at desktop/tablet/390/375; fix visual issues shown by screenshots.

### Task 4: Regression and review delivery
**Files:** README.md, docs/ui-redesign/README.md, docs/ui-redesign/images/*
- [x] Browser-test nav/search, expand/collapse/self-test, favorites/practice, draft save/switch/conflict, JSON import/export, Markdown and refresh, mobile/keyboard menu.
- [x] Run npm run check, JS syntax and git diff checks; compare JSON/core/workflow paths/storage keys against main.
- [x] Obtain independent code review and address material regressions.
- [ ] Push independent branch, create PR with before/after screenshots and test evidence, attach PR to chat; wait for PR CI and leave main unchanged.
