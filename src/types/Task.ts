export interface Subtask {
  id: string
  title: string
  done: boolean
}

export type TaskCategory = 'OnPrem' | 'Cloud' | 'SIPR' | 'NIPR'

export const TASK_CATEGORIES: TaskCategory[] = ['OnPrem', 'Cloud', 'SIPR', 'NIPR']

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  'OnPrem': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Cloud': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  'SIPR': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'NIPR': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Task {
  id: string
  priority: 1 | 2 | 3 | 4 | 5
  status: 'pending' | 'in-progress' | 'completed'
  task: string
  notes: string
  done: boolean
  completedDate: string | null
  createdAt: string
  dueDate: string | null
  subtasks?: Subtask[]
  highlighted?: boolean
  categories?: TaskCategory[]
  recurrence?: RecurrenceType
  sortOrder?: number
  lastNotified?: string | null
}

export type TaskFormData = Omit<Task, 'id' | 'createdAt' | 'completedDate'>

export type DueStatus = 'overdue' | 'today' | 'soon' | 'upcoming' | 'later' | 'none'

export function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return 'none'

  const now = new Date()
  const due = new Date(dueDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  const diffTime = dueDay.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  if (diffDays <= 7) return 'upcoming'
  return 'later'
}

export function getDueStatusColor(status: DueStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
    case 'today':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
    case 'soon':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700'
    case 'upcoming':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700'
    case 'later':
      return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
  }
}

export function getDueStatusLabel(status: DueStatus): string {
  switch (status) {
    case 'overdue': return 'Overdue'
    case 'today': return 'Due Today'
    case 'soon': return 'Due Soon'
    case 'upcoming': return 'This Week'
    case 'later': return 'Later'
    default: return ''
  }
}

export function getSubtaskProgress(subtasks?: Subtask[]): { completed: number; total: number } {
  if (!subtasks || subtasks.length === 0) return { completed: 0, total: 0 }
  const completed = subtasks.filter(s => s.done).length
  return { completed, total: subtasks.length }
}

export function exportTasksToJSON(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2)
}

export function exportTasksToCSV(tasks: Task[]): string {
  const headers = ['ID', 'Priority', 'Status', 'Task', 'Notes', 'Done', 'Due Date', 'Created At', 'Completed Date', 'Subtasks']
  const rows = tasks.map(task => [
    task.id,
    task.priority,
    task.status,
    `"${task.task.replace(/"/g, '""')}"`,
    `"${task.notes.replace(/"/g, '""')}"`,
    task.done ? 'Yes' : 'No',
    task.dueDate || '',
    task.createdAt,
    task.completedDate || '',
    task.subtasks ? `"${task.subtasks.map(s => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('; ')}"` : ''
  ])

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function getNextDueDate(currentDueDate: string | null, recurrence: RecurrenceType): string | null {
  if (!currentDueDate || recurrence === 'none') return null

  const date = new Date(currentDueDate)

  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }

  return date.toISOString().split('T')[0]
}

export function getRecurrenceLabel(recurrence: RecurrenceType): string {
  switch (recurrence) {
    case 'daily': return 'Daily'
    case 'weekly': return 'Weekly'
    case 'monthly': return 'Monthly'
    case 'yearly': return 'Yearly'
    default: return ''
  }
}
