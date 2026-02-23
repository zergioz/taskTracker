import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '../context/TaskContext'
import { useTheme } from '../context/ThemeContext'
import { exportTasksToJSON, exportTasksToCSV, downloadFile } from '../types/Task'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { tasks, clearAllTasks, restoreTasks } = useTasks()
  const { theme, toggleTheme } = useTheme()

  const commands: Command[] = useMemo(() => [
    {
      id: 'new-task',
      label: 'New Task',
      description: 'Create a new task with details',
      icon: <PlusIcon />,
      action: () => { navigate('/add'); onClose() },
      keywords: ['add', 'create', 'new']
    },
    {
      id: 'go-home',
      label: 'Go to Tasks',
      description: 'View all tasks',
      icon: <HomeIcon />,
      action: () => { navigate('/'); onClose() },
      keywords: ['home', 'list', 'view']
    },
    {
      id: 'toggle-theme',
      label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
      description: 'Toggle between light and dark theme',
      icon: theme === 'light' ? <MoonIcon /> : <SunIcon />,
      action: () => { toggleTheme(); onClose() },
      keywords: ['dark', 'light', 'theme', 'mode']
    },
    {
      id: 'export-json',
      label: 'Export as JSON',
      description: 'Download all tasks as JSON file',
      icon: <DownloadIcon />,
      action: () => {
        const json = exportTasksToJSON(tasks)
        downloadFile(json, `tasks-${new Date().toISOString().split('T')[0]}.json`, 'application/json')
        onClose()
      },
      keywords: ['download', 'backup', 'save']
    },
    {
      id: 'export-csv',
      label: 'Export as CSV',
      description: 'Download all tasks as CSV file',
      icon: <DownloadIcon />,
      action: () => {
        const csv = exportTasksToCSV(tasks)
        downloadFile(csv, `tasks-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
        onClose()
      },
      keywords: ['download', 'backup', 'save', 'excel', 'spreadsheet']
    },
    {
      id: 'filter-all',
      label: 'Show All Tasks',
      icon: <FilterIcon />,
      action: () => { navigate('/?filter=all'); onClose() },
      keywords: ['filter', 'view']
    },
    {
      id: 'filter-active',
      label: 'Show Active Tasks',
      icon: <FilterIcon />,
      action: () => { navigate('/?filter=active'); onClose() },
      keywords: ['filter', 'pending', 'incomplete']
    },
    {
      id: 'filter-completed',
      label: 'Show Completed Tasks',
      icon: <CheckIcon />,
      action: () => { navigate('/?filter=completed'); onClose() },
      keywords: ['filter', 'done', 'finished']
    },
    {
      id: 'filter-urgent',
      label: 'Show Urgent Tasks',
      icon: <ClockIcon />,
      action: () => { navigate('/?filter=time-sensitive'); onClose() },
      keywords: ['filter', 'due', 'deadline', 'time']
    },
    {
      id: 'clear-all',
      label: 'Clear All Tasks',
      description: 'Delete all tasks (can be undone)',
      icon: <TrashIcon />,
      action: () => {
        const deleted = clearAllTasks()
        onClose()
        // Show toast would be ideal here but we'll handle via the main UI
        if (deleted.length > 0) {
          setTimeout(() => restoreTasks(deleted), 0) // Undo immediately available
        }
      },
      keywords: ['delete', 'remove', 'reset']
    }
  ], [navigate, onClose, theme, toggleTheme, tasks, clearAllTasks, restoreTasks])

  // Add task search results
  const taskResults: Command[] = useMemo(() => {
    if (!query.trim()) return []
    const lowerQuery = query.toLowerCase()
    return tasks
      .filter(task =>
        task.task.toLowerCase().includes(lowerQuery) ||
        task.notes.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .map(task => ({
        id: `task-${task.id}`,
        label: task.task,
        description: task.done ? 'Completed' : `Priority ${task.priority} - ${task.status}`,
        icon: task.done ? <CheckIcon /> : <TaskIcon />,
        action: () => {
          // Could navigate to task detail or toggle
          onClose()
        },
        keywords: []
      }))
  }, [query, tasks, onClose])

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const lowerQuery = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    )
  }, [commands, query])

  const allResults = useMemo(() => [
    ...filteredCommands,
    ...taskResults
  ], [filteredCommands, taskResults])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    // Scroll selected item into view
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, allResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allResults[selectedIndex]) {
          allResults[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <SearchIcon className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {allResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          ) : (
            <>
              {filteredCommands.length > 0 && (
                <div className="px-2 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Commands
                </div>
              )}
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex-shrink-0 w-5 h-5 text-gray-400">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {taskResults.length > 0 && (
                <>
                  <div className="px-2 py-1 mt-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Tasks
                  </div>
                  {taskResults.map((task, index) => (
                    <button
                      key={task.id}
                      onClick={task.action}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        index + filteredCommands.length === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="flex-shrink-0 w-5 h-5 text-gray-400">{task.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{task.label}</div>
                        {task.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

export default CommandPalette
