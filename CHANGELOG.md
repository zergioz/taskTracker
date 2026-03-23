# Changelog

All notable changes to Task Tracker will be documented in this file.

## [1.9.2] - 2026-03-23

### Added
- **Sort Selector**: Sort tasks by Priority, Due Date, Newest First, or Name A-Z — persists across reloads
- **Consolidated Stats**: Merged Stats page charts (monthly/yearly) into the Stats widget as a collapsible "Show Charts" section

### Removed
- **Stats Page**: Removed separate `/stats` route and nav link — all stats are now in the inline widget
- **Redundant Progress Bar**: Removed duplicate completion progress bar from the task list

## [1.9.1] - 2026-03-23

### Added
- **"Today" Button**: One-click button to set due date to today on both Add/Edit Task form and quick-add bar
- **"Clear All Filters" Button**: Shown in empty state when filters are active, resets all filters with one click

## [1.9.0] - 2026-03-23

### Added
- **Edit Task Route**: Full-page edit form at `/edit/:id` — edit button now opens the complete form instead of limited inline editing
- **Yearly Recurrence**: Added "Y" (Yearly) option to the recurrence picker (D, W, M, Y)
- **Recurrence on Add Task**: The Add New Task form now includes a recurrence picker
- **Due Date on Quick Add**: Quick add bar now includes a date picker
- **Persistent Filters**: Search, status, priority, category, and date filters persist across page navigation and reloads

### Changed
- **Due Date + Recurrence Coupling**: Recurrence picker is disabled when no due date is set; clearing a due date resets recurrence to "none"

## [1.8.1] - 2026-02-24

### Changed
- **Bundle Size Optimization**: Reduced JS bundle from 77KB to 72KB gzipped (~7% reduction)
  - Replaced `uuid` package with native `crypto.randomUUID()`
  - Replaced `react-router-dom` (~15KB) with `wouter` (~1.5KB)
- **Reorganized Filter Layout**:
  - Search input now on same row as status tabs (All/Active/Completed/Urgent/Starred)
  - Priority, category, and date filters on dedicated row
  - Quick add moved closer to task list
  - Filter buttons separated from quick add pickers for clearer UX
- Removed dependencies: `uuid`, `@types/uuid`, `react-router-dom`
- Added dependency: `wouter` (lightweight router with hash support)

## [1.6.0] - 2026-02-23

### Added
- **Active Filter Summary Bar**: Shows all active filters with individual clear buttons and "Clear all" option
- **Progress Indicator**: Visual progress bar showing task completion with "completed today" counter
- **Enhanced Keyboard Shortcuts**:
  - `Q` to focus quick add
  - `1-5` to filter by priority
  - `Shift+?` for help
- **Improved Empty States**: Context-aware messages with icons and helpful suggestions
- **Filter Button Labels**: Small labels ("Priority", "Category") above filter buttons for clarity

### Changed
- **Overdue Task Highlighting**: Tasks now have distinct visual styling:
  - Overdue: Red left border + red background tint
  - Due Today: Orange left border + orange background tint

## [1.5.0] - 2026-02-23

### Added
- Priority filter functionality via P1-P5 buttons
- Priority buttons now serve dual purpose: filter tasks AND set priority for new tasks
- Clear button for priority filter

## [1.4.0] - 2026-02-23

### Changed
- Combined category filter with quick add category picker
- Category buttons now serve dual purpose: filter tasks AND set categories for new tasks
- Removed separate category filter row for cleaner UI

## [1.3.0] - 2026-02-23

### Added
- Category filter buttons in the filter bar (OnPrem, Cloud, SIPR, NIPR)
- Category count display on filter buttons
- Category editing in task row inline edit mode

## [1.2.0] - 2026-02-23

### Added
- **Categories Feature**: Multi-select categories (OnPrem, Cloud, SIPR, NIPR)
- Category selector in Add Task page
- Category picker in quick add
- Category display in TaskRow and TaskCard
- Color-coded category badges

## [1.1.0] - 2026-02-23

### Added
- **Statistics Page**: Bar charts showing tasks created/completed by month and year
- **Rich Notes**: Markdown-like formatting (bold, italic, lists, checkboxes)
- **Highlight Feature**: Star/highlight important tasks
- **Priority Picker**: P1-P5 buttons in quick add
- **Date Filters**: Filter by year and month with quick presets (This Month, Last Month, This Year)
- Notes modal with formatting toolbar and preview mode

### Changed
- Modal component now supports different sizes (sm, md, lg)
- Improved notes cell clickability and styling

## [1.0.0] - 2026-02-23

### Added
- Initial release
- Task CRUD operations
- Priority levels (P1-P5)
- Status tracking (Pending, In Progress, Completed)
- Due dates with urgency indicators
- Subtasks support
- Quick add task
- Search functionality
- Filter by status (All, Active, Completed, Time-Sensitive)
- Bulk selection and actions
- Import from TSV file
- Export to JSON and CSV
- Dark mode support
- Keyboard shortcuts (Ctrl+N, Ctrl+K)
- Toast notifications with undo
- Local storage persistence
- Electron desktop app with portable Windows executable