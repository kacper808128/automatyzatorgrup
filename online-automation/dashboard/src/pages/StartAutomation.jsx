import { useState, useEffect } from 'react'
import { PlayCircle } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

function StartAutomation() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [posts, setPosts] = useState('')
  const [validateOnline, setValidateOnline] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/accounts')
      setAccounts(response.data)
    } catch (error) {
      toast.error('Failed to fetch accounts')
    }
  }

  const toggleAccount = (accountId) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one account')
      return
    }

    if (!posts.trim()) {
      toast.error('Please enter posts in CSV format')
      return
    }

    setLoading(true)

    try {
      // Parse CSV
      const lines = posts.trim().split('\n')
      const parsedPosts = lines.map(line => {
        const [groupLink, postCopy, groupName] = line.split(',').map(s => s.trim())
        return { groupLink, postCopy, groupName: groupName || '' }
      })

      const response = await axios.post('/api/posts/start', {
        posts: parsedPosts,
        accountIds: selectedAccounts,
        validateCookiesOnline: validateOnline
      })

      toast.success('Automation started successfully!')
      console.log('Session ID:', response.data.sessionId)

      // Reset form
      setPosts('')
      setSelectedAccounts([])
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start automation')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Start Automation</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Select Accounts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Accounts</h2>
          <div className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-gray-500">No accounts available. Please add accounts first.</p>
            ) : (
              accounts.map((account) => (
                <label key={account.id} className="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div className="ml-3 flex-1">
                    <p className="font-medium text-gray-900">{account.name}</p>
                    <p className="text-sm text-gray-500">{account.email}</p>
                  </div>
                  <span className={`
                    px-2 py-1 text-xs font-semibold rounded-full
                    ${account.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                  `}>
                    {account.status}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* CSV Input */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Posts (CSV Format)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Format: <code className="bg-gray-100 px-2 py-1 rounded">groupUrl, message, groupName</code>
          </p>
          <textarea
            value={posts}
            onChange={(e) => setPosts(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            placeholder="https://facebook.com/groups/123, Hello World!, Group Name&#10;https://facebook.com/groups/456, Test post, Another Group"
          />
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={validateOnline}
              onChange={(e) => setValidateOnline(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-gray-700">
              Validate cookies online (slower but more accurate)
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              Starting...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 mr-2" />
              Start Automation
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default StartAutomation
