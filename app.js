const App = {
  currentView: Config.app.defaultView,
  selectedDate: todayISO(),
  focusProjectId: null,
  googleReady: false
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

function startOfWeekISO(iso) {
  const d = fromISO(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

function qs(sel) {
  return document.querySelector(sel)
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel))
}

function el(tag, cls = "", html = "") {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html) node.innerHTML = html
  return node
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

document.addEventListener("DOMContentLoaded", initApp)

function initApp() {
  Engine.load()
  Scheduler.requestRender = renderCurrentView

  bootstrapDemo()
  bindPanels()
  bindTabs()
  bindBottomActions()
  bindPrefs()
  bindGoogleButtons()
  syncPrefsUI()
  renderAll()
}

function bootstrapDemo() {
  if (Engine.state.projects.length) return

  const p1 = Engine.createProject({
    name: "Article addiction écrans",
    deadline: addDays(App.selectedDate, 24),
    fragments: 8,
    fragmentDuration: 30,
    priority: 4,
    weeklyTarget: 3,
    energyRequired: 2,
    color: "#7c4a2d"
  })

  const p2 = Engine.createProject({
    name: "Carnet de stage",
    deadline: addDays(App.selectedDate, 18),
    fragments: 10,
    fragmentDuration: 25,
    priority: 5,
    weeklyTarget: 4,
    energyRequired: 2,
    color: "#9a6343"
  })

  const p3 = Engine.createProject({
    name: "Batterie",
    deadline: addDays(App.selectedDate, 60),
    fragments: 12,
    fragmentDuration: 20,
    priority: 2,
    weeklyTarget: 3,
    energyRequired: 1,
    color: "#a67c2d"
  })

  const p4 = Engine.createProject({
    name: "Application",
    deadline: addDays(App.selectedDate, 40),
    fragments: 10,
    fragmentDuration: 35,
    priority: 4,
    weeklyTarget: 4,
    energyRequired: 3,
    color: "#5a6e8a"
  })

  Scheduler.generateWeekPlan(new Date())
  Engine.save()
}

function bindPanels() {
  qs("#leftPanelToggle").addEventListener("click", () => openPanel("left"))
  qs("#rightPanelToggle").addEventListener("click", () => openPanel("right"))
  qs("#leftPanelClose").addEventListener("click", closePanels)
  qs("#rightPanelClose").addEventListener("click", closePanels)
  qs("#panelBackdrop").addEventListener("click", closePanels)

  qsa("[data-lefttab]").forEach(btn => {
    btn.addEventListener("click", () => switchSideTab("left", btn.dataset.lefttab))
  })

  qsa("[data-righttab]").forEach(btn => {
    btn.addEventListener("click", () => switchSideTab("right", btn.dataset.righttab))
  })
}

function openPanel(side) {
  qs("#panelBackdrop").classList.remove("hidden")
  if (side === "left") qs("#leftPanel").classList.remove("hidden")
  if (side === "right") qs("#rightPanel").classList.remove("hidden")
}

function closePanels() {
  qs("#panelBackdrop").classList.add("hidden")
  qs("#leftPanel").classList.add("hidden")
  qs("#rightPanel").classList.add("hidden")
}

function switchSideTab(side, tab) {
  qsa(`[data-${side}tab]`).forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset[`${side}tab`] === tab)
  })

  qsa(side === "left" ? "#leftPanel .side-page" : "#rightPanel .side-page").forEach(page => {
    page.classList.remove("is-show")
  })

  qs(`#${side}-${tab}`)?.classList.add("is-show")
}

function bindTabs() {
  qsa(".mode-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      App.currentView = btn.dataset.view
      qsa(".mode-pill").forEach(b => b.classList.remove("is-active"))
      btn.classList.add("is-active")
      renderCurrentView()
    })
  })
}

