# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

trTracker is a desktop task management application built with Electron, React 18, TypeScript, and Vite. Data persists locally via localStorage (no backend).

## Commands

```bash
npm run dev              # Vite dev server (web only, localhost:5173)
npm run electron:dev     # Development mode with Electron (Vite + Electron)
npm run build            # Full build: TypeScript + Vite + electron-builder
npm run build:web        # Web build only (outputs to dist/)
npm run electron:build   # Build and package Electron app (outputs to release/)
```

## Architecture

**Stack:** React 18 + TypeScript + Vite + Electron 28 + Tailwind CSS

**State Management:** React Context API with localStorage persistence
- `TaskContext` - CRUD operations for tasks, import/export, sorting
- `ThemeContext` - Dark/light theme toggle

**Routing:** HashRouter (Electron-compatible)
- `/` → TaskList (main view with filtering)
- `/add` → AddTask (creation form)

**Key Data Flow:**
```
main.tsx → HashRouter → ThemeProvider → TaskProvider → App.tsx → Routes
```

**Task Interface** (`src/types/Task.ts`):
```typescript
interface Task {
  id: string
  priority: 1 | 2 | 3 | 4 | 5    // Lower = higher priority
  status: 'pending' | 'in-progress' | 'completed'
  task: string
  notes: string
  done: boolean
  completedDate: string | null
  createdAt: string
  dueDate: string | null
}
```

## Key Directories

- `electron/` - Main process (`main.ts`) and preload script (`preload.ts`)
- `src/context/` - TaskContext and ThemeContext providers
- `src/pages/` - TaskList and AddTask page components
- `src/components/` - Layout wrapper and TaskRow component
- `src/hooks/` - useLocalStorage custom hook

## Build Output

- `dist/` - Vite web build
- `dist-electron/` - Compiled Electron main process
- `release/` - Packaged applications (dmg, exe, AppImage)

## Configuration

- TypeScript strict mode enabled
- Tailwind dark mode via class strategy (`dark:` prefix)
- Path alias: `@/` maps to `src/`