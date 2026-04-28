#!/bin/bash
# Test script: Dashboard stats - "Open Today" fix verification
# Tests create + status transitions + dashboard counts (Today & All Time)

BASE_URL="${BUGBASE_URL:-http://localhost:3000}"
TOKEN=""
PROJECT_ID=""
CREATED_ISSUE_IDS=()
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[INFO]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# --- Auth ---
login() {
  local email="${1:-admin@bugbase.com}"
  local password="${2:-admin123}"

  log "Logging in as $email..."
  local resp
  resp=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")

  TOKEN=$(echo "$resp" | jq -r '.token // empty')
  if [ -z "$TOKEN" ]; then
    fail "Login failed: $resp"
    exit 1
  fi
  pass "Login successful"
}

# --- API helpers ---
api_get() {
  curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL$1"
}

api_post() {
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2" "$BASE_URL$1"
}

api_put() {
  curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2" "$BASE_URL$1"
}

# --- Get first available project ---
get_project() {
  log "Fetching projects..."
  local resp
  resp=$(api_get "/api/projects")
  PROJECT_ID=$(echo "$resp" | jq -r '.projects[0].id // empty')
  if [ -z "$PROJECT_ID" ]; then
    fail "No projects found"
    exit 1
  fi
  pass "Using project ID: $PROJECT_ID"
}

# --- Get dashboard stats ---
get_dashboard() {
  api_get "/api/dashboard"
}

# --- Create issue ---
create_issue() {
  local title="$1"
  local resp
  resp=$(api_post "/api/issues" "{
    \"projectId\": $PROJECT_ID,
    \"title\": \"$title\",
    \"type\": \"Bug\",
    \"priority\": \"Medium\"
  }")
  local id
  id=$(echo "$resp" | jq -r '.issue.id // empty')
  if [ -z "$id" ]; then
    fail "Create issue failed: $resp"
    return 1
  fi
  CREATED_ISSUE_IDS+=("$id")
  echo "$id"
}

# --- Update issue status ---
update_status() {
  local issue_id="$1"
  local new_status="$2"
  local resp
  resp=$(api_put "/api/issues/$issue_id" "{\"status\": \"$new_status\"}")
  local updated_status
  updated_status=$(echo "$resp" | jq -r '.issue.status // empty')
  if [ "$updated_status" != "$new_status" ]; then
    fail "Status update failed for issue #$issue_id -> '$new_status': $resp"
    return 1
  fi
  return 0
}

# --- Assert stat value ---
assert_stat() {
  local stats="$1"
  local key="$2"
  local expected="$3"
  local label="$4"
  local actual
  actual=$(echo "$stats" | jq -r ".stats.$key")
  if [ "$actual" -ge "$expected" ] 2>/dev/null; then
    pass "$label: $key = $actual (expected >= $expected)"
  else
    fail "$label: $key = $actual (expected >= $expected)"
  fi
}

# --- Cleanup: delete test issues ---
cleanup() {
  log "Cleaning up test issues..."
  for id in "${CREATED_ISSUE_IDS[@]}"; do
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/issues/$id" > /dev/null 2>&1
  done
  log "Cleanup done"
}

trap cleanup EXIT

# ============================================================
#                        TEST EXECUTION
# ============================================================

echo ""
echo "========================================"
echo "  BugBase Dashboard Stats Test"
echo "========================================"
echo ""

login
get_project

# --- Snapshot before ---
log "Taking baseline dashboard snapshot..."
BEFORE=$(get_dashboard)
BEFORE_OPEN_TODAY=$(echo "$BEFORE" | jq '.stats.openToday')
BEFORE_INPROGRESS_TODAY=$(echo "$BEFORE" | jq '.stats.inProgressToday')
BEFORE_INREVIEW_TODAY=$(echo "$BEFORE" | jq '.stats.inReviewToday')
BEFORE_VERIFIED_TODAY=$(echo "$BEFORE" | jq '.stats.verifiedToday')
BEFORE_CLOSED_TODAY=$(echo "$BEFORE" | jq '.stats.closedToday')
BEFORE_OPEN=$(echo "$BEFORE" | jq '.stats.open')
BEFORE_INPROGRESS=$(echo "$BEFORE" | jq '.stats.inProgress')

