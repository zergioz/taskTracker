import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { useTasks } from '../context/TaskContext'
import { useToast } from '../context/ToastContext'
import { useNotifications } from '../hooks/useNotifications'
import { useLocalStorage } from '../hooks/useLocalStorage'
import TaskRow from '../components/TaskRow'
import Modal from '../components/Modal'
import Stats from '../components/Stats'
import { getDueStatus, Task, exportTasksToJSON, exportTasksToCSV, downloadFile, getSubtaskProgress, getDueStatusColor, getDueStatusLabel, CATEGORY_COLORS, TASK_CATEGORIES, TaskCategory, RecurrenceType } from '../types/Task'

type FilterType = 'all' | 'active' | 'completed' | 'time-sensitive' | 'highlighted'
type SortType = 'default' | 'priority' | 'due-date' | 'created' | 'name'

// Render formatted notes with markdown-like syntax
function FormattedNotes({ text }: { text: string }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, lineIndex) => {
        // Check for bullet list
        if (line.startsWith('- ')) {
          return (
            <div key={lineIndex} className="flex items-start gap-2 ml-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>{formatInlineText(line.slice(2))}</span>
            </div>
          )
        }

        // Check for numbered list
        const numberedMatch = line.match(/^(\d+)\.\s/)
        if (numberedMatch) {
          return (
            <div key={lineIndex} className="flex items-start gap-2 ml-2">
              <span className="text-gray-400 min-w-[1.5rem]">{numberedMatch[1]}.</span>
              <span>{formatInlineText(line.slice(numberedMatch[0].length))}</span>
            </div>
          )
        }

        // Check for checkbox
        const checkboxMatch = line.match(/^\[([ x])\]\s?/)
        if (checkboxMatch) {
          const checked = checkboxMatch[1] === 'x'
          return (
            <div key={lineIndex} className="flex items-start gap-2 ml-2">
              <span className={`mt-0.5 ${checked ? 'text-green-500' : 'text-gray-400'}`}>
                {checked ? '☑' : '☐'}
              </span>
              <span className={checked ? 'line-through text-gray-400' : ''}>
                {formatInlineText(line.slice(checkboxMatch[0].length))}
              </span>
            </div>
          )
        }

        // Empty line
        if (!line.trim()) {
          return <div key={lineIndex} className="h-2" />
        }

        // Regular paragraph
        return (
          <p key={lineIndex}>{formatInlineText(line)}</p>
        )
      })}
    </div>
  )
}

// Format inline text (bold, italic)
function formatInlineText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Check for bold **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Check for italic *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Find next special char
    const nextSpecial = remaining.search(/\*/)
    if (nextSpecial === -1) {
      parts.push(remaining)
      break
    } else if (nextSpecial === 0) {
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return parts
}

