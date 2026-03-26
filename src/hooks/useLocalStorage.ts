import { useState, useEffect, useRef } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const hydrated = useRef(false)

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return initialValue
    }
  })

  // Hydrate from electron-store on mount (source of truth)
  useEffect(() => {
    if (!window.electronStore) return
    window.electronStore.get(key).then((value) => {
      if (value !== undefined && value !== null) {
        setStoredValue(value as T)
      }
      hydrated.current = true
    }).catch(() => {
      hydrated.current = true
    })
  }, [key])

  // Persist changes to both localStorage (sync cache) and electron-store
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }

    if (window.electronStore && hydrated.current) {
      window.electronStore.set(key, storedValue).catch((error) => {
        console.error('Error writing to electron-store:', error)
      })
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}