function bindBottomActions() {
  qs("#openNotesBtn").addEventListener("click", openNotesModal)
  qs("#openKiffanceBtn").addEventListener("click", openKiffanceModal)
  qs("#openStatsBtn").addEventListener("click", openStatsModal)
  qs("#openDetailsBtn").addEventListener("click", openProjectChooserModal)
  qs("#openListBtn").addEventListener("click", () => openPanel("left"))
  qs("#openSchedulerBtn").addEventListener("click", openSchedulerModal)
  qs("#openSuggestionBtn").addEventListener("click", openSuggestionModal)

  qs("#newProjectBtn").addEventListener("click", openProjectCreateModal)
  qs("#importInboxBtn").addEventListener("click", importInbox)
  qs("#clearInboxBtn").addEventListener("click", () => { qs("#inboxText").value = "" })

  qs("#generateWeekPlanBtn")?.addEventListener("click", () => {
    Scheduler.generateWeekPlan(new Date(fromISO(App.selectedDate)))
    renderAll()
  })

  qs("#newManualBlockBtn")?.addEventListener("click", openManualBlockModal)
}

function bindPrefs() {
  qs("#savePrefsBtn").addEventListener("click", () => {
    Engine.state.preferences.season = qs("#seasonSelect").value
    Engine.state.preferences.mode = qs("#themeModeSelect").value
    Engine.state.preferences.focus = qs("#focusModeSelect").value === "on"
    Engine.state.preferences.weekType = qs("#weekTypeSelect").value
    Engine.state.preferences.energyPeak = Number(qs("#energyPeakInput").value)
    Engine.state.preferences.focusDuration = Number(qs("#focusDurationInput").value)

    App.focusProjectId = Engine.state.preferences.focus ? (App.focusProjectId || Engine.state.projects[0]?.id || null) : null

    applyPrefsToBody()
    Engine.save()
    renderAll()
  })
}

function bindGoogleButtons() {
  qs("#connectGoogleBtn").addEventListener("click", async () => {
    const ok = await GoogleCalendarBridge.init()
    App.googleReady = ok
    qs("#googleStatus").textContent = ok ? "Google Calendar prêt." : "Configuration Google incomplète."
  })

  qs("#importGoogleWeekBtn").addEventListener("click", async () => {
    if (!App.googleReady) {
      qs("#googleStatus").textContent = "Connecte d'abord Google Calendar."
      return
    }

    const start = startOfWeekISO(App.selectedDate)
    const end = addDays(start, 7)
    const events = await GoogleCalendarBridge.listWeekEvents(start, end)

    if (!events.length) {
      qs("#googleStatus").textContent = "Aucun événement importé."
      return
    }

    events.forEach(event => {
      if (!event.start || !event.end || !event.start.includes("T")) return
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)
      const date = toISO(startDate)
      const duration = Math.max(15, Math.round((endDate - startDate) / (1000 * 60)))
      Scheduler.createManualBlock({
        date,
        startHour: startDate.getHours(),
        startMinute: startDate.getMinutes(),
        duration,
        title: `[Agenda] ${event.title}`,
        projectId: null
      })
    })

    qs("#googleStatus").textContent = `${events.length} événement(s) importé(s).`
    renderAll()
  })
}

function syncPrefsUI() {
  qs("#seasonSelect").value = Engine.state.preferences.season
  qs("#themeModeSelect").value = Engine.state.preferences.mode
  qs("#focusModeSelect").value = Engine.state.preferences.focus ? "on" : "off"
  qs("#weekTypeSelect").value = Engine.state.preferences.weekType
  qs("#energyPeakInput").value = Engine.state.preferences.energyPeak
  qs("#focusDurationInput").value = Engine.state.preferences.focusDuration
  applyPrefsToBody()
}

function applyPrefsToBody() {
  document.body.classList.remove("theme-printemps", "theme-ete", "theme-automne", "theme-hiver")
  document.body.classList.add(`theme-${Engine.state.preferences.season}`)
  document.body.classList.toggle("mode-dark", Engine.state.preferences.mode === "dark")
}

