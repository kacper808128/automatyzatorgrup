import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { Download } from 'lucide-react'

function Logs() {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Connect to WebSocket
    const socket = io('http://localhost:3000')

    socket.on('connect', () => {
      setConnected(true)
      console.log('Connected to WebSocket')
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from WebSocket')
    })

    socket.on('log', (log) => {
      setLogs((prev) => [...prev, log].slice(-100)) // Keep last 100 logs
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const downloadLogs = () => {
    const content = logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Live Logs</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={downloadLogs}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            <Download className="w-5 h-5 mr-2" />
            Download
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">Waiting for logs...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`py-1 ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warning' ? 'text-yellow-400' :
                log.level === 'success' ? 'text-green-400' :
                'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                <span className="text-gray-400">[{log.level}]</span>{' '}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Logs
