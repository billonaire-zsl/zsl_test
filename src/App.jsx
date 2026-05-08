import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'todo-reminder-tasks'

const priorityOptions = [
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' },
]

const initialTask = {
  id: 'welcome-task',
  title: '整理今天的关键事项',
  note: '把最重要的一件事设成提醒，先把它完成。',
  priority: 'high',
  reminderAt: '',
  estimatedDoneAt: '',
  estimatedWorkdays: '',
  done: false,
  notified: false,
  createdAt: new Date().toISOString(),
}

const emptyForm = {
  title: '',
  note: '',
  priority: 'medium',
  reminderAt: '',
  estimatedDoneAt: '',
  estimatedWorkdays: '',
}

function readTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : [initialTask]
  } catch {
    return [initialTask]
  }
}

function getTaskStatus(task) {
  if (task.done) return 'done'
  if (!task.reminderAt) return 'open'

  const reminderTime = new Date(task.reminderAt).getTime()
  if (Number.isNaN(reminderTime)) return 'open'

  return reminderTime <= Date.now() ? 'due' : 'scheduled'
}

function formatReminder(value) {
  if (!value) return '未设置提醒'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatEstimate(value) {
  if (!value) return '未设置预计完成时间'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatWorkdays(value) {
  if (!value) return '未设置预计工作日'

  return `预计需要 ${value} 个工作日`
}

function sortTasks(tasks) {
  const priorityWeight = { high: 0, medium: 1, low: 2 }

  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done)

    const aStatus = getTaskStatus(a)
    const bStatus = getTaskStatus(b)
    if (aStatus === 'due' && bStatus !== 'due') return -1
    if (bStatus === 'due' && aStatus !== 'due') return 1

    const aTime = a.reminderAt ? new Date(a.reminderAt).getTime() : Infinity
    const bTime = b.reminderAt ? new Date(b.reminderAt).getTime() : Infinity
    if (aTime !== bTime) return aTime - bTime

    return priorityWeight[a.priority] - priorityWeight[b.priority]
  })
}