function visibleProjects() {
  if (!App.focusProjectId) return Engine.state.projects
  return Engine.state.projects.filter(p => p.id === App.focusProjectId)
}

function renderAll() {
  renderHeaderStatus()
  renderProjectList()
  renderTaskList()
  renderHeatmap()
  renderStats()
  renderCurrentView()
}

function renderHeaderStatus() {
  qs("#selectedDateLabel").textContent = fromISO(App.selectedDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  })

  const start = startOfWeekISO(App.selectedDate)
  const end = addDays(start, 6)
  qs("#weekLabel").textContent = `${fromISO(start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} → ${fromISO(end).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
}

function renderProjectList() {
  const root = qs("#leftProjectList")
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const card = el("div", "project-list-item")
    card.innerHTML = `
      <strong>${escapeHTML(project.name)}</strong>
      <div class="small-muted">${project.progress}%</div>
    `
    card.addEventListener("click", () => {
      App.focusProjectId = project.id
      renderAll()
      openProjectDetailModal(project.id)
    })
    root.appendChild(card)
  })
}

function renderTaskList() {
  const root = qs("#leftTaskList")
  root.innerHTML = ""

  const tasks = Engine.state.tasks.filter(t => {
    if (t.status === "done") return false
    if (!App.focusProjectId) return true
    return t.projectId === App.focusProjectId
  }).slice(0, 10)

  tasks.forEach(task => {
    const project = Engine.getProject(task.projectId)
    const item = el("div", "active-task-item")
    item.innerHTML = `
      <div><strong>${escapeHTML(task.title)}</strong></div>
      <div class="small-muted">${escapeHTML(project?.name || "Projet")} · ${task.duration} min</div>
    `
    item.addEventListener("click", () => openTaskQuickModal(task.id, true))
    root.appendChild(item)
  })
}

function renderCurrentView() {
  qsa(".view").forEach(v => v.classList.remove("is-show"))
  qs(`#view-${App.currentView}`)?.classList.add("is-show")

  if (App.currentView === "day") renderDayView()
  if (App.currentView === "week") renderWeekView()
  if (App.currentView === "month") renderMonthView()
  if (App.currentView === "projects") renderProjectsView()
  if (App.currentView === "timeline") renderTimelineView()
  if (App.currentView === "map") renderMapView()
}

function renderDayView() {
  const root = qs("#dayBoard")
  root.innerHTML = ""

  const buckets = [
    { label: "08h — 09h", from: 8 * 60, to: 9 * 60 },
    { label: "Travail journée", from: 9 * 60, to: 18 * 60 },
    { label: "20h — 21h30", from: 20 * 60, to: 21 * 60 + 30 },
    { label: "21h30 — 23h", from: 21 * 60 + 30, to: 23 * 60 }
  ]

  const blocks = Scheduler.getBlocksForDate(App.selectedDate)

  buckets.forEach(bucket => {
    const cell = el("div", "day-cell")
    const stack = el("div", "day-cell__stack")

    const relevant = blocks.filter(block => {
      const start = Scheduler.toMinutes(block.startHour, block.startMinute)
      return start >= bucket.from && start < bucket.to
    })

    relevant.forEach(block => {
      const task = Engine.getTask(block.taskId)
      const project = Engine.getProject(block.projectId)
      const frag = el("div", "day-fragment")
      frag.style.background = project?.color || Config.projectDefaults.color
      frag.innerHTML = `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")} · ${escapeHTML(task?.title || "Bloc")}`
      frag.addEventListener("click", () => openBlockEditModal(block.id))
      stack.appendChild(frag)
    })

    if (!relevant.length) {
      stack.innerHTML = `<div class="small-muted">Libre</div>`
    }

    cell.innerHTML = `
      <div class="day-cell__head">
        <span>${bucket.label}</span>
        <span>${relevant.length}</span>
      </div>
    `
    cell.appendChild(stack)
    root.appendChild(cell)
  })

  qs("#daySummaryCompact").textContent = `${blocks.length} bloc(s) aujourd’hui`
}

