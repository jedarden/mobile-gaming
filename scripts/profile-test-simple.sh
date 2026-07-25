#!/bin/bash
# Simple bash script to run tests 5 times and collect timing

RUNS=5
echo "Running test suite $RUNS times to collect baseline timing data..."
echo ""

for i in $(seq 1 $RUNS); do
  echo ""
  echo "=== Run $i/$RUNS ==="
  START=$(date +%s%N)
  
  npm test -- --reporter=json > "test-run-$i.json" 2>&1
  
  END=$(date +%s%N)
  DURATION=$((($END - $START) / 1000000))
  
  if [ $? -eq 0 ]; then
    echo "Duration: ${DURATION}ms"
    
    # Count test files
    TEST_FILES=$(cat "test-run-$i.json" | jq '.testResults | length' 2>/dev/null || echo "0")
    TOTAL_TESTS=$(cat "test-run-$i.json" | jq '.numTotalTests' 2>/dev/null || echo "0")
    
    echo "Test files: $TEST_FILES"
    echo "Tests: $TOTAL_TESTS"
    
    # Find slow tests (>100ms)
    SLOW_COUNT=$(cat "test-run-$i.json" | jq '[.testResults[].assertionResults[] | select(.duration > 100)] | length' 2>/dev/null || echo "0")
    echo "Slow tests found: $SLOW_COUNT"
  else
    echo "Test run failed!"
    exit 1
  fi
done

echo ""
echo "=== ANALYSIS ==="

# Get timing from each run
AVG_DURATION=0
for i in $(seq 1 $RUNS); do
  if [ -f "test-run-$i.json" ]; then
    TOTAL_TESTS=$(cat "test-run-$i.json" | jq -r '.numTotalTests' 2>/dev/null || echo "0")
    AVG_DURATION=$((AVG_DURATION + $(cat "test-run-$i.json" | jq -r '.duration // 0' 2>/dev/null || echo "0")))
  fi
done

# Find all slow tests across all runs and aggregate
echo "" > slow-tests-aggregated.txt

for i in $(seq 1 $RUNS); do
  if [ -f "test-run-$i.json" ]; then
    cat "test-run-$i.json" | jq -r '.testResults[] | select(.file != null) | 
      .assertionResults[] | 
      select(.duration > 100) | 
      "\(.file)|\(.ancestorTitles | join(" > ")) > \(.title)|\(.duration)"' >> slow-tests-aggregated.txt 2>/dev/null || true
  fi
done

# Aggregate and sort
if [ -s slow-tests-aggregated.txt ]; then
  echo ""
  echo "=== SLOWEST TESTS (avg across runs, >100ms) ==="
  echo ""
  
  # Aggregate by test name and calculate average
  awk -F'|' '{name=$1"|"$2; sum[name]+=$3; count[name]++; min[name]=(min[name]==""||$3<min[name])?$3:min[name]; max[name]=(max[name]==""||$3>max[name])?$3:max[name]} 
     END {for(i in sum) printf "%.0f|%s|%d|%.0f|%.0f|%.0f\n", sum[i]/count[i], i, count[i], min[i], max[i], sum[i]/count[i]}' slow-tests-aggregated.txt |
    sort -t'|' -k1 -rn |
    head -30 |
    awk -F'|' '{printf "\n%d. %s\n   File: %s\n   Avg: %.0fms | Min: %.0fms | Max: %.0fms | Seen in %d/%d runs\n", NR, $2, $1, $3, $4, $5, $6, RUNS}'
fi

# Find tests >5s
echo ""
echo "=== CHECKING FOR TESTS >5s ==="

FOUND_5S=0
for i in $(seq 1 $RUNS); do
  if [ -f "test-run-$i.json" ]; then
    FIVE_SEC=$(cat "test-run-$i.json" | jq '[.testResults[].assertionResults[] | select(.duration > 5000)] | length' 2>/dev/null || echo "0")
    if [ "$FIVE_SEC" -gt 0 ]; then
      FOUND_5S=1
      echo "Found $FIVE_SEC tests >5s in run $i"
      cat "test-run-$i.json" | jq -r '.testResults[] | 
        select(.file != null) | 
        .assertionResults[] | 
        select(.duration > 5000) | 
        "\(.duration)ms: \(.file) - \(.ancestorTitles | join(" > ")) > \(.title)"' 2>/dev/null || true
    fi
  fi
done

if [ "$FOUND_5S" -eq 0 ]; then
  echo "No tests taking >5s found across all runs."
fi

echo ""
echo "Results saved to test-run-*.json files"
