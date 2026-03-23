import { useState, useMemo } from 'react'
import { Task } from '../types/Task'

interface StatsProps {
  tasks: Task[]
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function Stats({ tasks }: StatsProps) {
  const [showCharts, setShowCharts] = useState(false)
  const [chartView, setChartView] = useState<'monthly' | 'yearly'>('monthly')
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const completed = tasks.filter(t => t.done)
    const active = tasks.filter(t => !t.done)

    const completedToday = completed.filter(t => {
      if (!t.completedDate) return false
      const date = new Date(t.completedDate)
      return date >= today
    })

    const completedThisWeek = completed.filter(t => {
      if (!t.completedDate) return false
      const date = new Date(t.completedDate)
      return date >= weekAgo
    })

    const completedThisMonth = completed.filter(t => {
      if (!t.completedDate) return false
      const date = new Date(t.completedDate)
      return date >= monthAgo
    })

    const createdThisWeek = tasks.filter(t => {
      const date = new Date(t.createdAt)
      return date >= weekAgo
    })

    const overdue = active.filter(t => {
      if (!t.dueDate) return false
      const date = new Date(t.dueDate)
      return date < today
    })

    const completionRate = tasks.length > 0
      ? Math.round((completed.length / tasks.length) * 100)
      : 0

    const avgPriority = active.length > 0
      ? (active.reduce((sum, t) => sum + t.priority, 0) / active.length).toFixed(1)
      : '0'

    // Calculate streak (consecutive days with completed tasks)
    let streak = 0
    let checkDate = new Date(today)
    while (true) {
      const dayStart = new Date(checkDate)
      const dayEnd = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000)
      const hasCompletion = completed.some(t => {
        if (!t.completedDate) return false
        const date = new Date(t.completedDate)
        return date >= dayStart && date < dayEnd
      })
      if (hasCompletion) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return {
      total: tasks.length,
      completed: completed.length,
      active: active.length,
      completedToday: completedToday.length,
      completedThisWeek: completedThisWeek.length,
      completedThisMonth: completedThisMonth.length,
      createdThisWeek: createdThisWeek.length,
      overdue: overdue.length,
      completionRate,
      avgPriority,
      streak
    }
  }, [tasks])

  // Chart data
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    years.add(currentYear)
    tasks.forEach(task => {
      if (task.createdAt) years.add(new Date(task.createdAt).getFullYear())
      if (task.completedDate) years.add(new Date(task.completedDate).getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [tasks, currentYear])

  const monthlyStats = useMemo(() => {
    return Array.from({ length: 12 }, (_, month) => ({
      month,
      created: tasks.filter(t => {
        if (!t.createdAt) return false
        const d = new Date(t.createdAt)
        return d.getFullYear() === selectedYear && d.getMonth() === month
      }).length,
      completed: tasks.filter(t => {
        if (!t.completedDate) return false
        const d = new Date(t.completedDate)
        return d.getFullYear() === selectedYear && d.getMonth() === month
      }).length
    }))
  }, [tasks, selectedYear])

  const yearlyStats = useMemo(() => {
    return availableYears.map(year => ({
      year,
      created: tasks.filter(t => t.createdAt && new Date(t.createdAt).getFullYear() === year).length,
      completed: tasks.filter(t => t.completedDate && new Date(t.completedDate).getFullYear() === year).length
    })).sort((a, b) => a.year - b.year)
  }, [tasks, availableYears])

  const maxMonthly = Math.max(...monthlyStats.map(s => Math.max(s.created, s.completed)), 1)
  const maxYearly = Math.max(...yearlyStats.map(s => Math.max(s.created, s.completed)), 1)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Statistics
        </h3>
        <button
          onClick={() => setShowCharts(!showCharts)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            showCharts
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {showCharts ? 'Hide Charts' : 'Show Charts'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completionRate}%</div>
          <div className="text-xs text-green-700 dark:text-green-300">Completion Rate</div>
          <div className="mt-2 h-1.5 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>

        {/* Today */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.completedToday}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Completed Today</div>
          {stats.streak > 0 && (
            <div className="mt-1 text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
              <span>🔥</span> {stats.streak} day streak
            </div>
          )}
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.completedThisWeek}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">This Week</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            +{stats.createdThisWeek} created
          </div>
        </div>

        {/* Active/Overdue */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.active}</div>
          <div className="text-xs text-amber-700 dark:text-amber-300">Active Tasks</div>
          {stats.overdue > 0 && (
            <div className="mt-1 text-xs text-red-500 dark:text-red-400">
              {stats.overdue} overdue
            </div>
          )}
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{stats.completedThisMonth}</span> completed this month
        </span>
        <span>
          Avg priority: <span className="font-medium text-gray-700 dark:text-gray-300">P{stats.avgPriority}</span>
        </span>
        <span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{stats.total}</span> total tasks
        </span>
      </div>

      {/* Collapsible Charts Section */}
      {showCharts && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartView === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView('yearly')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartView === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Yearly
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Legend */}
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Created</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Completed</span>
                </div>
              </div>

              {chartView === 'monthly' && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Monthly Chart */}
          {chartView === 'monthly' && (
            <div className="space-y-2">
              {monthlyStats.map((stat) => (
                <div key={stat.month} className="flex items-center gap-2">
                  <span className="w-7 text-xs text-gray-500 dark:text-gray-400 text-right">
                    {monthNames[stat.month]}
                  </span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.created / maxMonthly) * 100}%` }}
                        />
                      </div>
                      <span className="w-5 text-[10px] text-gray-500 dark:text-gray-400 text-right">{stat.created}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.completed / maxMonthly) * 100}%` }}
                        />
                      </div>
                      <span className="w-5 text-[10px] text-gray-500 dark:text-gray-400 text-right">{stat.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Yearly Chart */}
          {chartView === 'yearly' && (
            <div className="space-y-2">
              {yearlyStats.map((stat) => (
                <div key={stat.year} className="flex items-center gap-2">
                  <span className="w-10 text-xs text-gray-500 dark:text-gray-400 text-right">
                    {stat.year}
                  </span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.created / maxYearly) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-gray-500 dark:text-gray-400 text-right">{stat.created}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded transition-all duration-300"
                          style={{ width: `${(stat.completed / maxYearly) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-gray-500 dark:text-gray-400 text-right">{stat.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completion Progress Bar */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="relative h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                  {stats.completed} of {stats.total} completed ({stats.completionRate}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}