function renderWeekView() {
  const root = qs("#weekBoard")
  root.innerHTML = ""

  const start = startOfWeekISO(App.selectedDate)

  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i)
    const blocks = Scheduler.getBlocksForDate(iso)

    const dayCard = el("div", "week-day-card")
    const stack = el("div", "week-day-card__stack")
    dayCard.innerHTML = `<strong>${fromISO(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" })}</strong>`

    if (!blocks.length) {
      stack.innerHTML = `<div class="small-muted">Libre</div>`
    } else {
      blocks.forEach(block => {
        const task = Engine.getTask(block.taskId)
        const project = Engine.getProject(block.projectId)
        const chip = el("div", "week-chip", `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")} · ${escapeHTML(task?.title || "Bloc")}`)
        chip.style.background = project?.color || Config.projectDefaults.color
        chip.addEventListener("click", () => openBlockEditModal(block.id))
        stack.appendChild(chip)
      })
    }

    dayCard.appendChild(stack)
    root.appendChild(dayCard)
  }
}

function renderMonthView() {
  const root = qs("#monthBoard")
  root.innerHTML = ""

  const date = fromISO(App.selectedDate)
  const year = date.getFullYear()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()

  for (let d = 1; d <= lastDay; d++) {
    const iso = toISO(new Date(year, month, d))
    const blocks = Scheduler.getBlocksForDate(iso)
    const cell = el("div", "month-cell")
    cell.innerHTML = `
      <div><strong>${d}</strong></div>
      <div class="month-cell__meta">${blocks.length} bloc(s)</div>
    `
    cell.addEventListener("click", () => {
      App.selectedDate = iso
      App.currentView = "day"
      qsa(".mode-pill").forEach(b => b.classList.toggle("is-active", b.dataset.view === "day"))
      renderAll()
    })
    root.appendChild(cell)
  }
}

function renderProjectsView() {
  const root = qs("#projectsBoard")
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const card = el("div", "project-card")
    card.innerHTML = `
      <div class="project-card__head">
        <strong>${escapeHTML(project.name)}</strong>
        <span>${project.progress}%</span>
      </div>
      <div class="progress-vertical">
        <div class="progress-fill" style="height:${project.progress}%"></div>
      </div>
      <div class="small-muted">Fragments : ${project.fragments}</div>
      <div class="small-muted">Fréquence : ${project.weeklyTarget} / semaine</div>
    `
    card.addEventListener("click", () => openProjectDetailModal(project.id))
    root.appendChild(card)
  })
}

function renderTimelineView() {
  const root = qs("#timelineContainer")
  root.innerHTML = `<div class="timeline-grid" id="timelineGrid"></div>`

  const grid = qs("#timelineGrid")
  const { rows, blocks } = Scheduler.getTimelineRows(App.selectedDate)

  rows.forEach(row => {
    const line = el("div", "timeline-row")
    line.innerHTML = `<div class="timeline-row__label">${row.label}</div>`
    grid.appendChild(line)
  })

  grid.style.minHeight = `${rows.length * Config.ui.timeline.pxPer15Min + 24}px`

  blocks.forEach(block => {
    const task = Engine.getTask(block.taskId)
    const project = Engine.getProject(block.projectId)
    const startMin = Scheduler.toMinutes(block.startHour, block.startMinute)
    const offset = startMin - Scheduler.toMinutes(Config.ui.timeline.startHour, 0)

    const blockEl = el("div", "timeline-block")
    blockEl.style.top = `${(offset / 15) * Config.ui.timeline.pxPer15Min}px`
    blockEl.style.height = `${(block.duration / 15) * Config.ui.timeline.pxPer15Min - 4}px`
    blockEl.style.background = project?.color || Config.projectDefaults.color
    blockEl.innerHTML = `
      <div class="timeline-block__body">
        <strong>${escapeHTML(task?.title || "Bloc")}</strong><br>
        <small>${escapeHTML(project?.name || "Projet")}</small>
      </div>
      <div class="timeline-block__resize">⋮</div>
    `

    Scheduler.attachBlockInteractions(blockEl, block)
    blockEl.addEventListener("dblclick", () => openBlockEditModal(block.id))
    grid.appendChild(blockEl)
  })
}