function App() {
  const [tasks, setTasks] = useState(readTasks)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState('all')
  const [permission, setPermission] = useState(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()

      setTasks((currentTasks) =>
        currentTasks.map((task) => {
          if (task.done || task.notified || !task.reminderAt) return task

          const reminderTime = new Date(task.reminderAt).getTime()
          if (Number.isNaN(reminderTime) || reminderTime > now) return task

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('待办事项到点了', {
              body: task.title,
            })
          }

          return { ...task, notified: true }
        }),
      )
    }, 15000)

    return () => window.clearInterval(timer)
  }, [])

  const stats = useMemo(() => {
    return tasks.reduce(
      (result, task) => {
        const status = getTaskStatus(task)
        result.total += 1
        if (task.done) result.done += 1
        if (!task.done) result.pending += 1
        if (status === 'due') result.due += 1
        return result
      },
      { total: 0, pending: 0, due: 0, done: 0 },
    )
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const status = getTaskStatus(task)
      if (filter === 'pending') return !task.done
      if (filter === 'due') return status === 'due'
      if (filter === 'done') return task.done
      return true
    })

    return sortTasks(filtered)
  }, [filter, tasks])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function addTask(event) {
    event.preventDefault()

    const title = form.title.trim()
    if (!title) return

    setTasks((currentTasks) => [
      {
        ...form,
        id: crypto.randomUUID(),
        title,
        note: form.note.trim(),
        done: false,
        notified: false,
        createdAt: new Date().toISOString(),
      },
      ...currentTasks,
    ])
    setForm(emptyForm)
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }

    const nextPermission = await Notification.requestPermission()
    setPermission(nextPermission)
  }

  function toggleDone(id) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, notified: task.done ? false : task.notified } : task,
      ),
    )
  }

  function deleteTask(id) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id))
  }

  function clearDone() {
    setTasks((currentTasks) => currentTasks.filter((task) => !task.done))
  }

  return (
    <main className="todo-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Todo Reminder</p>
            <h1>待办事项提醒工具</h1>
            <p className="intro">记录任务、设置到点提醒，把今天的事情稳稳推进。</p>
          </div>
          <button
            className="notify-button"
            type="button"
            onClick={requestNotificationPermission}
            disabled={permission === 'granted' || permission === 'unsupported'}
          >
            {permission === 'granted'
              ? '通知已开启'
              : permission === 'unsupported'
                ? '浏览器不支持通知'
                : '开启提醒通知'}
          </button>
        </header>

        <section className="stat-grid" aria-label="待办统计">
          <article>
            <span>全部</span>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <span>待处理</span>
            <strong>{stats.pending}</strong>
          </article>
          <article className={stats.due > 0 ? 'is-hot' : ''}>
            <span>已到期</span>
            <strong>{stats.due}</strong>
          </article>
          <article>
            <span>已完成</span>
            <strong>{stats.done}</strong>
          </article>
        </section>

        <section className="content-grid">
          <form className="task-form" onSubmit={addTask}>
            <div className="form-heading">
              <h2>新增待办</h2>
              <p>标题必填，提醒时间可选。</p>
            </div>

            <label>
              <span>事项标题</span>
              <input
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="例如：17:00 前提交周报"
              />
            </label>

            <label>
              <span>备注</span>
              <textarea
                value={form.note}
                onChange={(event) => updateForm('note', event.target.value)}
                placeholder="补充地点、材料、链接或下一步动作"
              />
            </label>

            <div className="form-row">
              <label>
                <span>优先级</span>
                <select
                  value={form.priority}
                  onChange={(event) => updateForm('priority', event.target.value)}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>预计需要工作日</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.estimatedWorkdays}
                  onChange={(event) => updateForm('estimatedWorkdays', event.target.value)}
                  placeholder="例如：3"
                />
              </label>

              <label>
                <span>提醒时间</span>
                <input
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={(event) => updateForm('reminderAt', event.target.value)}
                />
              </label>

              <label>
                <span>预计完成时间</span>
                <input
                  type="datetime-local"
                  value={form.estimatedDoneAt}
                  onChange={(event) => updateForm('estimatedDoneAt', event.target.value)}
                />
              </label>
            </div>

            <button className="primary-button" type="submit">
              添加待办
            </button>
          </form>

          <section className="task-panel">
            <div className="panel-toolbar">
              <div className="filter-tabs" aria-label="筛选待办事项">
                {[
                  ['all', '全部'],
                  ['pending', '待处理'],
                  ['due', '已到期'],
                  ['done', '已完成'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={filter === value ? 'active' : ''}
                    type="button"
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="clear-button" type="button" onClick={clearDone}>
                清理已完成
              </button>
            </div>

            <div className="task-list">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => {
                  const status = getTaskStatus(task)
                  const priorityLabel = priorityOptions.find((option) => option.value === task.priority)?.label

                  return (
                    <article className={`task-card ${status}`} key={task.id}>
                      <button
                        className="done-toggle"
                        type="button"
                        onClick={() => toggleDone(task.id)}
                        aria-label={task.done ? '标记为未完成' : '标记为完成'}
                      >
                        {task.done ? '完成' : '待办'}
                      </button>

                      <div className="task-body">
                        <div className="task-title-row">
                          <h3>{task.title}</h3>
                          <span className={`priority ${task.priority}`}>{priorityLabel}</span>
                        </div>
                        {task.note ? <p>{task.note}</p> : null}
                        <div className="task-meta">
                          <span>{formatReminder(task.reminderAt)}</span>
                          <span>预计完成：{formatEstimate(task.estimatedDoneAt)}</span>
                          <span>{formatWorkdays(task.estimatedWorkdays)}</span>
                          <span>
                            {status === 'due'
                              ? '提醒已到'
                              : status === 'scheduled'
                                ? '等待提醒'
                                : status === 'done'
                                  ? '已经完成'
                                  : '普通待办'}
                          </span>
                        </div>
                      </div>

                      <button className="delete-button" type="button" onClick={() => deleteTask(task.id)}>
                        删除
                      </button>
                    </article>
                  )
                })
              ) : (
                <div className="empty-state">
                  <h3>这里暂时没有事项</h3>
                  <p>切换筛选或添加一个新的待办。</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  )
}

export default App
