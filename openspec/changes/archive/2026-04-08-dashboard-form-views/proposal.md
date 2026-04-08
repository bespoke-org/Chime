## Why

The dashboard currently presents forms in a single card grid view. That works for browsing a small set of forms, but it becomes less efficient when creators want to scan many forms quickly, compare status and response counts, or sort by updated date.

## What Changes

- Rename the existing dashboard layout to the "grid" view.
- Add a second dashboard layout called "table".
- Allow creators to switch between grid and table views from the dashboard.
- Show table columns for form title, status, response count, and updated date.
- Allow sorting in the table view by the available columns.
- Preserve the existing management actions for opening the builder and reviewing responses.

## Capabilities

### New Capabilities
- `dashboard-form-views`: creator dashboard supports switchable grid and table views for forms, with sortable columns in table mode.

### Modified Capabilities
- None.

## Impact

- Affected specs: `dashboard-form-views`
- Affected code: creator dashboard page, form list presentation components, dashboard sorting/view state handling
- Affected APIs: none required if sorting is implemented from existing server data in the dashboard page