log "Baseline - openToday=$BEFORE_OPEN_TODAY, inProgressToday=$BEFORE_INPROGRESS_TODAY, inReviewToday=$BEFORE_INREVIEW_TODAY, verifiedToday=$BEFORE_VERIFIED_TODAY, closedToday=$BEFORE_CLOSED_TODAY"

# ============================================================
# TEST 1: Create issue -> openToday should increase
# ============================================================
echo ""
log "=== TEST 1: New issue should count in Open Today ==="

ISSUE1=$(create_issue "[TEST] Dashboard open today test 1")
if [ -n "$ISSUE1" ]; then
  pass "Created issue #$ISSUE1"
  sleep 1

  AFTER_CREATE=$(get_dashboard)
  NEW_OPEN_TODAY=$(echo "$AFTER_CREATE" | jq '.stats.openToday')
  EXPECTED_OPEN_TODAY=$((BEFORE_OPEN_TODAY + 1))

  if [ "$NEW_OPEN_TODAY" -ge "$EXPECTED_OPEN_TODAY" ]; then
    pass "Open Today increased: $BEFORE_OPEN_TODAY -> $NEW_OPEN_TODAY"
  else
    fail "Open Today NOT increased: $BEFORE_OPEN_TODAY -> $NEW_OPEN_TODAY (expected >= $EXPECTED_OPEN_TODAY)"
  fi

  # All-time open should also increase
  NEW_OPEN=$(echo "$AFTER_CREATE" | jq '.stats.open')
  EXPECTED_OPEN=$((BEFORE_OPEN + 1))
  if [ "$NEW_OPEN" -ge "$EXPECTED_OPEN" ]; then
    pass "All-time Open increased: $BEFORE_OPEN -> $NEW_OPEN"
  else
    fail "All-time Open NOT increased: $BEFORE_OPEN -> $NEW_OPEN (expected >= $EXPECTED_OPEN)"
  fi
fi

# ============================================================
# TEST 2: Create issue + move to In Progress
# ============================================================
echo ""
log "=== TEST 2: Issue Open -> In Progress ==="

ISSUE2=$(create_issue "[TEST] Dashboard in-progress test")
if [ -n "$ISSUE2" ]; then
  pass "Created issue #$ISSUE2"
  sleep 1
  update_status "$ISSUE2" "In Progress"
  if [ $? -eq 0 ]; then
    pass "Status changed to In Progress"
    sleep 1

    AFTER_IP=$(get_dashboard)
    NEW_IP_TODAY=$(echo "$AFTER_IP" | jq '.stats.inProgressToday')
    EXPECTED_IP_TODAY=$((BEFORE_INPROGRESS_TODAY + 1))

    if [ "$NEW_IP_TODAY" -ge "$EXPECTED_IP_TODAY" ]; then
      pass "In Progress Today increased: $BEFORE_INPROGRESS_TODAY -> $NEW_IP_TODAY"
    else
      fail "In Progress Today NOT increased: $BEFORE_INPROGRESS_TODAY -> $NEW_IP_TODAY (expected >= $EXPECTED_IP_TODAY)"
    fi
  fi
fi

# ============================================================
# TEST 3: Full lifecycle Open -> In Progress -> In Review -> Verified -> Closed
# ============================================================
echo ""
log "=== TEST 3: Full status lifecycle ==="

ISSUE3=$(create_issue "[TEST] Dashboard lifecycle test")
if [ -n "$ISSUE3" ]; then
  pass "Created issue #$ISSUE3"

  STATUSES=("In Progress" "In Review" "Verified" "Closed")
  STAT_KEYS=("inProgressToday" "inReviewToday" "verifiedToday" "closedToday")

  for i in "${!STATUSES[@]}"; do
    sleep 1
    STATUS="${STATUSES[$i]}"
    KEY="${STAT_KEYS[$i]}"

    update_status "$ISSUE3" "$STATUS"
    if [ $? -eq 0 ]; then
      pass "Issue #$ISSUE3 -> $STATUS"
      sleep 1
      STATS=$(get_dashboard)
      VAL=$(echo "$STATS" | jq ".stats.$KEY")
      log "$KEY = $VAL"
    fi
  done

  # After closing, verify closedToday increased
  FINAL=$(get_dashboard)
  FINAL_CLOSED_TODAY=$(echo "$FINAL" | jq '.stats.closedToday')
  EXPECTED_CLOSED=$((BEFORE_CLOSED_TODAY + 1))

  if [ "$FINAL_CLOSED_TODAY" -ge "$EXPECTED_CLOSED" ]; then
    pass "Closed Today increased: $BEFORE_CLOSED_TODAY -> $FINAL_CLOSED_TODAY"
  else
    fail "Closed Today NOT increased: $BEFORE_CLOSED_TODAY -> $FINAL_CLOSED_TODAY (expected >= $EXPECTED_CLOSED)"
  fi