function TaskList() {
  const {
    tasks, addTask, toggleDone, updateTask, deleteTask, deleteTasks,
    restoreTask, restoreTasks, importTasks, clearAllTasks, bulkUpdateTasks,
    addSubtask, toggleSubtask, deleteSubtask, reorderTasks
  } = useTasks()
  const { showToast } = useToast()
  const { notificationPermission, requestPermission } = useNotifications(tasks, updateTask)
  const [showStats, setShowStats] = useState(true)
  const [quickAddRecurrence, setQuickAddRecurrence] = useState<RecurrenceType>('none')
  const [quickAddDueDate, setQuickAddDueDate] = useState<string | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [, navigate] = useLocation()
  const [filter, setFilter] = useLocalStorage<FilterType>('taskFilter', 'all')
  const [searchQuery, setSearchQuery] = useLocalStorage<string>('taskSearchQuery', '')
  const [filterYear, setFilterYear] = useLocalStorage<number | null>('taskFilterYear', null)
  const [filterMonth, setFilterMonth] = useLocalStorage<number | null>('taskFilterMonth', null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [quickAddTask, setQuickAddTask] = useState('')
  const [quickAddPriority, setQuickAddPriority] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [filterPriority, setFilterPriority] = useLocalStorage<1 | 2 | 3 | 4 | 5 | null>('taskFilterPriority', null)
  const [quickAddCategories, setQuickAddCategories] = useState<TaskCategory[]>([])
  const [filterCategories, setFilterCategories] = useLocalStorage<TaskCategory[]>('taskFilterCategories', [])
  const [sortBy, setSortBy] = useLocalStorage<SortType>('taskSortBy', 'default')
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [notesModalTask, setNotesModalTask] = useState<Task | null>(null)
  const [notesModalValue, setNotesModalValue] = useState('')
  const [notesPreviewMode, setNotesPreviewMode] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const completedCount = tasks.filter(t => t.done).length
  const activeCount = tasks.length - completedCount
  const timeSensitiveCount = tasks.filter(t => t.dueDate && !t.done).length
  const highlightedCount = tasks.filter(t => t.highlighted).length

  // Get available years from tasks for the year filter dropdown
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    tasks.forEach(task => {
      if (task.createdAt) {
        years.add(new Date(task.createdAt).getFullYear())
      }
    })
    return Array.from(years).sort((a, b) => b - a) // Most recent first
  }, [tasks])

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Update document title with task count
  useEffect(() => {
    const title = activeCount > 0
      ? `Task Tracker (${activeCount} active)`
      : 'Task Tracker'
    document.title = title
  }, [activeCount])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          target.blur()
        }
        return
      }

      // Ctrl/Cmd + N: New task with details
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/add')
      }
      // Ctrl/Cmd + K or /: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' || e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder="Search tasks..."]') as HTMLInputElement
        searchInput?.focus()
      }
      // Q: Focus quick add
      if (e.key === 'q') {
        e.preventDefault()
        quickAddInputRef.current?.focus()
      }
      // 1-5: Filter by priority
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const p = parseInt(e.key) as 1 | 2 | 3 | 4 | 5
        if (filterPriority === p) {
          setFilterPriority(null)
          setQuickAddPriority(3)
        } else {
          setFilterPriority(p)
          setQuickAddPriority(p)
        }
      }
      // Escape: Clear filters or exit selection mode
      if (e.key === 'Escape') {
        if (selectionMode) {
          setSelectionMode(false)
          setSelectedTasks(new Set())
        } else if (filterPriority !== null || filterCategories.length > 0 || searchQuery) {
          setFilterPriority(null)
          setQuickAddPriority(3)
          setFilterCategories([])
          setQuickAddCategories([])
          setSearchQuery('')
        }
      }
      // ?: Show keyboard shortcuts help
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault()
        alert('Keyboard Shortcuts:\n\n' +
          'Q - Quick add task\n' +
          '/ or Ctrl+K - Search\n' +
          'Ctrl+N - New task with details\n' +
          '1-5 - Filter by priority\n' +
          'Esc - Clear filters / Exit selection\n' +
          '? - Show this help')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, selectionMode, filterPriority, filterCategories, searchQuery])

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      if (filter === 'active' && task.done) return false
      if (filter === 'completed' && !task.done) return false
      if (filter === 'time-sensitive' && (!task.dueDate || task.done)) return false
      if (filter === 'highlighted' && !task.highlighted) return false

      // Year/Month filter based on createdAt
      if (filterYear !== null && task.createdAt) {
        const taskDate = new Date(task.createdAt)
        if (taskDate.getFullYear() !== filterYear) return false
        if (filterMonth !== null && taskDate.getMonth() !== filterMonth) return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesTask = task.task.toLowerCase().includes(query)
        const matchesNotes = task.notes.toLowerCase().includes(query)
        if (!matchesTask && !matchesNotes) return false
      }

      // Category filter - task must have ALL selected categories
      if (filterCategories.length > 0) {
        const taskCategories = task.categories || []
        const hasAllCategories = filterCategories.every(cat => taskCategories.includes(cat))
        if (!hasAllCategories) return false
      }

      // Priority filter
      if (filterPriority !== null && task.priority !== filterPriority) {
        return false
      }

      return true
    })

    if (filter === 'time-sensitive') {
      filtered = [...filtered].sort((a, b) => {
        const statusOrder = { overdue: 0, today: 1, soon: 2, upcoming: 3, later: 4, none: 5 }
        const aStatus = getDueStatus(a.dueDate)
        const bStatus = getDueStatus(b.dueDate)
        if (statusOrder[aStatus] !== statusOrder[bStatus]) {
          return statusOrder[aStatus] - statusOrder[bStatus]
        }
        return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      })
    } else if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'priority':
            return a.priority - b.priority
          case 'due-date': {
            if (!a.dueDate && !b.dueDate) return 0
            if (!a.dueDate) return 1
            if (!b.dueDate) return -1
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          }
          case 'created':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          case 'name':
            return a.task.localeCompare(b.task)
          default:
            return 0
        }
      })
    }

    return filtered
  }, [tasks, filter, searchQuery, filterYear, filterMonth, filterCategories, filterPriority, sortBy])

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const count = importTasks(content)
      setImportMessage(`Imported ${count} tasks`)
      setTimeout(() => setImportMessage(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearAll = () => {
    setClearAllModalOpen(true)
  }

  const confirmClearAll = () => {
    const deletedTasks = clearAllTasks()
    setClearAllModalOpen(false)
    showToast(
      `Deleted ${deletedTasks.length} tasks`,
      'success',
      () => restoreTasks(deletedTasks)
    )
  }

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id)
    setDeleteModalOpen(true)
  }

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      const deletedTask = deleteTask(taskToDelete)
      setTaskToDelete(null)
      if (deletedTask) {
        showToast(
          `Deleted "${deletedTask.task}"`,
          'success',
          () => restoreTask(deletedTask)
        )
      }
    }
    setDeleteModalOpen(false)
  }

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAddTask.trim()) return

    addTask({
      task: quickAddTask.trim(),
      priority: quickAddPriority,
      status: 'pending',
      notes: '',
      done: false,
      dueDate: quickAddDueDate,
      subtasks: [],
      highlighted: false,
      categories: quickAddCategories,
      recurrence: quickAddDueDate ? quickAddRecurrence : 'none'
    })
    setQuickAddTask('')
    setQuickAddPriority(3)
    setQuickAddCategories([])
    setQuickAddRecurrence('none')
    setQuickAddDueDate(null)
    quickAddInputRef.current?.focus()
    showToast('Task added', 'success')
  }

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    if (!draggedTaskId || draggedTaskId === targetTaskId) return

    const targetIndex = filteredTasks.findIndex(t => t.id === targetTaskId)
    if (targetIndex !== -1) {
      reorderTasks(draggedTaskId, targetIndex)
      showToast('Task reordered', 'success')
    }
    setDraggedTaskId(null)
  }, [draggedTaskId, filteredTasks, reorderTasks, showToast])

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null)
  }, [])

  const handleOpenNotesModal = (task: Task) => {
    setNotesModalTask(task)
    setNotesModalValue(task.notes)
    setNotesPreviewMode(false)
    setNotesModalOpen(true)
  }

  const handleSaveNotes = () => {
    if (notesModalTask) {
      updateTask(notesModalTask.id, { notes: notesModalValue })
      showToast('Notes updated', 'success')
    }
    setNotesModalOpen(false)
    setNotesModalTask(null)
  }

  const handleToggleHighlight = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      updateTask(taskId, { highlighted: !task.highlighted })
    }
  }

  const handleExportJSON = () => {
    const json = exportTasksToJSON(tasks)
    downloadFile(json, `tasks-${new Date().toISOString().split('T')[0]}.json`, 'application/json')
    setShowExportMenu(false)
    showToast('Exported as JSON', 'success')
  }

  const handleExportCSV = () => {
    const csv = exportTasksToCSV(tasks)
    downloadFile(csv, `tasks-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    setShowExportMenu(false)
    showToast('Exported as CSV', 'success')
  }

  // Selection handlers
  const handleSelectTask = (id: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)))
    }
  }

  const handleBulkDelete = () => {
    const ids = Array.from(selectedTasks)
    const deleted = deleteTasks(ids)
    setSelectedTasks(new Set())
    setSelectionMode(false)
    showToast(
      `Deleted ${deleted.length} tasks`,
      'success',
      () => restoreTasks(deleted)
    )
  }

  const handleBulkMarkDone = () => {
    const ids = Array.from(selectedTasks)
    bulkUpdateTasks(ids, { done: true })
    setSelectedTasks(new Set())
    setSelectionMode(false)
    showToast(`Marked ${ids.length} tasks as done`, 'success')
  }

  const handleBulkMarkUndone = () => {
    const ids = Array.from(selectedTasks)
    bulkUpdateTasks(ids, { done: false })
    setSelectedTasks(new Set())
    setSelectionMode(false)
    showToast(`Marked ${ids.length} tasks as not done`, 'success')
  }

  const handleBulkSetPriority = (priority: 1 | 2 | 3 | 4 | 5) => {
    const ids = Array.from(selectedTasks)
    bulkUpdateTasks(ids, { priority })
    setSelectedTasks(new Set())
    setSelectionMode(false)
    showToast(`Set priority to P${priority} for ${ids.length} tasks`, 'success')
  }

  const taskToDeleteName = taskToDelete
    ? tasks.find(t => t.id === taskToDelete)?.task || 'this task'
    : ''

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tasks yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first task</p>

        <form onSubmit={handleQuickAdd} className="max-w-md mx-auto mb-6">
          <div className="flex gap-2">
            <input
              ref={quickAddInputRef}
              type="text"
              value={quickAddTask}
              onChange={(e) => setQuickAddTask(e.target.value)}
              placeholder="Type a task and press Enter..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!quickAddTask.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        <div className="flex gap-3 justify-center">
          <Link
            to="/add"
            className="inline-flex items-center px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add with details
          </Link>
          <button
            onClick={handleImport}
            className="inline-flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import from file
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+N</kbd> to add a new task with details
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.tsv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeCount} active, {completedCount} completed
          </p>
        </div>
        <div className="flex gap-2">
          {/* Notification Permission Button */}
          {notificationPermission !== 'granted' && (
            <button
              onClick={requestPermission}
              className="inline-flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Enable notifications for due dates"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          )}
          {notificationPermission === 'granted' && (
            <span className="inline-flex items-center px-3 py-2 text-green-600 dark:text-green-400" title="Notifications enabled">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
          )}

          {/* Stats Toggle */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`inline-flex items-center px-3 py-2 rounded-md transition-colors ${
              showStats
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle statistics"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Export tasks"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Export as JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Export as CSV
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleImport}
            className="inline-flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Import tasks from file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>

          <button
            onClick={() => setSelectionMode(!selectionMode)}
            className={`inline-flex items-center px-3 py-2 rounded-md transition-colors ${
              selectionMode
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle selection mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>

          <button
            onClick={handleClearAll}
            className="inline-flex items-center px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title="Clear all tasks"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.tsv"
        onChange={handleFileChange}
        className="hidden"
      />

      {importMessage && (
        <div className="mb-4 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md">
          {importMessage}
        </div>
      )}

      {/* Search + Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              filter === 'active'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              filter === 'completed'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilter('time-sensitive')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              filter === 'time-sensitive'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300'
            }`}
          >
            Urgent ({timeSensitiveCount})
          </button>
          <button
            onClick={() => setFilter('highlighted')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              filter === 'highlighted'
                ? 'bg-yellow-400 text-yellow-900 shadow-sm'
                : 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300'
            }`}
          >
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              ({highlightedCount})
            </span>
          </button>
        </div>
      </div>

      {/* Priority, Category & Date Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Priority Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">Priority</span>
            {([1, 2, 3, 4, 5] as const).map(p => {
              const isFilterActive = filterPriority === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    if (isFilterActive) {
                      setFilterPriority(null)
                      setQuickAddPriority(3)
                    } else {
                      setFilterPriority(p)
                      setQuickAddPriority(p)
                    }
                  }}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                    isFilterActive
                      ? p === 1 ? 'bg-red-500 text-white'
                        : p === 2 ? 'bg-orange-500 text-white'
                        : p === 3 ? 'bg-yellow-500 text-white'
                        : p === 4 ? 'bg-blue-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={`Filter by Priority ${p}`}
                >
                  P{p}
                </button>
              )
            })}
            {filterPriority !== null && (
              <button
                type="button"
                onClick={() => {
                  setFilterPriority(null)
                  setQuickAddPriority(3)
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear priority filter"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">Category</span>
            {TASK_CATEGORIES.map(cat => {
              const isSelectedForFilter = filterCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setFilterCategories(prev =>
                      isSelectedForFilter
                        ? prev.filter(c => c !== cat)
                        : [...prev, cat]
                    )
                  }}
                  className={`px-2 h-7 rounded text-xs font-medium transition-colors ${
                    isSelectedForFilter
                      ? CATEGORY_COLORS[cat]
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={`Filter by ${cat}`}
                >
                  {cat}
                </button>
              )
            })}
            {filterCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterCategories([])}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear category filter"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Date Filters */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => {
                const now = new Date()
                setFilterYear(now.getFullYear())
                setFilterMonth(now.getMonth())
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filterYear === new Date().getFullYear() && filterMonth === new Date().getMonth()
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
                setFilterYear(lastMonth.getFullYear())
                setFilterMonth(lastMonth.getMonth())
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                (() => {
                  const now = new Date()
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
                  return filterYear === lastMonth.getFullYear() && filterMonth === lastMonth.getMonth()
                })()
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => {
                setFilterYear(new Date().getFullYear())
                setFilterMonth(null)
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filterYear === new Date().getFullYear() && filterMonth === null
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
              }`}
            >
              This Year
            </button>
            <select
              value={filterYear ?? ''}
              onChange={(e) => {
                const val = e.target.value
                setFilterYear(val ? parseInt(val) : null)
                if (!val) setFilterMonth(null)
              }}
              className="px-1 py-1 border-0 bg-transparent text-gray-900 dark:text-white text-xs focus:outline-none"
            >
              <option value="">Year</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={filterMonth ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (val !== '') {
                  if (filterYear === null) {
                    setFilterYear(new Date().getFullYear())
                  }
                  setFilterMonth(parseInt(val))
                } else {
                  setFilterMonth(null)
                }
              }}
              className="px-1 py-1 border-0 bg-transparent text-gray-900 dark:text-white text-xs focus:outline-none"
            >
              <option value="">Month</option>
              {monthNames.map((name, index) => (
                <option key={index} value={index}>{name.slice(0, 3)}</option>
              ))}
            </select>
            {filterYear !== null && (
              <button
                onClick={() => { setFilterYear(null); setFilterMonth(null) }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear date filter"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectionMode && selectedTasks.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedTasks.size} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleBulkMarkDone}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Mark Done
            </button>
            <button
              onClick={handleBulkMarkUndone}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Mark Undone
            </button>
            <select
              onChange={(e) => handleBulkSetPriority(Number(e.target.value) as 1|2|3|4|5)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              defaultValue=""
            >
              <option value="" disabled>Set Priority</option>
              <option value="1">P1 - Highest</option>
              <option value="2">P2 - High</option>
              <option value="3">P3 - Medium</option>
              <option value="4">P4 - Low</option>
              <option value="5">P5 - Lowest</option>
            </select>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete
            </button>
          </div>
          <button
            onClick={() => { setSelectionMode(false); setSelectedTasks(new Set()) }}
            className="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active Filters Summary */}
      {(filterPriority !== null || filterCategories.length > 0 || filterYear !== null || searchQuery) && (
        <div className="flex items-center justify-between gap-4 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Active Filters:</span>
            {filterPriority !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                Priority {filterPriority}
                <button onClick={() => { setFilterPriority(null); setQuickAddPriority(3) }} className="hover:text-blue-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {filterCategories.map(cat => (
              <span key={cat} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                {cat}
                <button onClick={() => { setFilterCategories(prev => prev.filter(c => c !== cat)); setQuickAddCategories(prev => prev.filter(c => c !== cat)) }} className="hover:opacity-70">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
            {filterYear !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                {filterMonth !== null ? `${monthNames[filterMonth].slice(0, 3)} ` : ''}{filterYear}
                <button onClick={() => { setFilterYear(null); setFilterMonth(null) }} className="hover:text-blue-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setFilterPriority(null)
              setQuickAddPriority(3)
              setFilterCategories([])
              setQuickAddCategories([])
              setFilterYear(null)
              setFilterMonth(null)
              setSearchQuery('')
              setSortBy('default')
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Quick Add Task */}
      <form onSubmit={handleQuickAdd} className="mb-4">
        <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-gray-800 rounded-lg shadow p-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <input
              ref={quickAddInputRef}
              type="text"
              value={quickAddTask}
              onChange={(e) => setQuickAddTask(e.target.value)}
              onFocus={() => setQuickAddExpanded(true)}
              placeholder="Quick add task... (press Q to focus, Enter to add)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Options toggle */}
          <button
            type="button"
            onClick={() => setQuickAddExpanded(!quickAddExpanded)}
            className={`p-2 rounded-md transition-colors ${
              quickAddExpanded
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={quickAddExpanded ? 'Hide options' : 'Show options (priority, category, date, recurrence)'}
          >
            <svg className={`w-5 h-5 transition-transform ${quickAddExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={!quickAddTask.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>

          {/* Expanded options indicator */}
          {!quickAddExpanded && (quickAddPriority !== 3 || quickAddCategories.length > 0 || quickAddDueDate || quickAddRecurrence !== 'none') && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {quickAddPriority !== 3 && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">P{quickAddPriority}</span>}
              {quickAddCategories.length > 0 && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{quickAddCategories.join(', ')}</span>}
              {quickAddDueDate && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{quickAddDueDate}</span>}
              {quickAddRecurrence !== 'none' && <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded">{quickAddRecurrence.charAt(0).toUpperCase()}</span>}
            </div>
          )}
        </div>

        {/* Collapsible pickers */}
        {quickAddExpanded && (
        <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-gray-800 rounded-b-lg shadow px-3 pb-3 -mt-1 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Priority Picker */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
            {([1, 2, 3, 4, 5] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setQuickAddPriority(p)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                  quickAddPriority === p
                    ? p === 1 ? 'bg-red-500 text-white'
                      : p === 2 ? 'bg-orange-500 text-white'
                      : p === 3 ? 'bg-yellow-500 text-white'
                      : p === 4 ? 'bg-blue-500 text-white'
                      : 'bg-gray-500 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={`Priority ${p}`}
              >
                P{p}
              </button>
            ))}
          </div>

          {/* Category Picker */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
            {TASK_CATEGORIES.map(cat => {
              const isSelected = quickAddCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setQuickAddCategories(prev =>
                      isSelected ? prev.filter(c => c !== cat) : [...prev, cat]
                    )
                  }}
                  className={`px-2 h-7 rounded text-xs font-medium transition-colors ${
                    isSelected
                      ? CATEGORY_COLORS[cat]
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={cat}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Due Date Picker */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={quickAddDueDate || ''}
              onChange={(e) => {
                const val = e.target.value || null
                setQuickAddDueDate(val)
                if (!val) setQuickAddRecurrence('none')
              }}
              className="h-7 px-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Due date"
            />
            <button
              type="button"
              onClick={() => setQuickAddDueDate(new Date().toISOString().split('T')[0])}
              className="h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="Set due date to today"
            >
              Today
            </button>
          </div>

          {/* Recurrence Picker */}
          <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1 ${!quickAddDueDate ? 'opacity-40' : ''}`}>
            {(['none', 'daily', 'weekly', 'monthly', 'yearly'] as RecurrenceType[]).map(rec => (
              <button
                key={rec}
                type="button"
                disabled={!quickAddDueDate}
                onClick={() => setQuickAddRecurrence(rec)}
                className={`px-2 h-7 rounded text-xs font-medium transition-colors ${
                  quickAddRecurrence === rec
                    ? rec === 'none'
                      ? 'bg-gray-500 text-white'
                      : 'bg-indigo-500 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${!quickAddDueDate ? 'cursor-not-allowed' : ''}`}
                title={!quickAddDueDate ? 'Set a due date first' : rec === 'none' ? 'No repeat' : `Repeat ${rec}`}
              >
                {rec === 'none' ? '-' : rec.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        )}
      </form>

      {/* Stats Panel */}
      {showStats && <Stats tasks={tasks} />}

      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {completedCount} of {tasks.length} tasks completed
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tasks.filter(t => t.completedDate && new Date(t.completedDate).toDateString() === new Date().toDateString()).length} completed today
            </p>
          </div>
        </div>
        {/* Sort Selector */}
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-1 pl-1 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="default">Default</option>
            <option value="priority">Priority</option>
            <option value="due-date">Due Date</option>
            <option value="created">Newest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="mb-4">
            {(filterPriority !== null || filterCategories.length > 0) ? (
              <svg className="w-12 h-12 mx-auto text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            ) : filter === 'active' ? (
              <svg className="w-12 h-12 mx-auto text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
          </div>
          <p className="text-gray-900 dark:text-white font-medium mb-1">
            {searchQuery && 'No matching tasks'}
            {!searchQuery && (filterPriority !== null || filterCategories.length > 0) && 'No tasks match these filters'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'all' && 'No tasks yet'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'active' && 'All caught up!'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'completed' && 'No completed tasks'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'time-sensitive' && 'No urgent tasks'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'highlighted' && 'No starred tasks'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchQuery && 'Try adjusting your search terms.'}
            {!searchQuery && (filterPriority !== null || filterCategories.length > 0) && 'Try removing some filters to see more tasks.'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'all' && 'Add your first task above to get started.'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'active' && 'You have no pending tasks. Time to relax or add new goals!'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'completed' && 'Complete some tasks to see them here.'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'time-sensitive' && 'Add due dates to tasks to track deadlines.'}
            {!searchQuery && !filterPriority && filterCategories.length === 0 && filter === 'highlighted' && 'Star important tasks to see them here.'}
          </p>
          {(searchQuery || filterPriority !== null || filterCategories.length > 0 || filter !== 'all' || filterYear !== null) && (
            <button
              onClick={() => {
                setFilter('all')
                setSearchQuery('')
                setFilterPriority(null)
                setFilterCategories([])
                setFilterYear(null)
                setFilterMonth(null)
                setSortBy('default')
              }}
              className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    {selectionMode && (
                      <th className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Done
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDeleteTask}
                      onAddSubtask={addSubtask}
                      onToggleSubtask={toggleSubtask}
                      onDeleteSubtask={deleteSubtask}
                      isSelected={selectedTasks.has(task.id)}
                      onSelect={handleSelectTask}
                      selectionMode={selectionMode}
                      onOpenNotes={handleOpenNotesModal}
                      onViewDetail={setDetailTask}
                      onToggleHighlight={handleToggleHighlight}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedTaskId === task.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleDone}
                onDelete={handleDeleteTask}
                isSelected={selectedTasks.has(task.id)}
                onSelect={handleSelectTask}
                selectionMode={selectionMode}
                onToggleHighlight={handleToggleHighlight}
                onOpenNotes={handleOpenNotesModal}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete Task Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Task"
        actions={
          <>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteTask}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          Are you sure you want to delete "<span className="font-medium text-gray-900 dark:text-white">{taskToDeleteName}</span>"?
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          You can undo this action from the notification.
        </p>
      </Modal>

      {/* Clear All Modal */}
      <Modal
        isOpen={clearAllModalOpen}
        onClose={() => setClearAllModalOpen(false)}
        title="Clear All Tasks"
        actions={
          <>
            <button
              onClick={() => setClearAllModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmClearAll}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete All
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-white">all {tasks.length} tasks</span>?
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          You can undo this action from the notification.
        </p>
      </Modal>

      {/* Notes Modal */}
      <Modal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        title={`Notes: ${notesModalTask?.task || ''}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => setNotesModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Format:</span>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = notesModalValue
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `**${selectedText || 'bold'}**` + text.substring(end)
                  setNotesModalValue(newText)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 2, start + 2 + (selectedText || 'bold').length)
                  }, 0)
                }
              }}
              className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded font-bold text-sm"
              title="Bold - wraps text with **"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = notesModalValue
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `*${selectedText || 'italic'}*` + text.substring(end)
                  setNotesModalValue(newText)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 1, start + 1 + (selectedText || 'italic').length)
                  }, 0)
                }
              }}
              className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded italic text-sm"
              title="Italic - wraps text with *"
            >
              I
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1" />
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const text = notesModalValue
                  const lineStart = text.lastIndexOf('\n', start - 1) + 1
                  const newText = text.substring(0, lineStart) + '- ' + text.substring(lineStart)
                  setNotesModalValue(newText)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 2, start + 2)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Bullet list - adds dash at start of line"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const text = notesModalValue
                  const lineStart = text.lastIndexOf('\n', start - 1) + 1
                  const lineNum = text.substring(0, start).split('\n').length
                  const newText = text.substring(0, lineStart) + `${lineNum}. ` + text.substring(lineStart)
                  setNotesModalValue(newText)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 3, start + 3)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Numbered list - adds number at start of line"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = notesModalValue
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `[ ] ${selectedText || 'todo'}` + text.substring(end)
                  setNotesModalValue(newText)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 4, start + 4 + (selectedText || 'todo').length)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Checkbox - adds [ ] for todo items"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotesPreviewMode(!notesPreviewMode)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  notesPreviewMode
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {notesPreviewMode ? 'Edit' : 'Preview'}
              </button>
            </div>
          </div>
          {notesPreviewMode ? (
            <div className="w-full min-h-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm overflow-auto">
              {notesModalValue ? (
                <FormattedNotes text={notesModalValue} />
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">No content to preview</p>
              )}
            </div>
          ) : (
            <textarea
              id="notes-textarea"
              value={notesModalValue}
              onChange={(e) => setNotesModalValue(e.target.value)}
              placeholder="Add notes... (supports **bold**, *italic*, - bullet lists, [ ] checkboxes)"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
            />
          )}
        </div>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        title={detailTask?.task || ''}
        size="lg"
        actions={
          <>
            <button
              onClick={() => setDetailTask(null)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => { if (detailTask) { navigate(`/edit/${detailTask.id}`); setDetailTask(null) } }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
          </>
        }
      >
        {detailTask && (
          <div className="space-y-4">
            {/* Status & Priority */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                detailTask.priority === 1 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : detailTask.priority === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                : detailTask.priority === 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : detailTask.priority === 4 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                Priority {detailTask.priority}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                detailTask.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : detailTask.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {detailTask.status}
              </span>
              {detailTask.done && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Done
                </span>
              )}
              {detailTask.highlighted && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Starred
                </span>
              )}
              {detailTask.recurrence && detailTask.recurrence !== 'none' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  Repeats {detailTask.recurrence}
                </span>
              )}
            </div>

            {/* Categories */}
            {detailTask.categories && detailTask.categories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Categories</p>
                <div className="flex gap-1.5">
                  {detailTask.categories.map(cat => (
                    <span key={cat} className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-gray-900 dark:text-white">{new Date(detailTask.createdAt).toLocaleDateString()}</p>
              </div>
              {detailTask.dueDate && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Due Date</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(detailTask.dueDate + 'T00:00:00').toLocaleDateString()}
                    {!detailTask.done && (
                      <span className={`ml-2 text-xs ${getDueStatusColor(getDueStatus(detailTask.dueDate))} px-1.5 py-0.5 rounded`}>
                        {getDueStatusLabel(getDueStatus(detailTask.dueDate))}
                      </span>
                    )}
                  </p>
                </div>
              )}
              {detailTask.completedDate && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Completed</p>
                  <p className="text-gray-900 dark:text-white">{new Date(detailTask.completedDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Subtasks */}
            {detailTask.subtasks && detailTask.subtasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Subtasks ({detailTask.subtasks.filter(s => s.done).length}/{detailTask.subtasks.length})
                </p>
                <div className="space-y-1.5">
                  {detailTask.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 text-sm">
                      <span className={sub.done ? 'text-green-500' : 'text-gray-400'}>{sub.done ? '☑' : '☐'}</span>
                      <span className={sub.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}>{sub.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {detailTask.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</p>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
                  <FormattedNotes text={detailTask.notes} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// Mobile Card Component
const priorityColors: Record<number, string> = {
  1: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  2: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  4: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  5: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
}

const statusColors: Record<string, string> = {
  'pending': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'completed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return '-'

  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

interface TaskCardProps {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  isSelected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  selectionMode?: boolean
  onToggleHighlight?: (taskId: string) => void
  onOpenNotes?: (task: Task) => void
}

function TaskCard({ task, onToggle, onDelete, isSelected, onSelect, selectionMode, onToggleHighlight, onOpenNotes }: TaskCardProps) {
  const dueStatus = getDueStatus(task.dueDate)
  const subtaskProgress = getSubtaskProgress(task.subtasks)
  const isOverdue = !task.done && dueStatus === 'overdue'
  const isDueToday = !task.done && dueStatus === 'today'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${task.done ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${task.highlighted ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''} ${isOverdue ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500' : ''} ${isDueToday && !isOverdue && !task.highlighted ? 'ring-2 ring-orange-400 bg-orange-50 dark:bg-orange-900/10' : ''}`}>
      <div className="flex items-start gap-3">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(task.id, e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
          />
        ) : (
          <button
            onClick={() => onToggle(task.id)}
            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              task.done
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
            }`}
          >
            {task.done && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p className={`font-medium text-gray-900 dark:text-white ${task.done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
            {task.task}
          </p>

          <button
            onClick={() => onOpenNotes?.(task)}
            className="text-left text-sm mt-2 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full transition-colors"
          >
            {task.notes ? (
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">{task.notes}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-blue-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium">Add notes with formatting</span>
              </span>
            )}
          </button>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
              P{task.priority}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[task.status]}`}>
              {task.status}
            </span>
            {task.dueDate && !task.done && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getDueStatusColor(dueStatus)}`}>
                {getDueStatusLabel(dueStatus)}
              </span>
            )}
            {subtaskProgress.total > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {subtaskProgress.completed}/{subtaskProgress.total} subtasks
              </span>
            )}
            {task.categories && task.categories.length > 0 && task.categories.map(cat => (
              <span
                key={cat}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat]}`}
              >
                {cat}
              </span>
            ))}
          </div>

          {task.completedDate && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Completed {formatRelativeDate(task.completedDate)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => onToggleHighlight?.(task.id)}
            className={`p-1 rounded transition-colors ${
              task.highlighted
                ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
                : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            }`}
            title={task.highlighted ? 'Remove highlight' : 'Highlight task'}
          >
            <svg className="w-4 h-4" fill={task.highlighted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskList
