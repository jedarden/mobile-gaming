# CI Stability Test - Run 1 - parking-escape

**Date:** 2026-07-24
**Workflow ID:** mobile-gaming-ci-manual-wdw2d
**Duration:** 335 seconds (5 minutes 35 seconds)

## Summary

**Phase:** Failed  
**Message:** child 'mobile-gaming-ci-manual-wdw2d-2817751565' failed

## Step Results

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| lint | ✅ Succeeded | ~32s | No console.log found, scaffold files validated |
| build | ❌ Failed | ~46s | Exit code 1 |
| unit | ❌ Failed | ~3m 43s | Exit code 1 |
| e2e | ⏭️ Skipped | - | Did not run due to earlier failures |

## Failure Details

### build step
- **Phase:** Failed
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:20:00Z
- **Pod Name:** mobile-gaming-ci-manual-wdw2d-build-[hash] (deleted by podGC)

### unit step
- **Phase:** Failed  
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:23:57Z
- **Pod Name:** mobile-gaming-ci-manual-wdw2d-unit-2817751565 (deleted by podGC)

## Timeline

- 12:18:32Z - Workflow started
- 12:19:04Z - lint step completed
- 12:19:14Z - unit + build steps started (parallel)
- 12:20:00Z - build step failed
- 12:23:57Z - unit step failed
- 12:24:07Z - workflow marked as Failed

## Next Steps

Cannot determine root cause without pod logs (deleted by podGC). For subsequent stability runs:
1. Submit workflow with `podGC: OnWorkflowCompletion` to preserve logs
2. Check Argo UI at https://argo-ci.ardenone.com for detailed logs
3. Run local tests to reproduce failures: `npm ci && npm test && npm run build`

## Full Workflow Data

Saved to: `/tmp/mobile-gaming-ci-run-1.json`
