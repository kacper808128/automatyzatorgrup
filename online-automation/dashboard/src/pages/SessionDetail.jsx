import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

function SessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionDetails()
  }, [id])

  const fetchSessionDetails = async () => {
    try {
      const [sessionRes, logsRes] = await Promise.all([
        axios.get(`/api/dashboard/overview`), // Fetch all sessions and filter
        axios.get(`/api/logs/${id}`)
      ])

      const foundSession = sessionRes.data.sessions?.find(s => s.id === id)
      setSession(foundSession)
      setLogs(logsRes.data.logs || [])
    } catch (error) {
      console.error('Failed to fetch session details:', error)
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

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Session not found</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Session {id}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{session.status}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Posts</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{session.stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Successful</p>
          <p className="text-lg font-semibold text-green-600 mt-1">{session.stats?.successful || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Failed</p>
          <p className="text-lg font-semibold text-red-600 mt-1">{session.stats?.failed || 0}</p>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Logs</h2>
        </div>
        <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs available</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`py-1 ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warning' ? 'text-yellow-400' :
                log.level === 'success' ? 'text-green-400' :
                'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