function renderMapView() {
  const root = qs("#mapBoard")
  root.innerHTML = `<div class="realm-map" id="realmMap"></div>`

  const map = qs("#realmMap")
  const projects = visibleProjects()

  const centerX = 460
  const centerY = 180
  const radius = 140

  const positions = projects.map((project, i) => {
    const angle = (Math.PI * 2 / Math.max(projects.length, 1)) * i
    return {
      project,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    }
  })

  positions.forEach((p, i) => {
    const next = positions[(i + 1) % positions.length]
    if (!next) return

    const dx = next.x - p.x
    const dy = next.y - p.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    const link = el("div", "realm-link")
    link.style.left = `${p.x}px`
    link.style.top = `${p.y}px`
    link.style.width = `${len}px`
    link.style.transform = `rotate(${angle}deg)`
    map.appendChild(link)
  })

  positions.forEach(p => {
    const node = el("div", "realm-node")
    node.style.left = `${p.x - 60}px`
    node.style.top = `${p.y - 20}px`
    node.style.background = p.project.color || Config.projectDefaults.color
    node.innerHTML = `${escapeHTML(p.project.name)}<br>${p.project.progress}%`
    node.addEventListener("click", () => openProjectDetailModal(p.project.id))
    map.appendChild(node)
  })
}

function renderHeatmap() {
  const root = qs("#energyHeatmap")
  root.innerHTML = ""

  for (let hour = 6; hour <= 23; hour++) {
    const energy = Engine.estimateEnergy(hour)
    const cell = el("div", "heat-cell")
    cell.style.background = `rgba(124,74,45,${Math.max(0.12, energy / 10)})`
    cell.title = `${hour}h · énergie ${energy}`
    root.appendChild(cell)
  }
}

function renderStats() {
  const stats = Engine.getStats()
  const root = qs("#statsPanel")
  root.innerHTML = `
    <div class="stat-card">Estimé : ${stats.estimated} min</div>
    <div class="stat-card">Réel : ${stats.real} min</div>
    <div class="stat-card">Écart : ${stats.delta} min</div>
    <div class="stat-card">Projets : ${stats.projects}</div>
    <div class="stat-card">Fragments : ${stats.tasks}</div>
    <div class="stat-card">Terminés : ${stats.doneTasks}</div>
  `
}

function openModal(html, bindFn) {
  const layer = qs("#modalLayer")
  layer.innerHTML = `
    <div class="modal-overlay" id="modalOverlay"></div>
    <div class="modal">
      <button class="modal-close" id="modalClose">×</button>
      ${html}
    </div>
  `

  qs("#modalOverlay").addEventListener("click", closeModal)
  qs("#modalClose").addEventListener("click", closeModal)
  if (bindFn) bindFn()
}

function closeModal() {
  qs("#modalLayer").innerHTML = ""
}

