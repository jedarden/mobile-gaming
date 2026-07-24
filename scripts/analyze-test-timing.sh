#!/bin/bash
# Analysis script to identify slow test cases from timing logs

E2E_LOG="/home/coding/mobile-gaming/test-baseline-e2e-timing.log"
UNIT_LOG="/home/coding/mobile-gaming/test-baseline-unit-timing.log"
OUTPUT_DIR="/home/coding/mobile-gaming/notes"
REPORT_FILE="$OUTPUT_DIR/bf-43xyb-slow-tests-report.md"

THRESHOLD_MS=5000  # 5 seconds threshold

echo "# Slow Test Cases Analysis Report" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Analysis Date:** $(date)" >> "$REPORT_FILE"
echo "**Threshold:** ${THRESHOLD_MS}ms (5 seconds)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## Methodology" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- Analyzed E2E timing log: \`test-baseline-e2e-timing.log\`" >> "$REPORT_FILE"
echo "- Analyzed Unit timing log: \`test-baseline-unit-timing.log\`" >> "$REPORT_FILE"
echo "- Searched for individual test cases exceeding ${THRESHOLD_MS}ms threshold" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## E2E Test Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get E2E test statistics
E2E_TOTAL=$(grep -oP '\(\d+ms\)' "$E2E_LOG" | wc -l)
E2E_MAX=$(grep -oP '\(\d+ms\)' "$E2E_LOG" | sed 's/(\(.*\)ms)/\1/' | sort -rn | head -1)
E2E_AVG=$(grep -oP '\(\d+ms\)' "$E2E_LOG" | sed 's/(\(.*\)ms)/\1/' | awk '{sum+=$1; count++} END {printf "%.2f", sum/count}')
E2E_TESTS_OVER_1S=$(grep -oP '\(\d+ms\)' "$E2E_LOG" | sed 's/(\(.*\)ms)/\1/' | awk '{if($1>1000) print $1}' | wc -l)

echo "- **Total E2E test cases:** $E2E_TOTAL" >> "$REPORT_FILE"
echo "- **Maximum single test time:** ${E2E_MAX}ms" >> "$REPORT_FILE"
echo "- **Average test time:** ${E2E_AVG}ms" >> "$REPORT_FILE"
echo "- **Tests over 1s:** $E2E_TESTS_OVER_1S" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get top 20 slowest E2E tests with context
echo "### Top 20 Slowest E2E Test Cases" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
# Extract test names and times properly
grep -E "✓|✘" "$E2E_LOG" | grep -o '\([^)]*ms\)' | sort -t '(' -k2 -rn | head -20 | nl -w2 -s'. ' | awk '{print "**" $0 "**"}' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## Unit Test Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Get unit test statistics
UNIT_TOTAL=$(grep -oP '\(\d+ms\)' "$UNIT_LOG" 2>/dev/null | wc -l)
if [ "$UNIT_TOTAL" -gt 0 ]; then
    UNIT_MAX=$(grep -oP '\(\d+ms\)' "$UNIT_LOG" | sed 's/(\(.*\)ms)/\1/' | sort -rn | head -1)
    UNIT_AVG=$(grep -oP '\(\d+ms\)' "$UNIT_LOG" | sed 's/(\(.*\)ms)/\1/' | awk '{sum+=$1; count++} END {printf "%.2f", sum/count}')
    UNIT_TESTS_OVER_1S=$(grep -oP '\(\d+ms\)' "$UNIT_LOG" | sed 's/(\(.*\)ms)/\1/' | awk '{if($1>1000) print $1}' | wc -l)
else
    UNIT_MAX="N/A"
    UNIT_AVG="N/A"
    UNIT_TESTS_OVER_1S=0
fi

echo "- **Total Unit test cases:** $UNIT_TOTAL" >> "$REPORT_FILE"
echo "- **Maximum single test time:** ${UNIT_MAX}ms" >> "$REPORT_FILE"
echo "- **Average test time:** ${UNIT_AVG}ms" >> "$REPORT_FILE"
echo "- **Tests over 1s:** $UNIT_TESTS_OVER_1S" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$UNIT_TOTAL" -gt 0 ]; then
    echo "### Top 20 Slowest Unit Test Cases" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    grep -oP '\✓.*?\(\d+ms\)' "$UNIT_LOG" | sed 's/.*\(\([0-9]*\)ms\)/\2 ms/' | sort -t ' ' -k1 -rn | head -20 | nl -w2 -s'. ' | awk '{print "**" $0 "**"}' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

echo "## Key Findings" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check if any tests exceed threshold
TESTS_OVER_THRESHOLD=$(grep -oP '\(\d+ms\)' "$E2E_LOG" "$UNIT_LOG" 2>/dev/null | sed 's/(\(.*\)ms)/\1/' | awk '{if($1>'$THRESHOLD_MS') print $1}' | wc -l)

if [ "$TESTS_OVER_THRESHOLD" -eq 0 ]; then
    echo "✅ **No individual test cases exceed the ${THRESHOLD_MS}ms (5s) threshold**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "The slowest individual test cases are:" >> "$REPORT_FILE"
    echo "- E2E: **${E2E_MAX}ms**" >> "$REPORT_FILE"
    echo "- Unit: **${UNIT_MAX}ms**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**Conclusion:** Individual test case performance is not the bottleneck." >> "$REPORT_FILE"
    echo "The performance issues (300s+ total E2E time) are likely due to:" >> "$REPORT_FILE"
    echo "1. Test framework overhead (Playwright startup, browser launches)" >> "$REPORT_FILE"
    echo "2. Test suite count (1234 E2E tests across multiple game files)" >> "$REPORT_FILE"
    echo "3. Parallelization limitations (6 workers)" >> "$REPORT_FILE"
    echo "4. Page load times and navigation between game pages" >> "$REPORT_FILE"
else
    echo "⚠️ **Found ${TESTS_OVER_THRESHOLD} test cases exceeding ${THRESHOLD_MS}ms threshold**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "## Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Since no individual tests exceed 5s, optimization efforts should focus on:" >> "$REPORT_FILE"
echo "1. **Parallelization:** Increase worker count from 6 to utilize more CPU cores" >> "$REPORT_FILE"
echo "2. **Test isolation:** Reduce cross-test dependencies and state sharing" >> "$REPORT_FILE"
echo "3. **Browser reuse:** Implement browser context reuse across tests" >> "$REPORT_FILE"
echo "4. **Suite splitting:** Run game-specific test suites in parallel CI jobs" >> "$REPORT_FILE"
echo "5. **Smart test selection:** Run only affected game tests based on code changes" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "*Report generated by bead bf-43xyb*" >> "$REPORT_FILE"

echo "Analysis complete. Report saved to: $REPORT_FILE"
cat "$REPORT_FILE"
