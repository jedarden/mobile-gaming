# CI Stability Test Run Template

**Test Date:** YYYY-MM-DD  
**Test Purpose:** [Brief description of what is being tested]  
**Test Bead:** [Bead ID if applicable]

---

## Executive Summary

**Result:** [✅ PASSED | ❌ FAILED | ⚠️ PARTIAL]

[One paragraph summary of the overall result - what was tested, what happened, and what it means]

---

## Workflow Run Results

| Run | Workflow ID | Status | Build Step | Unit Step | E2E Step | Notes |
|-----|-------------|--------|------------|-----------|----------|-------|
| #1 | `workflow-id-here` | [✅ PASSED | ❌ FAILED] | [✅ | ❌] | [✅ | ❌] | [✅ | ❌] | [Brief notes] |
| #2 | `workflow-id-here` | [✅ PASSED | ❌ FAILED] | [✅ | ❌] | [✅ | ❌] | [✅ | ❌] | [Brief notes] |
| #3 | `workflow-id-here` | [✅ PASSED | ❌ FAILED] | [✅ | ❌] | [✅ | ❌] | [✅ | ❌] | [Brief notes] |

---

## Detailed Results

### Run #1: `workflow-id`

**Status:** [PASSED/FAILED]

**Build Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Any relevant information - bundle size, warnings, etc.]

**Unit Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Test counts, coverage, any failures]

**E2E Step:**
- Status: [✅ PASSED | ❌ FAILED | SKIPPED]
- Duration: [X seconds]
- Details: [Browser used, test counts, any failures]

**Logs/Errors:**
```
[Paste relevant log snippets or error messages here]
```

### Run #2: `workflow-id`

**Status:** [PASSED/FAILED]

**Build Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Any relevant information]

**Unit Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Test counts, coverage, any failures]

**E2E Step:**
- Status: [✅ PASSED | ❌ FAILED | SKIPPED]
- Duration: [X seconds]
- Details: [Browser used, test counts, any failures]

**Logs/Errors:**
```
[Paste relevant log snippets or error messages here]
```

### Run #3: `workflow-id`

**Status:** [PASSED/FAILED]

**Build Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Any relevant information]

**Unit Step:**
- Status: [✅ PASSED | ❌ FAILED]
- Duration: [X seconds]
- Details: [Test counts, coverage, any failures]

**E2E Step:**
- Status: [✅ PASSED | ❌ FAILED | SKIPPED]
- Duration: [X seconds]
- Details: [Browser used, test counts, any failures]

**Logs/Errors:**
```
[Paste relevant log snippets or error messages here]
```

---

## Consistency Analysis

### Test Results Consistency
- **Build Step:** [100% consistent | Mixed | Inconsistent]
- **Unit Step:** [100% consistent | Mixed | Inconsistent]
- **E2E Step:** [100% consistent | Mixed | Inconsistent]
- **Overall:** [100% consistent | Mixed | Inconsistent]

### Failure Patterns (if applicable)
- **Consistent Failures:** [List failures that occurred in all runs]
- **Intermittent Failures:** [List failures that occurred in some but not all runs]
- **Flaky Behavior:** [Describe any random or timing-related issues]

---

## Acceptance Criteria Verification

| Criterion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| All workflows completed successfully | ✅ | [✅/❌] | [PASS/FAIL] |
| No timeouts occurred | ✅ | [✅/❌] | [PASS/FAIL] |
| No selector errors occurred | ✅ | [✅/❌] | [PASS/FAIL] |
| No assertion failures occurred | ✅ | [✅/❌] | [PASS/FAIL] |
| Consistent results across runs | ✅ | [✅/❌] | [PASS/FAIL] |
| No flaky behavior observed | ✅ | [✅/❌] | [PASS/FAIL] |

**Overall:** [✅ PASSED | ❌ FAILED]

---

## Conclusion

[Summarize the findings - is the CI stable? What issues were found? What needs to be fixed?]

### Recommendations
1. [Any specific actions needed]
2. [Any follow-up testing required]
3. [Any process improvements needed]

---

## Workflow Run IDs for Reference

**All workflows available in argo-workflows namespace on iad-ci cluster:**

- Run #1: `workflow-id-here`
- Run #2: `workflow-id-here`
- Run #3: `workflow-id-here`

**Retrieval Command:**
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflow <workflow-id> -n argo-workflows -o yaml
```

---

**Test performed by:** [Bead ID or person]  
**Test Date:** YYYY-MM-DD  
**Report Generated:** YYYY-MM-DD
