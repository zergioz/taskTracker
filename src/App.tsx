import { Switch, Route } from 'wouter'
import Layout from './components/Layout'
import TaskList from './pages/TaskList'
import AddTask from './pages/AddTask'
import Stats from './pages/Stats'

function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={TaskList} />
        <Route path="/add" component={AddTask} />
        <Route path="/edit/:id" component={AddTask} />
        <Route path="/stats" component={Stats} />
      </Switch>
    </Layout>
  )
}

export default App
