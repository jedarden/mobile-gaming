# mobile-gaming-ci Workflow Run - parking-escape daily-challenge

**Date:** 2026-07-23  
**Workflow:** mobile-gaming-ci-manual-nhj9r  
**Cluster:** iad-ci (argo-workflows namespace)

## Results

### Workflow Status: **FAILED**

### Step Results:
- ✅ **lint**: Succeeded
- ❌ **build**: Failed (exit code 1)
- ❌ **unit**: Failed (pod timeout - exceeded deadline)
- ⏭️ **e2e**: Skipped (dependent steps failed)

### Root Cause

The build step failed due to the bundle size check (`npm run test:bundle-size`). All 2D games exceed their 200KB gzipped budget because the Phaser framework bundle is 330KB gzipped (1.5MB uncompressed).

### Failing Games (gzipped sizes):

| Game | Size (gzipped) | Budget | Over |
|------|----------------|--------|------|
| pull-the-pin | 346.9KB | 200KB | +146.9KB |
| water-sort | 338.1KB | 200KB | +138.1KB |
| brain-teaser | 339.4KB | 200KB | +139.4KB |
| **parking-escape** | 339.5KB | 200KB | +139.5KB |
| bus-jam | 340.6KB | 200KB | +140.6KB |
| merge-games | 336.5KB | 200KB | +136.5KB |
| satisfying-asmr | 335.8KB | 200KB | +135.8KB |
| save-the-character | 336.2KB | 200KB | +136.2KB |

### Notes

- The unit test pod timed out because it was waiting for the build to complete
- 3D games passed their bundle size checks (all under 400KB gzipped for Three.js)
- The Phaser bundle is being loaded as a shared chunk for all 2D games
- This is a pre-existing issue in the codebase, not specific to parking-escape daily-challenge

### CI Workflow Template

Located in: `jedarden/declarative-config → k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`
