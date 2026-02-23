# Task Tracker

A lightweight, desktop task management application built with Electron, React, TypeScript, and Tailwind CSS. Data persists locally via localStorage - no backend required.

## Features

- **Task Management**: Create, edit, delete, and organize tasks with priorities (P1-P5)
- **Categories**: Organize tasks with categories (OnPrem, Cloud, SIPR, NIPR) with multi-select support
- **Due Dates**: Track deadlines with visual indicators for overdue, due today, and upcoming tasks
- **Subtasks**: Break down tasks into smaller subtasks
- **Rich Notes**: Format notes with markdown-like syntax (bold, italic, lists, checkboxes)
- **Highlighting**: Star important tasks for quick access
- **Filtering**: Filter by status, priority, category, date range, and search
- **Bulk Actions**: Select multiple tasks for batch operations
- **Import/Export**: Import tasks from TSV files, export to JSON or CSV
- **Statistics**: View task completion graphs by month/year
- **Dark Mode**: Toggle between light and dark themes
- **Keyboard Shortcuts**: Quick access to common actions

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Focus quick add input |
| `/` or `Ctrl+K` | Focus search |
| `Ctrl+N` | New task with details |
| `1-5` | Filter by priority |
| `Esc` | Clear filters / Exit selection |
| `Shift+?` | Show keyboard shortcuts help |

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Desktop**: Electron 28
- **State Management**: React Context API
- **Storage**: localStorage

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone git@github.com:zergioz/taskTracker.git
cd taskTracker

# Install dependencies
npm install
```

### Development

```bash
# Run web development server
npm run dev

# Run with Electron
npm run electron:dev
```

### Building

```bash
# Build web version
npm run build:web

# Build Electron app (creates portable .exe)
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── Layout.tsx
│   ├── Modal.tsx
│   └── TaskRow.tsx
├── context/        # React Context providers
│   ├── TaskContext.tsx
│   ├── ThemeContext.tsx
│   └── ToastContext.tsx
├── hooks/          # Custom React hooks
│   └── useLocalStorage.ts
├── pages/          # Page components
│   ├── AddTask.tsx
│   ├── Stats.tsx
│   └── TaskList.tsx
├── types/          # TypeScript type definitions
│   └── Task.ts
├── App.tsx         # Main app component
├── main.tsx        # Entry point
└── index.css       # Global styles

electron/
├── main.ts         # Electron main process
└── preload.ts      # Preload script
```

## License

MIT

## Author

Sergio F. Rodriguez