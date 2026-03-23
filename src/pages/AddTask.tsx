import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useParams } from 'wouter'
import { useTasks } from '../context/TaskContext'
import { useToast } from '../context/ToastContext'
import { TaskFormData, TASK_CATEGORIES, CATEGORY_COLORS, RecurrenceType } from '../types/Task'

// Format inline text (bold, italic)
function formatInlineText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }
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

// Render formatted notes
function FormattedNotes({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, lineIndex) => {
        if (line.startsWith('- ')) {
          return (
            <div key={lineIndex} className="flex items-start gap-2 ml-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>{formatInlineText(line.slice(2))}</span>
            </div>
          )
        }
        const numberedMatch = line.match(/^(\d+)\.\s/)
        if (numberedMatch) {
          return (
            <div key={lineIndex} className="flex items-start gap-2 ml-2">
              <span className="text-gray-400 min-w-[1.5rem]">{numberedMatch[1]}.</span>
              <span>{formatInlineText(line.slice(numberedMatch[0].length))}</span>
            </div>
          )
        }
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
        if (!line.trim()) return <div key={lineIndex} className="h-2" />
        return <p key={lineIndex}>{formatInlineText(line)}</p>
      })}
    </div>
  )
}

function AddTask() {
  const [, navigate] = useLocation()
  const params = useParams<{ id?: string }>()
  const editId = params?.id
  const { addTask, updateTask, tasks } = useTasks()
  const { showToast } = useToast()

  const existingTask = editId ? tasks.find(t => t.id === editId) : null
  const isEditMode = !!editId

  const [formData, setFormData] = useState<TaskFormData>({
    priority: 3,
    status: 'pending',
    task: '',
    notes: '',
    done: false,
    dueDate: null,
    categories: []
  })

  // Populate form when editing an existing task
  useEffect(() => {
    if (existingTask) {
      setFormData({
        priority: existingTask.priority,
        status: existingTask.status,
        task: existingTask.task,
        notes: existingTask.notes,
        done: existingTask.done,
        dueDate: existingTask.dueDate,
        categories: existingTask.categories || [],
        recurrence: existingTask.recurrence || 'none'
      })
    } else if (editId) {
      // Task not found, redirect
      navigate('/')
    }
  }, [editId])

  const [errors, setErrors] = useState<{ task?: string }>({})
  const [touched, setTouched] = useState<{ task?: boolean }>({})
  const [notesPreviewMode, setNotesPreviewMode] = useState(false)
  const formInitialized = useRef(false)
  const isDirty = useRef(false)

  // Mark form as dirty on any change after initialization
  const setFormDataTracked = useCallback((updater: React.SetStateAction<TaskFormData>) => {
    if (formInitialized.current) isDirty.current = true
    setFormData(updater)
  }, [])

  // Mark form as initialized after first render / edit population
  useEffect(() => {
    const timer = setTimeout(() => { formInitialized.current = true }, 100)
    return () => clearTimeout(timer)
  }, [editId])

  const confirmLeave = useCallback(() => {
    if (!isDirty.current) return true
    return window.confirm('You have unsaved changes. Are you sure you want to leave?')
  }, [])

  // Warn on browser/tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!confirmLeave()) return
        navigate('/')
      }
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit(new Event('submit') as unknown as React.FormEvent)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, formData])

  const validate = (): boolean => {
    const newErrors: { task?: string } = {}

    if (!formData.task.trim()) {
      newErrors.task = 'Task description is required'
    } else if (formData.task.trim().length < 2) {
      newErrors.task = 'Task must be at least 2 characters'
    } else if (formData.task.trim().length > 200) {
      newErrors.task = 'Task must be less than 200 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ task: true })

    if (!validate()) return

    isDirty.current = false
    if (isEditMode && editId) {
      updateTask(editId, formData)
      showToast('Task updated successfully', 'success')
    } else {
      addTask(formData)
      showToast('Task created successfully', 'success')
    }
    navigate('/')
  }

  const handleBlur = (field: 'task') => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validate()
  }

  const handleTaskChange = (value: string) => {
    setFormDataTracked(prev => ({ ...prev, task: value }))
    if (touched.task) {
      // Re-validate on change if field was touched
      const newErrors: { task?: string } = {}
      if (!value.trim()) {
        newErrors.task = 'Task description is required'
      } else if (value.trim().length < 2) {
        newErrors.task = 'Task must be at least 2 characters'
      } else if (value.trim().length > 200) {
        newErrors.task = 'Task must be less than 200 characters'
      }
      setErrors(newErrors)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEditMode ? 'Edit Task' : 'Add New Task'}</h1>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to cancel
        </span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="task" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Task <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="task"
            value={formData.task}
            onChange={(e) => handleTaskChange(e.target.value)}
            onBlur={() => handleBlur('task')}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
              errors.task && touched.task
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="Enter task description"
            autoFocus
          />
          {errors.task && touched.task && (
            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors.task}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {formData.task.length}/200 characters
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormDataTracked(prev => ({ ...prev, priority: Number(e.target.value) as 1|2|3|4|5 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1 - Highest</option>
              <option value={2}>2 - High</option>
              <option value={3}>3 - Medium</option>
              <option value={4}>4 - Low</option>
              <option value={5}>5 - Lowest</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormDataTracked(prev => ({ ...prev, status: e.target.value as TaskFormData['status'] }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Due Date
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate || ''}
              onChange={(e) => {
                const val = e.target.value || null
                setFormDataTracked(prev => ({
                  ...prev,
                  dueDate: val,
                  ...(!val ? { recurrence: 'none' as RecurrenceType } : {})
                }))
              }}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setFormDataTracked(prev => ({ ...prev, dueDate: new Date().toISOString().split('T')[0] }))}
              className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Today
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tasks with due dates appear in the Urgent tab
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recurrence
          </label>
          <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1 w-fit ${!formData.dueDate ? 'opacity-40' : ''}`}>
            {(['none', 'daily', 'weekly', 'monthly', 'yearly'] as RecurrenceType[]).map(rec => (
              <button
                key={rec}
                type="button"
                disabled={!formData.dueDate}
                onClick={() => setFormDataTracked(prev => ({ ...prev, recurrence: rec }))}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  (formData.recurrence || 'none') === rec
                    ? rec === 'none'
                      ? 'bg-gray-500 text-white'
                      : 'bg-indigo-500 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${!formData.dueDate ? 'cursor-not-allowed' : ''}`}
                title={!formData.dueDate ? 'Set a due date first' : rec === 'none' ? 'No repeat' : `Repeat ${rec}`}
              >
                {rec === 'none' ? 'None' : rec.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.dueDate ? 'D = Daily, W = Weekly, M = Monthly, Y = Yearly' : 'Set a due date to enable recurrence'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories
          </label>
          <div className="flex flex-wrap gap-2">
            {TASK_CATEGORIES.map(category => {
              const isSelected = formData.categories?.includes(category)
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setFormDataTracked(prev => ({
                      ...prev,
                      categories: isSelected
                        ? (prev.categories || []).filter(c => c !== category)
                        : [...(prev.categories || []), category]
                    }))
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? `${CATEGORY_COLORS[category]} ring-2 ring-offset-1 ring-current`
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {isSelected && (
                    <span className="mr-1">✓</span>
                  )}
                  {category}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Select one or more categories
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>

          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-t-lg border border-b-0 border-gray-300 dark:border-gray-600">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Format:</span>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = formData.notes
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `**${selectedText || 'bold'}**` + text.substring(end)
                  setFormDataTracked(prev => ({ ...prev, notes: newText }))
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
                const textarea = document.getElementById('notes') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = formData.notes
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `*${selectedText || 'italic'}*` + text.substring(end)
                  setFormDataTracked(prev => ({ ...prev, notes: newText }))
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
                const textarea = document.getElementById('notes') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const text = formData.notes
                  const lineStart = text.lastIndexOf('\n', start - 1) + 1
                  const newText = text.substring(0, lineStart) + '- ' + text.substring(lineStart)
                  setFormDataTracked(prev => ({ ...prev, notes: newText }))
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 2, start + 2)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Bullet list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const text = formData.notes
                  const lineStart = text.lastIndexOf('\n', start - 1) + 1
                  const lineNum = text.substring(0, start).split('\n').length
                  const newText = text.substring(0, lineStart) + `${lineNum}. ` + text.substring(lineStart)
                  setFormDataTracked(prev => ({ ...prev, notes: newText }))
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 3, start + 3)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Numbered list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.getElementById('notes') as HTMLTextAreaElement
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = formData.notes
                  const selectedText = text.substring(start, end)
                  const newText = text.substring(0, start) + `[ ] ${selectedText || 'todo'}` + text.substring(end)
                  setFormDataTracked(prev => ({ ...prev, notes: newText }))
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(start + 4, start + 4 + (selectedText || 'todo').length)
                  }, 0)
                }
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded"
              title="Checkbox"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setNotesPreviewMode(!notesPreviewMode)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  notesPreviewMode
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {notesPreviewMode ? 'Edit' : 'Preview'}
              </button>
            </div>
          </div>

          {notesPreviewMode ? (
            <div className="w-full min-h-[80px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-b-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
              {formData.notes ? (
                <FormattedNotes text={formData.notes} />
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">No content to preview</p>
              )}
            </div>
          ) : (
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormDataTracked(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-b-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Add notes... (supports **bold**, *italic*, - bullet lists, [ ] checkboxes)"
            />
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use **bold**, *italic*, - for lists, [ ] for checkboxes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="done"
            checked={formData.done}
            onChange={(e) => setFormDataTracked(prev => ({ ...prev, done: e.target.checked }))}
            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
          />
          <label htmlFor="done" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mark as done
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium inline-flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isEditMode ? 'Save Changes' : 'Add Task'}
            <span className="text-xs opacity-75">(Ctrl+Enter)</span>
          </button>
          <button
            type="button"
            onClick={() => { if (confirmLeave()) navigate('/') }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddTask
