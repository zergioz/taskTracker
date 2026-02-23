import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import TaskList from './pages/TaskList'
import AddTask from './pages/AddTask'
import Stats from './pages/Stats'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<TaskList />} />
        <Route path="add" element={<AddTask />} />
        <Route path="stats" element={<Stats />} />
      </Route>
    </Routes>
  )
}

export default App
