import { useEffect, useCallback, useRef } from 'react'
import { Task, getDueStatus } from '../types/Task'

export function useNotifications(tasks: Task[], updateTask: (id: string, updates: Partial<Task>) => void) {
  const notifiedToday = useRef<Set<string>>(new Set())

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }, [])

  const sendNotification = useCallback((title: string, body: string, taskId?: string) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: taskId || 'task-tracker',
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      return notification
    }
  }, [])

  const checkDueTasks = useCallback(() => {
    const today = new Date().toDateString()

    tasks.forEach(task => {
      if (task.done || !task.dueDate) return

      const status = getDueStatus(task.dueDate)
      const notificationKey = `${task.id}-${today}`

      // Skip if already notified today
      if (notifiedToday.current.has(notificationKey)) return

      // Check if we should notify
      if (status === 'overdue') {
        sendNotification(
          'Task Overdue!',
          `"${task.task}" is past its due date`,
          task.id
        )
        notifiedToday.current.add(notificationKey)
        updateTask(task.id, { lastNotified: new Date().toISOString() })
      } else if (status === 'today') {
        sendNotification(
          'Task Due Today',
          `"${task.task}" is due today`,
          task.id
        )
        notifiedToday.current.add(notificationKey)
        updateTask(task.id, { lastNotified: new Date().toISOString() })
      } else if (status === 'soon' && task.priority <= 2) {
        // Only notify for high priority tasks due soon
        sendNotification(
          'High Priority Task Due Soon',
          `"${task.task}" is due within 3 days`,
          task.id
        )
        notifiedToday.current.add(notificationKey)
        updateTask(task.id, { lastNotified: new Date().toISOString() })
      }
    })
  }, [tasks, sendNotification, updateTask])

  // Request permission on mount
  useEffect(() => {
    requestPermission()
  }, [requestPermission])

  // Check for due tasks periodically
  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(checkDueTasks, 2000)

    // Check every 30 minutes
    const interval = setInterval(checkDueTasks, 30 * 60 * 1000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [checkDueTasks])

  // Reset notified set at midnight
  useEffect(() => {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const msUntilMidnight = tomorrow.getTime() - now.getTime()

    const timeout = setTimeout(() => {
      notifiedToday.current.clear()
    }, msUntilMidnight)

    return () => clearTimeout(timeout)
  }, [])

  return {
    requestPermission,
    sendNotification,
    checkDueTasks,
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  }
}