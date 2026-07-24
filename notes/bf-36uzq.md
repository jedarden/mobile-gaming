# Unit Test Step Pod Name Extraction

## Task
Extract the unit test step pod name from a mobile-gaming-ci workflow execution.

## Workflow Examined
- **Workflow Name:** `mobile-gaming-ci-unit-test-capture-tbd7r`
- **Workflow Template:** `mobile-gaming-ci`
- **Execution Time:** 2026-07-24T19:27:44Z to 2026-07-24T19:30:38Z
- **Status:** Failed

## Unit Test Step Details

### Node Information
- **Node ID:** `mobile-gaming-ci-unit-test-capture-tbd7r-753610366`
- **Display Name:** `unit`
- **Step Name:** `mobile-gaming-ci-unit-test-capture-tbd7r[1].unit`
- **Type:** Pod
- **Template Name:** `unit`
- **Phase:** Failed
- **Exit Code:** 1
- **Error Message:** "main: Error (exit code 1)"

### Pod Name
The **pod name** for the unit test step is: **`mobile-gaming-ci-unit-test-capture-tbd7r-753610366`**

In Argo Workflows, the pod name is the same as the node ID. This pod executed the unit test template and failed with exit code 1.

### Resource Usage
- **CPU Duration:** 68 seconds
- **Memory Duration:** 705 seconds
- **Started At:** 2026-07-24T19:28:28Z
- **Finished At:** 2026-07-24T19:30:28Z
- **Duration:** ~2 minutes

### Command Executed
The unit test pod ran:
```bash
npm ci
npm test
npm run test:levels
echo "Unit tests passed!"
```

## Key Learning
In Argo Workflows, to extract the pod name for any step:
1. Get the workflow JSON: `kubectl get workflow <name> -n argo-workflows -o json`
2. Find the node in `status.nodes` where `templateName` matches your step name
3. The `id` field is the pod name (e.g., `mobile-gaming-ci-unit-test-capture-tbd7r-753610366`)

## Related Identifiers
- **Workflow UID:** `8863260f-d24c-4a05-bd3e-2ebfc4963aaf`
- **Host Node Name:** `prod-instance-17817844549640125`
- **Namespace:** `argo-workflows`