fi

# ============================================================
# TEST 4: Issue created + moved away from Open should NOT count in openToday
# ============================================================
echo ""
log "=== TEST 4: Issue moved from Open should not inflate Open Today ==="

SNAPSHOT_BEFORE_T4=$(get_dashboard)
OPEN_TODAY_BEFORE_T4=$(echo "$SNAPSHOT_BEFORE_T4" | jq '.stats.openToday')

ISSUE4=$(create_issue "[TEST] Dashboard move-away test")
if [ -n "$ISSUE4" ]; then
  pass "Created issue #$ISSUE4"
  sleep 1

  # Verify it counted in openToday
  MID=$(get_dashboard)
  OPEN_TODAY_MID=$(echo "$MID" | jq '.stats.openToday')
  EXPECTED_MID=$((OPEN_TODAY_BEFORE_T4 + 1))

  if [ "$OPEN_TODAY_MID" -ge "$EXPECTED_MID" ]; then
    pass "Open Today counted new issue: $OPEN_TODAY_BEFORE_T4 -> $OPEN_TODAY_MID"
  else
    fail "Open Today did not count new issue: $OPEN_TODAY_BEFORE_T4 -> $OPEN_TODAY_MID"
  fi

  # Move to In Progress — openToday should drop back
  update_status "$ISSUE4" "In Progress"
  if [ $? -eq 0 ]; then
    pass "Moved issue #$ISSUE4 to In Progress"
    sleep 1

    AFTER_MOVE=$(get_dashboard)
    OPEN_TODAY_AFTER_MOVE=$(echo "$AFTER_MOVE" | jq '.stats.openToday')

    if [ "$OPEN_TODAY_AFTER_MOVE" -le "$OPEN_TODAY_MID" ]; then
      pass "Open Today decreased after move: $OPEN_TODAY_MID -> $OPEN_TODAY_AFTER_MOVE (no inflation)"
    else
      fail "Open Today increased after move away: $OPEN_TODAY_MID -> $OPEN_TODAY_AFTER_MOVE (possible double-count!)"
    fi
  fi
fi

# ============================================================
# TEST 5: Multiple creates — batch check
# ============================================================
echo ""
log "=== TEST 5: Multiple new issues batch ==="

SNAP5=$(get_dashboard)
OT_BEFORE_5=$(echo "$SNAP5" | jq '.stats.openToday')

ISSUE5A=$(create_issue "[TEST] Batch open 1")
ISSUE5B=$(create_issue "[TEST] Batch open 2")
ISSUE5C=$(create_issue "[TEST] Batch open 3")

if [ -n "$ISSUE5A" ] && [ -n "$ISSUE5B" ] && [ -n "$ISSUE5C" ]; then
  pass "Created 3 batch issues: #$ISSUE5A, #$ISSUE5B, #$ISSUE5C"
  sleep 1

  SNAP5_AFTER=$(get_dashboard)
  OT_AFTER_5=$(echo "$SNAP5_AFTER" | jq '.stats.openToday')
  EXPECTED_5=$((OT_BEFORE_5 + 3))

  if [ "$OT_AFTER_5" -ge "$EXPECTED_5" ]; then
    pass "Open Today batch: $OT_BEFORE_5 -> $OT_AFTER_5 (expected >= $EXPECTED_5)"
  else
    fail "Open Today batch: $OT_BEFORE_5 -> $OT_AFTER_5 (expected >= $EXPECTED_5)"
  fi
fi

# ============================================================
#                        RESULTS
# ============================================================
echo ""
echo "========================================"
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "========================================"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
