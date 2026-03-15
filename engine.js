const Engine = {}

Engine.state = {
  projects: [],
  tasks: [],
  history: [],
  energyProfile: {},
  preferences: {
    season: Config.defaults.season,
    mode: Config.defaults.mode,
    focus: Config.defaults.focus,
    energyPeak: Config.defaults.energyPeak,
    focusDuration: Config.defaults.focusDuration,
    weekType: Config.defaults.weekType
  },
  scheduledBlocks: []
}

Engine.makeId = function () {
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

Engine.createProject = function({
  name,
  deadline,
  fragments = Config.projectDefaults.fragments,
  fragmentDuration = Config.projectDefaults.fragmentDuration,
  priority = Config.projectDefaults.priority,
  weeklyTarget = Config.projectDefaults.weeklyTarget,
  energyRequired = Config.projectDefaults.energyRequired,
  color = Config.projectDefaults.color
}) {
  const project = {
    id: Engine.makeId(),
    name,
    deadline,
    fragments,
    fragmentDuration,
    priority,
    weeklyTarget,
    energyRequired,
    color,
    progress: 0
  }

  Engine.state.projects.push(project)
  Engine.generateFragments(project)
  Engine.save()
  return project
}

Engine.generateFragments = function(project) {
  for (let i = 0; i < project.fragments; i++) {
    Engine.state.tasks.push({
      id: Engine.makeId(),
      projectId: project.id,
      title: `${project.name} — fragment ${i + 1}`,
      duration: project.fragmentDuration,
      energy: project.energyRequired,
      status: "pending",
      scheduled: null,
      realDuration: null
    })
  }
}

Engine.getProject = function(projectId) {
  return Engine.state.projects.find(p => p.id === projectId) || null
}

Engine.getTask = function(taskId) {
  return Engine.state.tasks.find(t => t.id === taskId) || null
}

Engine.getTasksForProject = function(projectId) {
  return Engine.state.tasks.filter(t => t.projectId === projectId)
}

Engine.recordEnergy = function(hour, value) {
  Engine.state.energyProfile[hour] = value
  Engine.save()
}

Engine.estimateEnergy = function(hour) {
  if (Engine.state.energyProfile[hour] !== undefined) {
    return Engine.state.energyProfile[hour]
  }

  const peak = Number(Engine.state.preferences.energyPeak || 21)
  const distance = Math.abs(hour - peak)
  return Math.max(1, 10 - distance)
}

Engine.scoreTask = function(task, currentHour) {
  const project = Engine.getProject(task.projectId)

  let urgency = 1
  if (project?.deadline) {
    const daysLeft = (new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)
    urgency = Math.max(1, 10 - daysLeft)
  }

  const energyMatch = Engine.estimateEnergy(currentHour) / Math.max(task.energy, 1)
  const durationFit = task.duration <= Number(Engine.state.preferences.focusDuration || 40) ? 1.2 : 1
  const projectMomentum = project ? (project.progress < 100 ? 1.15 : 0.8) : 1

  return urgency * energyMatch * durationFit * projectMomentum
}

Engine.suggestTask = function() {
  const hour = new Date().getHours()
  const tasks = Engine.state.tasks.filter(t => t.status === "pending")
  if (!tasks.length) return null

  let best = null
  let bestScore = -Infinity

  tasks.forEach(task => {
    const score = Engine.scoreTask(task, hour)
    if (score > bestScore) {
      bestScore = score
      best = task
    }
  })

  return best
}

Engine.randomTask = function() {
  const tasks = Engine.state.tasks.filter(t => t.status === "pending")
  if (!tasks.length) return null
  return tasks[Math.floor(Math.random() * tasks.length)]
}

Engine.completeTask = function(taskId, realDuration) {
  const task = Engine.getTask(taskId)
  if (!task) return

  task.status = "done"
  task.realDuration = realDuration

  Engine.state.history.push({
    id: Engine.makeId(),
    taskId,
    date: new Date().toISOString(),
    duration: realDuration
  })

  Engine.updateProjectProgress(task.projectId)
  Engine.learnEnergyPatterns()
  Engine.save()
}

Engine.updateProjectProgress = function(projectId) {
  const project = Engine.getProject(projectId)
  if (!project) return

  const tasks = Engine.getTasksForProject(projectId)
  const done = tasks.filter(t => t.status === "done").length
  project.progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
}

Engine.learnEnergyPatterns = function() {
  const hourly = {}

  Engine.state.history.forEach(entry => {
    const hour = new Date(entry.date).getHours()
    if (!hourly[hour]) hourly[hour] = 0
    hourly[hour] += entry.duration
  })

  Object.keys(hourly).forEach(hour => {
    Engine.state.energyProfile[hour] = Math.min(10, Math.max(1, Math.round(hourly[hour] / 20)))
  })
}

Engine.getStats = function() {
  let estimated = 0
  let real = 0

  Engine.state.tasks.forEach(t => {
    estimated += t.duration
  })

  Engine.state.history.forEach(h => {
    real += h.duration
  })

  return {
    estimated,
    real,
    delta: real - estimated,
    projects: Engine.state.projects.length,
    tasks: Engine.state.tasks.length,
    doneTasks: Engine.state.tasks.filter(t => t.status === "done").length
  }
}

Engine.save = function() {
  localStorage.setItem(Config.app.storageKey, JSON.stringify(Engine.state))
}

Engine.load = function() {
  const raw = localStorage.getItem(Config.app.storageKey)
  if (!raw) return
  try {
    Engine.state = JSON.parse(raw)
  } catch (e) {
    console.warn("Impossible de charger l'état local:", e)
  }
}