function openProjectCreateModal() {
  openModal(`
    <h2>Nouveau projet</h2>
    <label>Nom<br><input id="projName"></label><br><br>
    <label>Deadline<br><input id="projDeadline" type="date" value="${addDays(App.selectedDate, 30)}"></label><br><br>
    <label>Fragments<br><input id="projFragments" type="number" value="8"></label><br><br>
    <label>Durée fragment<br><input id="projDuration" type="number" value="30"></label><br><br>
    <label>Priorité<br><input id="projPriority" type="number" value="3" min="1" max="5"></label><br><br>
    <label>Fréquence / semaine<br><input id="projWeekly" type="number" value="3" min="1" max="7"></label><br><br>
    <label>Énergie requise<br><input id="projEnergy" type="number" value="2" min="1" max="5"></label><br><br>
    <label>Couleur<br><input id="projColor" type="color" value="${Config.projectDefaults.color}"></label><br><br>
    <button id="saveProjBtn" class="action-btn action-btn--accent">Créer</button>
  `, () => {
    qs("#saveProjBtn").addEventListener("click", () => {
      Engine.createProject({
        name: qs("#projName").value.trim() || "Projet",
        deadline: qs("#projDeadline").value,
        fragments: Number(qs("#projFragments").value || 8),
        fragmentDuration: Number(qs("#projDuration").value || 30),
        priority: Number(qs("#projPriority").value || 3),
        weeklyTarget: Number(qs("#projWeekly").value || 3),
        energyRequired: Number(qs("#projEnergy").value || 2),
        color: qs("#projColor").value || Config.projectDefaults.color
      })
      closeModal()
      renderAll()
    })
  })
}

function openProjectDetailModal(projectId) {
  const project = Engine.getProject(projectId)
  if (!project) return

  const tasks = Engine.getTasksForProject(projectId)

  openModal(`
    <h2>${escapeHTML(project.name)}</h2>
    <p>Progression : ${project.progress}%</p>
    <p>Deadline : ${project.deadline}</p>
    <p>Fragments : ${project.fragments}</p>
    <p>Durée : ${project.fragmentDuration} min</p>
    <p>Fréquence : ${project.weeklyTarget} / semaine</p>
    <hr>
    <h3>Fragments</h3>
    <div id="projectTasksModal">
      ${tasks.map(t => `<div class="project-task-row" data-task-id="${t.id}">${escapeHTML(t.title)} · ${t.duration} min · ${t.status}</div>`).join("")}
    </div>
    <hr>
    <button id="focusProjectBtn" class="action-btn">Focus</button>
    <button id="planProjectWeekBtn" class="action-btn action-btn--accent">Planifier</button>
  `, () => {
    qsa("#projectTasksModal .project-task-row").forEach(row => {
      row.addEventListener("click", () => openTaskQuickModal(row.dataset.taskId, true))
    })

    qs("#focusProjectBtn").addEventListener("click", () => {
      App.focusProjectId = project.id
      Engine.state.preferences.focus = true
      qs("#focusModeSelect").value = "on"
      closeModal()
      renderAll()
    })

    qs("#planProjectWeekBtn").addEventListener("click", () => {
      const pending = Engine.getTasksForProject(project.id).filter(t => t.status !== "done")
      const monday = startOfWeekISO(App.selectedDate)
      const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

      pending.forEach(task => {
        if (Engine.state.scheduledBlocks.some(b => b.taskId === task.id)) return
        for (const day of days) {
          const block = Scheduler.scheduleTask(task, fromISO(day))
          if (block) break
        }
      })

      closeModal()
      renderAll()
    })
  })
}

function openTaskQuickModal(taskId, withSchedule = false) {
  const task = Engine.getTask(taskId)
  if (!task) return
  const project = Engine.getProject(task.projectId)

  openModal(`
    <h2>${escapeHTML(task.title)}</h2>
    <p>${escapeHTML(project?.name || "Projet")}</p>
    <p>Durée : ${task.duration} min</p>
    <p>Énergie : ${task.energy}</p>
    ${withSchedule ? `
      <hr>
      <label>Date<br><input id="taskDateInput" type="date" value="${App.selectedDate}"></label><br><br>
      <label>Heure<br><input id="taskTimeInput" type="time" value="20:00"></label><br><br>
      <button id="scheduleTaskBtn" class="action-btn action-btn--accent">Planifier</button>
      <button id="completeTaskBtn" class="action-btn">Terminer</button>
    ` : `
      <button id="completeTaskBtn" class="action-btn action-btn--accent">Terminer</button>
    `}
  `, () => {
    qs("#completeTaskBtn")?.addEventListener("click", () => {
      Engine.completeTask(task.id, task.duration)
      closeModal()
      renderAll()
    })

    qs("#scheduleTaskBtn")?.addEventListener("click", () => {
      const [h, m] = qs("#taskTimeInput").value.split(":").map(Number)
      Scheduler.createBlock({
        taskId: task.id,
        projectId: task.projectId,
        date: qs("#taskDateInput").value,
        startHour: h,
        startMinute: m,
        duration: task.duration
      })
      closeModal()
      renderAll()
    })
  })
}

