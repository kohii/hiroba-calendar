# Test Artifacts - Saitama City Child Support Center Event Schedule App

This directory contains all test artifacts from the automated testing session.

## Contents

### Test Report
- **TEST_SUMMARY.md** - Comprehensive test report with:
  - Feature test results
  - Issues and limitations found
  - Screenshot descriptions
  - Recommendations
  - Overall assessment

### Screenshots (in `/screenshots/`)

1. **01-initial-state.png**
   - Initial app load with October 2026 events
   - Default month filter applied

2. **02-filters-open.png**
   - Filter panel expanded showing all controls
   - Month selector and center checkboxes visible

3. **03-filtered-events.png**
   - Events filtered for "にし" and "みぬま" centers
   - Multiple event cards visible

4. **04-favorites-marked.png**
   - "みぬま" center marked as favorite (filled star)
   - Both centers selected with filter badge showing "2"

5. **05-event-with-pdf-link.png**
   - Event cards showing PDF links clearly
   - Demonstrates link visibility and placement

6. **06-url-with-params.png**
   - Address bar showing URL with query parameters
   - Format: `?centers=nishi%2Cminuma&month=2026-10`

7. **07-calendar-view.png**
   - Calendar view button activated
   - Shows current limitation (view not yet implemented)

## Quick Summary

✅ **Working Features:**
- Filtering by month and centers
- Favorites system with star icons
- PDF links on all events
- URL parameter persistence
- List view display
- Filter badge counts
- Japanese text rendering

⚠️ **Known Issues:**
- Calendar view not yet implemented (button works, view doesn't change)
- React hydration error in development mode

## Test Coverage

All requested test scenarios were completed:
1. ✅ Open app
2. ✅ Initial state (redirects to default month)
3. ✅ Open filters
4. ✅ Select October 2026
5. ✅ Select "にし" and "みぬま" centers
6. ✅ View filtered events list
7. ✅ Mark "みぬま" as favorite with star
8. ✅ Verify PDF links visible
9. ✅ Verify URL contains query parameters
10. ✅ Test calendar view switcher

---

**Test Date:** October 20, 2026  
**Test Environment:** http://localhost:43123  
**Total Screenshots:** 7  
**Total Size:** ~2.0 MB
