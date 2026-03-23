import { useState } from 'react'
import { useLocation } from 'wouter'
import { Task, Subtask, getDueStatus, getDueStatusColor, getDueStatusLabel, getSubtaskProgress, CATEGORY_COLORS, getRecurrenceLabel } from '../types/Task'

// Format notes with basic markdown-like syntax
function formatNotesPreview(notes: string): JSX.Element[] {
  if (!notes) return []

  // Get first line for preview
  const firstLine = notes.split('\n')[0]
  const parts: JSX.Element[] = []
  let remaining = firstLine
  let key = 0

  // Simple regex-based formatting
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

    // Check for checkbox [ ] or [x]
    const checkboxMatch = remaining.match(/^\[([ x])\]/)
    if (checkboxMatch) {
      const checked = checkboxMatch[1] === 'x'
      parts.push(
        <span key={key++} className={`inline-flex items-center ${checked ? 'text-green-600' : 'text-gray-400'}`}>
          {checked ? '☑' : '☐'}
        </span>
      )
      remaining = remaining.slice(checkboxMatch[0].length)
      continue
    }

    // Find next special char
    const nextSpecial = remaining.search(/\*|\[/)
    if (nextSpecial === -1) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    } else if (nextSpecial === 0) {
      // No match but starts with special - treat as text
      parts.push(<span key={key++}>{remaining[0]}</span>)
      remaining = remaining.slice(1)
    } else {
      parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>)
      remaining = remaining.slice(nextSpecial)
    }
  }

  return parts
}

interface TaskRowProps {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onAddSubtask?: (taskId: string, title: string) => void
  onToggleSubtask?: (taskId: string, subtaskId: string) => void
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void
  isSelected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  selectionMode?: boolean
  onOpenNotes?: (task: Task) => void
  onViewDetail?: (task: Task) => void
  onToggleHighlight?: (taskId: string) => void
  // Drag and drop
  onDragStart?: (e: React.DragEvent, taskId: string) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, taskId: string) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

const priorityColors: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  2: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  3: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  4: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  5: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
}

const statusColors: Record<string, string> = {
  'pending': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'completed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  isSelected,
  onSelect,
  selectionMode,
  onOpenNotes,
  onViewDetail,
  onToggleHighlight,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging
}: TaskRowProps) {
  const [, navigate] = useLocation()
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const formatRelativeDate = (dateString: string | null): string => {
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

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSubtask.trim() && onAddSubtask) {
      onAddSubtask(task.id, newSubtask.trim())
      setNewSubtask('')
    }
  }

  const subtaskProgress = getSubtaskProgress(task.subtasks)
  const hasSubtasks = subtaskProgress.total > 0

  const isOverdue = !task.done && task.dueDate && getDueStatus(task.dueDate) === 'overdue'
  const isDueToday = !task.done && task.dueDate && getDueStatus(task.dueDate) === 'today'

  return (
    <>
      <tr
        draggable={!selectionMode}
        onDragStart={(e) => onDragStart?.(e, task.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop?.(e, task.id)}
        onDragEnd={onDragEnd}
        className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-grab active:cursor-grabbing ${task.done ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${task.highlighted ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400' : ''} ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500' : ''} ${isDueToday && !isOverdue && !task.highlighted ? 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-400' : ''} ${isDragging ? 'opacity-50 bg-blue-100 dark:bg-blue-900/30' : ''}`}>
        {selectionMode && (
          <td className="px-2 py-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect?.(task.id, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            />
          </td>
        )}
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${priorityColors[task.priority]}`}>
            P{task.priority}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}>
            {task.status}
          </span>
        </td>
        <td className={`px-4 py-3 text-gray-900 dark:text-white ${task.done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onViewDetail?.(task)}
              className="text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
              title="View task details"
            >
              {task.task}
            </button>
            {task.recurrence && task.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" title={`Repeats ${task.recurrence}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {getRecurrenceLabel(task.recurrence)}
              </span>
            )}
            {task.categories && task.categories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {task.categories.map(cat => (
                  <span
                    key={cat}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat]}`}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
            {hasSubtasks && (
              <button
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <svg className={`w-3 h-3 transition-transform ${showSubtasks ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {subtaskProgress.completed}/{subtaskProgress.total}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => onOpenNotes?.(task)}
            className="text-left text-sm max-w-[200px] block px-2 py-1 rounded border border-transparent hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Click to edit notes with formatting"
          >
            {task.notes ? (
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate flex items-center gap-1">
                  {formatNotesPreview(task.notes)}
                  {task.notes.includes('\n') && (
                    <span className="text-xs text-blue-500 ml-1">+{task.notes.split('\n').length - 1} lines</span>
                  )}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium">Add notes</span>
              </span>
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          {task.dueDate && !task.done ? (
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getDueStatusColor(getDueStatus(task.dueDate))}`}>
              {getDueStatusLabel(getDueStatus(task.dueDate))} - {formatDate(task.dueDate)}
            </span>
          ) : task.dueDate ? (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {formatDate(task.dueDate)}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => onToggle(task.id)}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              task.done
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
            }`}
          >
            {task.done && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {formatRelativeDate(task.completedDate)}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => onToggleHighlight?.(task.id)}
              className={`p-1.5 rounded transition-colors ${
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
              onClick={() => navigate(`/edit/${task.id}`)}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
              title="Edit task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
              title="Delete task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* Subtasks Row */}
      {showSubtasks && (
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          <td colSpan={selectionMode ? 10 : 9} className="px-4 py-3">
            <div className="ml-8 space-y-2">
              {/* Existing Subtasks */}
              {task.subtasks?.map(subtask => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={() => onToggleSubtask?.(task.id, subtask.id)}
                  onDelete={() => onDeleteSubtask?.(task.id, subtask.id)}
                />
              ))}

              {/* Add Subtask Form */}
              {onAddSubtask && (
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add subtask..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                  {newSubtask.trim() && (
                    <button
                      type="submit"
                      className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                  )}
                </form>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface SubtaskItemProps {
  subtask: Subtask
  onToggle: () => void
  onDelete: () => void
}

function SubtaskItem({ subtask, onToggle, onDelete }: SubtaskItemProps) {
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          subtask.done
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
        }`}
      >
        {subtask.done && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${subtask.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
        {subtask.title}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-opacity"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default TaskRow