function openBlockEditModal(blockId) {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return

  const task = Engine.getTask(block.taskId)
  const project = Engine.getProject(block.projectId)

  openModal(`
    <h2>Bloc</h2>
    <p>${escapeHTML(task?.title || "Bloc")}</p>
    <p>${escapeHTML(project?.name || "Projet")}</p>
    <label>Date<br><input id="blockDateInput" type="date" value="${block.date}"></label><br><br>
    <label>Heure<br><input id="blockTimeInput" type="time" value="${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}"></label><br><br>
    <label>Durée<br><input id="blockDurationInput" type="number" value="${block.duration}"></label><br><br>
    <button id="saveBlockBtn" class="action-btn action-btn--accent">Sauver</button>
    <button id="deleteBlockBtn" class="action-btn action-btn--danger">Supprimer</button>
  `, () => {
    qs("#saveBlockBtn").addEventListener("click", () => {
      const [h, m] = qs("#blockTimeInput").value.split(":").map(Number)
      Scheduler.updateBlock(block.id, {
        date: qs("#blockDateInput").value,
        startHour: h,
        startMinute: m,
        duration: Number(qs("#blockDurationInput").value || block.duration)
      })
      closeModal()
      renderAll()
    })

    qs("#deleteBlockBtn").addEventListener("click", () => {
      Scheduler.deleteBlock(block.id)
      closeModal()
      renderAll()
    })
  })
}

function openSchedulerModal() {
  openModal(`
    <h2>Planification automatique</h2>
    <p>Générer le planning hebdomadaire à partir des fragments non placés.</p>
    <button id="runWeekSchedulerBtn" class="action-btn action-btn--accent">Générer</button>
  `, () => {
    qs("#runWeekSchedulerBtn").addEventListener("click", () => {
      Scheduler.generateWeekPlan(new Date(fromISO(App.selectedDate)))
      closeModal()
      renderAll()
    })
  })
}

function openStatsModal() {
  const stats = Engine.getStats()
  openModal(`
    <h2>Statistiques</h2>
    <p>Temps estimé : ${stats.estimated} min</p>
    <p>Temps réel : ${stats.real} min</p>
    <p>Écart : ${stats.delta} min</p>
    <p>Projets : ${stats.projects}</p>
    <p>Fragments : ${stats.tasks}</p>
    <p>Terminés : ${stats.doneTasks}</p>
  `)
}

function openNotesModal() {
  openModal(`
    <h2>Notes</h2>
    <textarea id="notesTextArea" rows="12" class="field textarea" placeholder="Écris ici ce qui doit rester visible à l'esprit...">${localStorage.getItem("illuminator-notes") || ""}</textarea>
    <br><br>
    <button id="saveNotesBtn" class="action-btn action-btn--accent">Sauver</button>
  `, () => {
    qs("#saveNotesBtn").addEventListener("click", () => {
      localStorage.setItem("illuminator-notes", qs("#notesTextArea").value)
      closeModal()
    })
  })
}

