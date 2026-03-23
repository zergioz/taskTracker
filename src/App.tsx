import { Switch, Route } from 'wouter'
import Layout from './components/Layout'
import TaskList from './pages/TaskList'
import AddTask from './pages/AddTask'

function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={TaskList} />
        <Route path="/add" component={AddTask} />
        <Route path="/edit/:id" component={AddTask} />
      </Switch>
    </Layout>
  )
}

export default App
