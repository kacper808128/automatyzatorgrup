import { useState, useEffect } from 'react'
import { Users, PlayCircle, CheckCircle, XCircle } from 'lucide-react'
import axios from 'axios'

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/dashboard/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Accounts"
          value={stats?.accounts?.total || 0}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="Active Sessions"
          value={stats?.sessions?.active || 0}
          icon={PlayCircle}
          color="bg-green-500"
        />
        <StatCard
          title="Posts Today"
          value={stats?.posts?.today || 0}
          icon={CheckCircle}
          color="bg-purple-500"
        />
        <StatCard
          title="Failed Posts"
          value={stats?.posts?.failed || 0}
          icon={XCircle}
          color="bg-red-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          {stats?.recentSessions && stats.recentSessions.length > 0 ? (
            <div className="space-y-4">
              {stats.recentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">Session {session.id}</p>
                    <p className="text-sm text-gray-500">
                      {session.stats?.successful || 0} posts / {session.stats?.total || 0} total
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`
                      px-3 py-1 rounded-full text-xs font-medium
                      ${session.status === 'completed' ? 'bg-green-100 text-green-800' :
                        session.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        session.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'}
                    `}>
                      {session.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(session.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
