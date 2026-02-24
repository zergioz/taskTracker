import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { Task, TaskFormData } from '../types/Task'

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', [])

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Sort incomplete tasks before completed
      if (a.done !== b.done) {
        return a.done ? 1 : -1
      }
      // Then by priority (lower number = higher priority)
      return a.priority - b.priority
    })
  }, [tasks])

  const addTask = useCallback((data: TaskFormData) => {
    const newTask: Task = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completedDate: data.done ? new Date().toISOString() : null
    }
    setTasks(prev => [...prev, newTask])
  }, [setTasks])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task

      const updatedTask = { ...task, ...updates }

      // Handle completion date
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

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id))
  }, [setTasks])

  const toggleDone = useCallback((id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task

      const done = !task.done
      return {
        ...task,
        done,
        completedDate: done ? new Date().toISOString() : null,
        status: done ? 'completed' : 'pending'
      }
    }))
  }, [setTasks])

  return {
    tasks: sortedTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleDone
  }
}
