import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTasks } from '../context/TaskContext'

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const fullMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface MonthData {
  month: number
  year: number
  created: number
  completed: number
}

function Stats() {
  const { tasks } = useTasks()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')

  // Get available years from tasks
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    years.add(currentYear)
    tasks.forEach(task => {
      if (task.createdAt) {
        years.add(new Date(task.createdAt).getFullYear())
      }
      if (task.completedDate) {
        years.add(new Date(task.completedDate).getFullYear())
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [tasks, currentYear])

  // Calculate monthly stats for selected year
  const monthlyStats = useMemo(() => {
    const stats: MonthData[] = []

    for (let month = 0; month < 12; month++) {
      const created = tasks.filter(task => {
        if (!task.createdAt) return false
        const date = new Date(task.createdAt)
        return date.getFullYear() === selectedYear && date.getMonth() === month
      }).length

      const completed = tasks.filter(task => {
        if (!task.completedDate) return false
        const date = new Date(task.completedDate)
        return date.getFullYear() === selectedYear && date.getMonth() === month
      }).length

      stats.push({ month, year: selectedYear, created, completed })
    }

    return stats
  }, [tasks, selectedYear])

  // Calculate yearly stats
  const yearlyStats = useMemo(() => {
    const stats: { year: number; created: number; completed: number }[] = []

    availableYears.forEach(year => {
      const created = tasks.filter(task => {
        if (!task.createdAt) return false
        return new Date(task.createdAt).getFullYear() === year
      }).length

      const completed = tasks.filter(task => {
        if (!task.completedDate) return false
        return new Date(task.completedDate).getFullYear() === year
      }).length

      stats.push({ year, created, completed })
    })

    return stats.sort((a, b) => a.year - b.year)
  }, [tasks, availableYears])

  // Get max values for scaling
  const maxMonthly = Math.max(
    ...monthlyStats.map(s => Math.max(s.created, s.completed)),
    1
  )
  const maxYearly = Math.max(
    ...yearlyStats.map(s => Math.max(s.created, s.completed)),
    1
  )

  // Summary stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const activeTasks = totalTasks - completedTasks
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // This year stats
  const thisYearCreated = tasks.filter(t =>
    t.createdAt && new Date(t.createdAt).getFullYear() === currentYear
  ).length
  const thisYearCompleted = tasks.filter(t =>
    t.completedDate && new Date(t.completedDate).getFullYear() === currentYear
  ).length

  // This month stats
  const currentMonth = new Date().getMonth()
  const thisMonthCreated = tasks.filter(t => {
    if (!t.createdAt) return false
    const d = new Date(t.createdAt)
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth
  }).length
  const thisMonthCompleted = tasks.filter(t => {
    if (!t.completedDate) return false
    const d = new Date(t.completedDate)
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth
  }).length

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No data yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Add some tasks to see statistics</p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
        >
          Go to Tasks
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Statistics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track your task progress over time
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tasks
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalTasks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTasks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeTasks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{completionRate}%</p>
        </div>
      </div>

      {/* This Period Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            This Month ({fullMonthNames[currentMonth]})
          </h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{thisMonthCreated}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{thisMonthCompleted}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            This Year ({currentYear})
          </h3>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{thisYearCreated}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{thisYearCompleted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Yearly
            </button>
          </div>

          {viewMode === 'monthly' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Tasks Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Tasks Completed</span>
          </div>
        </div>

        {/* Monthly Chart */}
        {viewMode === 'monthly' && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tasks by Month - {selectedYear}
            </h3>
            <div className="space-y-3">
              {monthlyStats.map((stat) => (
                <div key={stat.month} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-gray-500 dark:text-gray-400 text-right">
                    {monthNames[stat.month]}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    {/* Created bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.created / maxMonthly) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {stat.created}
                      </span>
                    </div>
                    {/* Completed bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.completed / maxMonthly) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {stat.completed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yearly Chart */}
        {viewMode === 'yearly' && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tasks by Year
            </h3>
            <div className="space-y-3">
              {yearlyStats.map((stat) => (
                <div key={stat.year} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-gray-500 dark:text-gray-400 text-right">
                    {stat.year}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    {/* Created bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.created / maxYearly) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {stat.created}
                      </span>
                    </div>
                    {/* Completed bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.completed / maxYearly) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {stat.completed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Completion Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Overall Completion Progress
        </h3>
        <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {completedTasks} of {totalTasks} tasks completed ({completionRate}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Stats
