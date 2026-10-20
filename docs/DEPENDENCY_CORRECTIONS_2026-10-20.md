# Dependency corrections - 2026-10-20

The previous CI run blocked newly reported frontend vulnerabilities. No new risk acceptance was added and the existing braces exception was not extended (review by 2026-10-22).

- Angular framework/compiler: 20.3.34, correcting platform-server and router advisories GHSA-w739-gvwx-grc3 and GHSA-62vg-58rm-qff7.
- Vite: scoped @angular/build override to 7.3.7 (GHSA-698v-4r3x-3vcv).
- MCP SDK: scoped @angular/cli override to 1.32.1 (GHSA-22jm-h49p-29qw and GHSA-6prh-2h8m-c8cw). Angular CLI currently pins the affected 1.31.0.
- follow-redirects: lockfile resolves 1.16.1 (GHSA-q3jh-wrc6-jgq8 and GHSA-8r9p-f939-6h3c).

The two overrides remain within the installed major versions; remove them once Angular tooling natively selects corrected versions. No force or legacy-peer-deps installation is used.

Dependency gate: all six module/scope combinations pass; zero production alerts. Five development alerts belong exclusively to the accepted braces chain. The gate continues to enforce the original exception deadline. See the CI dependency report for the exact candidate-bound evidence; local reports from a dirty worktree are not release qualification.

Upstream advisories: https://github.com/advisories/GHSA-62vg-58rm-qff7 ; https://github.com/advisories/GHSA-w739-gvwx-grc3 ; https://github.com/advisories/GHSA-698v-4r3x-3vcv ; https://github.com/advisories/GHSA-22jm-h49p-29qw ; https://github.com/advisories/GHSA-6prh-2h8m-c8cw ; https://github.com/advisories/GHSA-q3jh-wrc6-jgq8 ; https://github.com/advisories/GHSA-8r9p-f939-6h3c