function openKiffanceModal() {
  const ideas = [
    "5 min de marche lente",
    "1 rythme très court à la batterie",
    "relire 1 paragraphe inspirant",
    "écrire 3 idées sans filtre",
    "respirer 10 cycles",
    "ranger juste 1 zone"
  ]

  const pick = ideas[Math.floor(Math.random() * ideas.length)]

  openModal(`
    <h2>Kiffance</h2>
    <div class="suggestion-box">${pick}</div>
  `)
}

function openProjectChooserModal() {
  openModal(`
    <h2>Territoires</h2>
    <div id="projectChooserList" class="stack">
      ${Engine.state.projects.map(p => `<div class="project-task-row" data-project-id="${p.id}">${escapeHTML(p.name)} · ${p.progress}%</div>`).join("")}
    </div>
  `, () => {
    qsa("#projectChooserList .project-task-row").forEach(row => {
      row.addEventListener("click", () => {
        closeModal()
        openProjectDetailModal(row.dataset.projectId)
      })
    })
  })
}

function openSuggestionModal() {
  const best = Engine.suggestTask()
  const random = Engine.randomTask()

  openModal(`
    <h2>Suggestion</h2>
    <div class="suggestion-box">
      <strong>Meilleure action</strong><br>
      ${best ? escapeHTML(best.title) : "Aucune"}<br>
      <small>${best ? best.duration + " min" : ""}</small>
    </div>
    <br>
    <div class="suggestion-box">
      <strong>Option aléatoire</strong><br>
      ${random ? escapeHTML(random.title) : "Aucune"}<br>
      <small>${random ? random.duration + " min" : ""}</small>
    </div>
    <br>
    <button id="suggestBestBtn" class="action-btn action-btn--accent">Planifier la meilleure</button>
    <button id="suggestRandomBtn" class="action-btn">Planifier l’aléatoire</button>
  `, () => {
    qs("#suggestBestBtn").addEventListener("click", () => {
      if (!best) return
      closeModal()
      openTaskQuickModal(best.id, true)
    })

    qs("#suggestRandomBtn").addEventListener("click", () => {
      if (!random) return
      closeModal()
      openTaskQuickModal(random.id, true)
    })
  })
}

function openManualBlockModal() {
  openModal(`
    <h2>Bloc libre</h2>
    <label>Nom<br><input id="manualBlockTitle" value="Bloc libre"></label><br><br>
    <label>Date<br><input id="manualBlockDate" type="date" value="${App.selectedDate}"></label><br><br>
    <label>Heure<br><input id="manualBlockTime" type="time" value="20:00"></label><br><br>
    <label>Durée<br><input id="manualBlockDuration" type="number" value="${Config.ui.timeline.defaultBlockDuration}"></label><br><br>
    <button id="saveManualBlockBtn" class="action-btn action-btn--accent">Créer</button>
  `, () => {
    qs("#saveManualBlockBtn").addEventListener("click", () => {
      const [h, m] = qs("#manualBlockTime").value.split(":").map(Number)
      Scheduler.createManualBlock({
        date: qs("#manualBlockDate").value,
        startHour: h,
        startMinute: m,
        duration: Number(qs("#manualBlockDuration").value || Config.ui.timeline.defaultBlockDuration),
        title: qs("#manualBlockTitle").value || "Bloc libre",
        projectId: null
      })
      closeModal()
      renderAll()
    })
  })
}

function importInbox() {
  const raw = qs("#inboxText").value.trim()
  if (!raw) return

  const firstProject = Engine.state.projects[0]?.id || null
  raw.split("\n").map(s => s.trim()).filter(Boolean).forEach(line => {
    const match = line.match(/^(.*?)(?:\s*-\s*(\d+))?$/)
    const title = match?.[1]?.trim() || line
    const duration = Number(match?.[2] || 20)

    Engine.state.tasks.push({
      id: Engine.makeId(),
      projectId: firstProject,
      title,
      duration,
      energy: 1,
      status: "pending",
      scheduled: null,
      realDuration: null
    })
  })

  qs("#inboxText").value = ""
  Engine.save()
  renderAll()
}
