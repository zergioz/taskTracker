import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { Task, TaskFormData, Subtask, getNextDueDate } from '../types/Task'

interface TaskContextType {
  tasks: Task[]
  addTask: (data: TaskFormData) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => Task | undefined
  deleteTasks: (ids: string[]) => Task[]
  restoreTask: (task: Task) => void
  restoreTasks: (tasks: Task[]) => void
  toggleDone: (id: string) => void
  bulkUpdateTasks: (ids: string[], updates: Partial<Task>) => void
  addSubtask: (taskId: string, title: string) => void
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  importTasks: (data: string) => number
  clearAllTasks: () => Task[]
  reorderTasks: (taskId: string, newIndex: number) => void
}

const TaskContext = createContext<TaskContextType | null>(null)

function mapStatus(status: string): Task['status'] {
  const lower = status.toLowerCase().trim()
  if (lower.includes('progress')) return 'in-progress'
  if (lower.includes('complete') || lower.includes('done')) return 'completed'
  return 'pending'
}

function mapPriority(priority: string): 1 | 2 | 3 | 4 | 5 {
  const num = parseInt(priority, 10)
  if (isNaN(num) || num < 1) return 1
  if (num > 5) return 5
  return num as 1 | 2 | 3 | 4 | 5
}

// Migrate old tasks that don't have dueDate, subtasks, highlighted, categories, recurrence, or sortOrder
function migrateTask(task: Partial<Task> & { id: string }, index: number): Task {
  return {
    ...task,
    dueDate: task.dueDate ?? null,
    subtasks: task.subtasks ?? [],
    highlighted: task.highlighted ?? false,
    categories: task.categories ?? [],
    recurrence: task.recurrence ?? 'none',
    sortOrder: task.sortOrder ?? index,
    lastNotified: task.lastNotified ?? null
  } as Task
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', [])

  // Migrate tasks on load
  const migratedTasks = useMemo(() => {
    return tasks.map((task, index) => migrateTask(task, index))
  }, [tasks])

  const sortedTasks = useMemo(() => {
    return [...migratedTasks].sort((a, b) => {
      if (a.done !== b.done) {
        return a.done ? 1 : -1
      }
      return a.priority - b.priority
    })
  }, [migratedTasks])

  const addTask = useCallback((data: TaskFormData) => {
    const newTask: Task = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completedDate: data.done ? new Date().toISOString() : null,
      subtasks: data.subtasks || []
    }
    setTasks(prev => [...prev, newTask])
  }, [setTasks])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task

      const updatedTask = { ...task, ...updates }

      if (updates.done === true && !task.done) {
        updatedTask.completedDate = new Date().toISOString()
        updatedTask.status = 'completed'
      } else if (updates.done === false && task.done) {
        updatedTask.completedDate = null
        if (updatedTask.status === 'completed') {
          updatedTask.status = 'pending'
        }
      }

      return updatedTask
    }))
  }, [setTasks])

  const deleteTask = useCallback((id: string): Task | undefined => {
    let deletedTask: Task | undefined
    setTasks(prev => {
      deletedTask = prev.find(task => task.id === id)
      return prev.filter(task => task.id !== id)
    })
    return deletedTask
  }, [setTasks])

  const deleteTasks = useCallback((ids: string[]): Task[] => {
    let deletedTasks: Task[] = []
    setTasks(prev => {
      deletedTasks = prev.filter(task => ids.includes(task.id))
      return prev.filter(task => !ids.includes(task.id))
    })
    return deletedTasks
  }, [setTasks])

  const restoreTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task])
  }, [setTasks])

  const restoreTasks = useCallback((tasksToRestore: Task[]) => {
    setTasks(prev => [...prev, ...tasksToRestore])
  }, [setTasks])

  const toggleDone = useCallback((id: string) => {
    setTasks(prev => {
      const taskToToggle = prev.find(t => t.id === id)
      if (!taskToToggle) return prev

      const done = !taskToToggle.done

      // If completing a recurring task, create a new instance
      if (done && taskToToggle.recurrence && taskToToggle.recurrence !== 'none' && taskToToggle.dueDate) {
        const nextDueDate = getNextDueDate(taskToToggle.dueDate, taskToToggle.recurrence)
        const newTask: Task = {
          ...taskToToggle,
          id: crypto.randomUUID(),
          done: false,
          completedDate: null,
          status: 'pending',
          dueDate: nextDueDate,
          createdAt: new Date().toISOString(),
          subtasks: taskToToggle.subtasks?.map(s => ({ ...s, done: false })) || []
        }

        return prev.map(task => {
          if (task.id !== id) return task
          return {
            ...task,
            done: true,
            completedDate: new Date().toISOString(),
            status: 'completed' as const
          }
        }).concat(newTask)
      }

      return prev.map(task => {
        if (task.id !== id) return task
        return {
          ...task,
          done,
          completedDate: done ? new Date().toISOString() : null,
          status: done ? 'completed' : 'pending'
        }
      })
    })
  }, [setTasks])

  const bulkUpdateTasks = useCallback((ids: string[], updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => {
      if (!ids.includes(task.id)) return task

      const updatedTask = { ...task, ...updates }

      if (updates.done === true && !task.done) {
        updatedTask.completedDate = new Date().toISOString()
        updatedTask.status = 'completed'
      } else if (updates.done === false && task.done) {
        updatedTask.completedDate = null
        if (updatedTask.status === 'completed') {
          updatedTask.status = 'pending'
        }
      }

      return updatedTask
    }))
  }, [setTasks])

  const addSubtask = useCallback((taskId: string, title: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task
      const newSubtask: Subtask = {
        id: crypto.randomUUID(),
        title,
        done: false
      }
      return {
        ...task,
        subtasks: [...(task.subtasks || []), newSubtask]
      }
    }))
  }, [setTasks])

  const updateSubtask = useCallback((taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task
      return {
        ...task,
        subtasks: (task.subtasks || []).map(subtask =>
          subtask.id === subtaskId ? { ...subtask, ...updates } : subtask
        )
      }
    }))
  }, [setTasks])

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task
      return {
        ...task,
        subtasks: (task.subtasks || []).filter(subtask => subtask.id !== subtaskId)
      }
    }))
  }, [setTasks])

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task
      return {
        ...task,
        subtasks: (task.subtasks || []).map(subtask =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
        )
      }
    }))
  }, [setTasks])

  const importTasks = useCallback((data: string): number => {
    const lines = data.trim().split('\n')
    const newTasks: Task[] = []

    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 3) continue

      const [priorityStr, statusStr, taskName, notes = '', doneStr = ''] = parts
      const done = doneStr.toLowerCase().trim() === 'yes'

      const task: Task = {
        id: crypto.randomUUID(),
        priority: mapPriority(priorityStr),
        status: done ? 'completed' : mapStatus(statusStr),
        task: taskName.trim(),
        notes: notes.trim(),
        done,
        completedDate: done ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        dueDate: null,
        subtasks: []
      }

      if (task.task) {
        newTasks.push(task)
      }
    }

    setTasks(prev => [...prev, ...newTasks])
    return newTasks.length
  }, [setTasks])

  const clearAllTasks = useCallback((): Task[] => {
    let deletedTasks: Task[] = []
    setTasks(prev => {
      deletedTasks = [...prev]
      return []
    })
    return deletedTasks
  }, [setTasks])

  const reorderTasks = useCallback((taskId: string, newIndex: number) => {
    setTasks(prev => {
      const taskIndex = prev.findIndex(t => t.id === taskId)
      if (taskIndex === -1) return prev

      const newTasks = [...prev]
      const [removed] = newTasks.splice(taskIndex, 1)
      newTasks.splice(newIndex, 0, removed)

      // Update sortOrder for all tasks
      return newTasks.map((task, index) => ({
        ...task,
        sortOrder: index
      }))
    })
  }, [setTasks])

  return (
    <TaskContext.Provider value={{
      tasks: sortedTasks,
      addTask,
      updateTask,
      deleteTask,
      deleteTasks,
      restoreTask,
      restoreTasks,
      toggleDone,
      bulkUpdateTasks,
      addSubtask,
      updateSubtask,
      deleteSubtask,
      toggleSubtask,
      importTasks,
      clearAllTasks,
      reorderTasks
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider')
  }
  return context
}
