# Codex review protocol

Any change to repository files must produce a new review bundle before `git add`, `git commit`, `git push`, tag creation, or release creation.

Pure read-only audits with no repository file changes may skip the full bundle flow.

Every bundle must use a unique timestamp with millisecond precision from `Get-Date -Format "yyyyMMdd-HHmmss-fff"`.

Historical bundles must never be overwritten, deleted, or reused.

Only fully successful bundles may enter `$env:TEMP\nest-kit-review\`.

Failed or in-progress runs may leave diagnostic directories only under `$env:TEMP\nest-kit-review-staging\`.

Only complete successful bundles may be moved from staging into the final review directory. Failed or debugging runs must remain in staging only.

Bundles must never be written into the repository.

The script must resolve the Git repository root automatically with `git rev-parse --show-toplevel`, switch into that directory for Git, npm, snapshot, and path operations, and restore the original invocation directory when finished.

Optional path variables that may be referenced in `catch` or `finally` must be initialized before the main `try` block so strict mode does not hide the original failure with an uninitialized-variable error.

Supported bundle modes:

- `WorkingTree`: review files before staging or commit.
- `CommitCheckpoint`: capture the exact committed state after a local commit.
- `PushCheckpoint`: capture the branch and remote state after a push.

The final upload artifact is the generated zip file. Users upload the final zip, not loose files one by one.

The generated zip must sit beside the final bundle directory under `$env:TEMP\nest-kit-review\`, not inside the bundle directory.

Minimum bundle outputs by mode:

- `WorkingTree`
  - `review-summary.txt`
  - `tracked-changes.patch`
  - `source-snapshot.md`
  - `docs-changes.patch`
  - `build-artifacts-check.txt`
  - `validation.txt`
  - `bundle-manifest.txt`
- `CommitCheckpoint`
  - `commit-summary.txt`
  - `committed-changes.patch`
  - `post-commit-status.txt`
  - `bundle-manifest.txt`
- `PushCheckpoint`
  - `push-summary.txt`
  - `bundle-manifest.txt`

`bundle-manifest.txt` must not record its own size or hash.

`bundle-manifest.txt` may record top-level diagnostics such as `InvocationDirectory`, `RepositoryRoot`, `StagingDirectory`, and `FinalDirectory`.

Each file entry in `bundle-manifest.txt` must use:

- `FILE=`
- `RELATIVE_PATH=`
- `FINAL_PATH=`
- `SIZE=`
- `SHA256=`

Per-file manifest entries must not use stale staging absolute paths.

`source-snapshot.md` must be rename-safe:

- Keep `git diff --name-status HEAD` for human review output.
- Build snapshot targets from `git diff --name-only HEAD --` plus untracked files.
- Allow deleted paths to appear as `MISSING FILE`.
- Use fenced code blocks with at least four backticks.
- Prefer raw text reads so embedded Markdown fences do not break the snapshot structure.

If final publication fails after partial creation of current-run outputs, rollback may clean only the incomplete final bundle directory and zip created by that same run.

Historical final bundles and historical final zips must never be deleted, overwritten, or reused.

`PushCheckpoint` must compare:

- `Local HEAD`
- `Tracked upstream HEAD`
- `Actual remote HEAD`

`PushCheckpoint` must verify the actual remote target with `git ls-remote --heads <remote-name> <remote-branch>`.

Network failure, missing upstream, or missing remote branch must never be treated as silent verification success.

`CommitCheckpoint` diff check must be executed only once and then reused for reporting.

Native command stderr must be preserved as diagnostic text in bundle outputs.

Native process stdout and stderr must be captured separately.

`StdOut` is for machine parsing only.

`StdErr` is for preserved diagnostics only.

`Output` is the combined human-review text.

Non-empty stderr does not by itself mean command failure.

Native process failure must be determined by exit code.

LF / CRLF normalization warnings must not block bundle export when exit code is `0`.

Any local `ErrorActionPreference` override used for native command capture must be restored in `finally`.

Git warnings must not pollute file lists or patch body text.

Diff-check analysis should continue to use combined diagnostic text so normalization warnings remain visible for review.

Required workflow order:

1. Produce and review a `WorkingTree` bundle before any staging.
2. Complete human review before manual testing.
3. Complete manual testing before `git commit`.
4. Complete and review a `CommitCheckpoint` bundle before `git push`.
5. Complete and review a `PushCheckpoint` bundle before entering the next development phase.
