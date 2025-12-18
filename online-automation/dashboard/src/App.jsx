import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import Logs from './pages/Logs'
import StartAutomation from './pages/StartAutomation'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/start" element={<StartAutomation />} />
      </Routes>
    </Layout>
  )
}

export default App
