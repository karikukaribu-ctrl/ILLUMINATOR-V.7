/* ============================= */
/* ILLUMINATOR APP */
/* ============================= */

const App = {
  currentView: "day",
  selectedDate: AppDate.todayISO(),
  focusProjectId: null,
  darkMode: false,
  currentSuggestedTaskId: null,
  mapCanvas: null,
  mapCtx: null
}

/* ============================= */
/* DATE HELPERS */
/* ============================= */

const AppDate = {
  pad(n) {
    return String(n).padStart(2, "0")
  },

  todayISO() {
    const d = new Date()
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`
  },

  fromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number)
    return new Date(y, m - 1, d)
  },

  toISO(date) {
    const d = new Date(date)
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`
  },

  addDays(iso, n) {
    const d = this.fromISO(iso)
    d.setDate(d.getDate() + n)
    return this.toISO(d)
  },

  startOfWeekISO(iso) {
    const d = this.fromISO(iso)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return this.toISO(d)
  },

  labelDay(iso) {
    return this.fromISO(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })
  },

  labelShort(iso) {
    return this.fromISO(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit"
    })
  },

  labelMonth(iso) {
    return this.fromISO(iso).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric"
    })
  }
}

/* ============================= */
/* DOM HELPERS */
/* ============================= */

function $(selector) {
  return document.querySelector(selector)
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector))
}

function createEl(tag, className = "", html = "") {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (html) el.innerHTML = html
  return el
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

/* ============================= */
/* INIT */
/* ============================= */

document.addEventListener("DOMContentLoaded", initApp)

function initApp() {
  Engine.load()

  Scheduler.requestRender = renderCurrentView

  bootstrapDemoIfNeeded()
  bindGlobalControls()
  bindViewButtons()
  bindFooterButtons()
  syncUIFromState()
  renderAll()
}

/* ============================= */
/* DEMO / SAFETY */
/* ============================= */

function bootstrapDemoIfNeeded() {
  if (!Engine.state.projects.length) {
    Engine.createProject({
      name: "Article addictions écrans",
      deadline: AppDate.addDays(App.selectedDate, 30),
      fragments: 8,
      fragmentDuration: 30,
      priority: 4,
      weeklyTarget: 3,
      energyRequired: 2
    })

    Engine.createProject({
      name: "Carnet de stage",
      deadline: AppDate.addDays(App.selectedDate, 21),
      fragments: 10,
      fragmentDuration: 25,
      priority: 5,
      weeklyTarget: 4,
      energyRequired: 2
    })

    Engine.createProject({
      name: "Livre en cours",
      deadline: AppDate.addDays(App.selectedDate, 45),
      fragments: 12,
      fragmentDuration: 20,
      priority: 2,
      weeklyTarget: 2,
      energyRequired: 1
    })

    Engine.createProject({
      name: "Batterie",
      deadline: AppDate.addDays(App.selectedDate, 60),
      fragments: 12,
      fragmentDuration: 20,
      priority: 2,
      weeklyTarget: 3,
      energyRequired: 1
    })
  }

  if (!Engine.state.scheduledBlocks.length) {
    Scheduler.generateWeekPlan(new Date())
  }

  Engine.save()
}

/* ============================= */
/* BINDINGS */
/* ============================= */

function bindGlobalControls() {
  $("#seasonSelector")?.addEventListener("change", (e) => {
    const body = document.body
    body.classList.remove("theme-automne", "theme-printemps", "theme-ete", "theme-hiver")
    body.classList.add(`theme-${e.target.value}`)
  })

  $("#darkToggle")?.addEventListener("click", () => {
    App.darkMode = !App.darkMode
    document.body.classList.toggle("dark", App.darkMode)
  })

  $("#focusToggle")?.addEventListener("click", () => {
    if (App.focusProjectId) {
      App.focusProjectId = null
    } else {
      const first = Engine.state.projects[0]
      App.focusProjectId = first ? first.id : null
    }
    renderAll()
  })

  $("#aiSuggest")?.addEventListener("click", () => {
    const suggested = Engine.suggestTask()
    App.currentSuggestedTaskId = suggested ? suggested.id : null
    renderRecommendation()
    if (suggested) {
      openTaskQuickModal(suggested.id, true)
    }
  })

  $("#newProjectButton")?.addEventListener("click", () => {
    openProjectCreateModal()
  })

  $("#energyPeak")?.addEventListener("input", () => {
    renderHeatmap()
    renderRecommendation()
  })

  $("#focusDuration")?.addEventListener("change", () => {
    renderRecommendation()
  })
}

function bindViewButtons() {
  $all(".view-selector button").forEach(btn => {
    btn.addEventListener("click", () => {
      App.currentView = btn.dataset.view
      renderCurrentView()
    })
  })
}

function bindFooterButtons() {
  $("#openScheduler")?.addEventListener("click", () => {
    openSchedulerModal()
  })

  $("#openStats")?.addEventListener("click", () => {
    openStatsModal()
  })

  $("#openSettings")?.addEventListener("click", () => {
    openSettingsModal()
  })
}

function syncUIFromState() {
  $("#weekType") && ($("#weekType").value = "work")
  $("#energyPeak") && ($("#energyPeak").value = "21")
  $("#focusDuration") && ($("#focusDuration").value = "40")
}

/* ============================= */
/* RENDER MASTER */
/* ============================= */

function renderAll() {
  renderProjectList()
  renderActiveTasks()
  renderCurrentView()
  renderHeatmap()
  renderRecommendation()
  renderStats()
}

function renderCurrentView() {
  hideAllViews()

  switch (App.currentView) {
    case "day":
      $("#dashboardView")?.classList.remove("hidden")
      renderDayView()
      break
    case "week":
      $("#weekView")?.classList.remove("hidden")
      renderWeekView()
      break
    case "month":
      $("#monthView")?.classList.remove("hidden")
      renderMonthView()
      break
    case "projects":
      $("#projectsView")?.classList.remove("hidden")
      renderProjectsView()
      break
    case "timeline":
      $("#timelineView")?.classList.remove("hidden")
      renderTimelineView()
      break
    case "map":
      $("#mapView")?.classList.remove("hidden")
      renderMapView()
      break
    default:
      $("#dashboardView")?.classList.remove("hidden")
      renderDayView()
  }
}

function hideAllViews() {
  const ids = [
    "#dashboardView",
    "#weekView",
    "#monthView",
    "#projectsView",
    "#timelineView",
    "#mapView"
  ]
  ids.forEach(id => $(id)?.classList.add("hidden"))
}

/* ============================= */
/* LEFT PANEL */
/* ============================= */

function visibleProjects() {
  if (!App.focusProjectId) return Engine.state.projects
  return Engine.state.projects.filter(p => p.id === App.focusProjectId)
}

function renderProjectList() {
  const root = $("#projectList")
  if (!root) return
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const card = createEl("div", "project-list-item")
    card.innerHTML = `
      <strong>${escapeHTML(project.name)}</strong>
      <div>${project.progress}%</div>
    `
    card.addEventListener("click", () => {
      App.focusProjectId = project.id
      renderAll()
      openProjectDetailModal(project.id)
    })
    root.appendChild(card)
  })
}

function renderActiveTasks() {
  const root = $("#activeTasks")
  if (!root) return
  root.innerHTML = ""

  const pending = Engine.state.tasks.filter(t => {
    if (t.status === "done") return false
    if (!App.focusProjectId) return true
    return t.projectId === App.focusProjectId
  }).slice(0, 8)

  pending.forEach(task => {
    const project = Engine.state.projects.find(p => p.id === task.projectId)
    const item = createEl("div", "active-task-item")
    item.innerHTML = `
      <div><strong>${escapeHTML(task.title)}</strong></div>
      <div>${escapeHTML(project?.name || "Projet")} · ${task.duration} min</div>
    `
    item.addEventListener("click", () => openTaskQuickModal(task.id))
    root.appendChild(item)
  })
}

/* ============================= */
/* DAY VIEW */
/* ============================= */

function renderDayView() {
  const titleRoot = $("#todayProgress")
  if (titleRoot) {
    const blocks = Scheduler.getBlocksForDate(App.selectedDate)
    const doneCount = blocks.length
    titleRoot.innerHTML = `
      <span>${AppDate.labelDay(App.selectedDate)}</span>
      <span>${doneCount} bloc(s)</span>
    `
  }

  renderMiniDayTimeline("#todayTimeline", App.selectedDate)
}

function renderMiniDayTimeline(targetSelector, dateISO) {
  const root = $(targetSelector)
  if (!root) return
  root.innerHTML = ""

  const { rows, blocks } = Scheduler.getTimelineRows(dateISO, 6, 23)

  rows.forEach(row => {
    const slot = createEl("div", "timeline-slot")
    slot.dataset.hour = row.hour
    slot.dataset.minute = row.minute
    slot.innerHTML = `<span>${row.label}</span>`

    const matching = blocks.filter(block => {
      const start = Scheduler.toMinutes(block.startHour, block.startMinute)
      return start === row.minuteValue
    })

    matching.forEach(block => {
      const blockEl = createEl("div", "timeline-task")
      blockEl.style.background = block.color || "#c56f35"
      blockEl.innerHTML = `
        <div class="timeline-block__body">
          ${escapeHTML(block.taskTitle)}
        </div>
        <div class="timeline-block__resize">⋮</div>
      `
      blockEl.dataset.blockId = block.id
      Scheduler.attachBlockInteractions(blockEl, block)
      blockEl.addEventListener("dblclick", () => openBlockEditModal(block.id))
      slot.appendChild(blockEl)
    })

    root.appendChild(slot)
  })
}

/* ============================= */
/* WEEK VIEW */
/* ============================= */

function renderWeekView() {
  const root = $("#weekGrid")
  if (!root) return
  root.innerHTML = ""

  const start = AppDate.startOfWeekISO(App.selectedDate)

  for (let i = 0; i < 7; i++) {
    const date = AppDate.addDays(start, i)
    const day = createEl("div", "week-day")
    day.innerHTML = `
      <h4>${AppDate.labelShort(date)}</h4>
      <div class="week-day__inner" id="week-day-${date}"></div>
    `
    root.appendChild(day)
    renderWeekDayMini(date, `#week-day-${date}`)
  }
}

function renderWeekDayMini(dateISO, targetSelector) {
  const root = $(targetSelector)
  if (!root) return
  root.innerHTML = ""

  const blocks = Scheduler.getBlocksForDate(dateISO)

  if (!blocks.length) {
    root.innerHTML = `<small>Libre</small>`
    return
  }

  blocks.forEach(block => {
    const project = Scheduler.getProject(block.projectId)
    const task = Scheduler.getTask(block.taskId)
    const tag = createEl("div", "week-task-chip")
    tag.style.background = project?.color || "#c56f35"
    tag.innerHTML = `${Scheduler.pad(block.startHour)}:${Scheduler.pad(block.startMinute)} · ${escapeHTML(task?.title || "Tâche")}`
    tag.addEventListener("click", () => openBlockEditModal(block.id))
    root.appendChild(tag)
  })
}

/* ============================= */
/* MONTH VIEW */
/* ============================= */

function renderMonthView() {
  const root = $("#monthGrid")
  if (!root) return
  root.innerHTML = ""

  const date = AppDate.fromISO(App.selectedDate)
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  for (let d = 1; d <= last.getDate(); d++) {
    const iso = AppDate.toISO(new Date(year, month, d))
    const day = createEl("div", "month-day")
    const blocks = Scheduler.getBlocksForDate(iso)
    day.innerHTML = `
      <div><strong>${d}</strong></div>
      <div>${blocks.length} bloc(s)</div>
    `
    day.addEventListener("click", () => {
      App.selectedDate = iso
      App.currentView = "day"
      renderCurrentView()
    })
    root.appendChild(day)
  }
}

/* ============================= */
/* PROJECTS VIEW */
/* ============================= */

function renderProjectsView() {
  const root = $("#projectCards")
  if (!root) return
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const card = createEl("div", "project-card")
    card.innerHTML = `
      <h3>${escapeHTML(project.name)}</h3>
      <div class="progress-vertical">
        <div class="progress-fill" style="height:${project.progress}%"></div>
      </div>
      <p>${project.progress}%</p>
    `
    card.addEventListener("click", () => openProjectDetailModal(project.id))
    root.appendChild(card)
  })
}

/* ============================= */
/* TIMELINE VIEW */
/* ============================= */

function renderTimelineView() {
  const root = $("#timelineContainer")
  if (!root) return

  root.innerHTML = `
    <div id="timelineVertical"></div>
  `

  const timeline = $("#timelineVertical")
  if (!timeline) return

  timeline.dataset.pxPer15 = "20"

  const { rows, blocks } = Scheduler.getTimelineRows(App.selectedDate, 6, 23)

  rows.forEach(row => {
    const slot = createEl("div", "timeline-slot")
    slot.dataset.hour = row.hour
    slot.dataset.minute = row.minute
    slot.innerHTML = `<span>${row.label}</span>`

    timeline.appendChild(slot)
  })

  blocks.forEach(block => {
    const task = Scheduler.getTask(block.taskId)
    const project = Scheduler.getProject(block.projectId)

    const blockEl = createEl("div", "timeline-task timeline-task--floating")
    blockEl.dataset.blockId = block.id
    blockEl.style.position = "absolute"
    blockEl.style.left = "100px"
    blockEl.style.right = "12px"
    blockEl.style.top = `${(Scheduler.toMinutes(block.startHour, block.startMinute) - 360) / 15 * 20}px`
    blockEl.style.height = `${(block.duration / 15) * 20 - 4}px`
    blockEl.style.background = project?.color || "#c56f35"

    blockEl.innerHTML = `
      <div class="timeline-block__body">
        <strong>${escapeHTML(task?.title || "Tâche")}</strong><br>
        <small>${escapeHTML(project?.name || "")}</small>
      </div>
      <div class="timeline-block__resize">⋮</div>
    `

    Scheduler.attachBlockInteractions(blockEl, block)
    blockEl.addEventListener("dblclick", () => openBlockEditModal(block.id))

    timeline.appendChild(blockEl)
  })

  timeline.style.position = "relative"
  timeline.style.minHeight = `${rows.length * 20 + 40}px`
}

/* ============================= */
/* MAP VIEW */
/* ============================= */

function renderMapView() {
  const canvas = $("#projectMap")
  if (!canvas) return

  App.mapCanvas = canvas
  App.mapCtx = canvas.getContext("2d")

  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(600, rect.width || 800)
  canvas.height = 420

  const ctx = App.mapCtx
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const projects = visibleProjects()
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = 140

  projects.forEach((project, index) => {
    const angle = (Math.PI * 2 / Math.max(projects.length, 1)) * index
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius

    ctx.fillStyle = project.color || "#c56f35"
    ctx.beginPath()
    ctx.arc(x, y, 34, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#ffffff"
    ctx.font = "12px Yusei Magic"
    ctx.textAlign = "center"
    ctx.fillText(project.name.slice(0, 12), x, y + 4)

    const linkedTasks = Engine.state.tasks.filter(t => t.projectId === project.id).slice(0, 4)
    linkedTasks.forEach((task, i) => {
      const tx = x + (i % 2 === 0 ? -70 : 70)
      const ty = y + (i * 22) - 40

      ctx.strokeStyle = "rgba(0,0,0,0.25)"
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(tx, ty)
      ctx.stroke()

      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.fillRect(tx - 50, ty - 12, 100, 22)
      ctx.fillStyle = "#222"
      ctx.fillText(task.title.slice(0, 16), tx, ty + 4)
    })
  })
}

/* ============================= */
/* HEATMAP */
/* ============================= */

function renderHeatmap() {
  const root = $("#energyHeatmap")
  if (!root) return
  root.innerHTML = ""

  for (let hour = 6; hour <= 23; hour++) {
    const energy = Engine.estimateEnergy(hour)
    const cell = createEl("div", "heat-cell")
    const alpha = Math.min(1, Math.max(0.1, energy / 10))
    cell.style.background = `rgba(200,100,40,${alpha})`
    cell.title = `${hour}h · énergie ${energy.toFixed(1)}`
    root.appendChild(cell)
  }
}

/* ============================= */
/* RECOMMENDATION */
/* ============================= */

function renderRecommendation() {
  const root = $("#recommendation")
  if (!root) return

  const suggested = Engine.suggestTask()
  const randomAlt = Engine.randomTask()

  if (!suggested) {
    root.innerHTML = `<p>Rien à proposer.</p>`
    return
  }

  App.currentSuggestedTaskId = suggested.id
  const project = Engine.state.projects.find(p => p.id === suggested.projectId)

  root.innerHTML = `
    <div class="suggestion-box">
      <strong>Meilleure action</strong><br>
      ${escapeHTML(suggested.title)}<br>
      <small>${escapeHTML(project?.name || "")} · ${suggested.duration} min</small>
    </div>
    <div style="margin-top:10px;">
      <button id="acceptSuggestionBtn">Planifier</button>
      <button id="randomSuggestionBtn">Aléatoire</button>
    </div>
  `

  $("#acceptSuggestionBtn")?.addEventListener("click", () => {
    openTaskQuickModal(suggested.id, true)
  })

  $("#randomSuggestionBtn")?.addEventListener("click", () => {
    if (!randomAlt) return
    openTaskQuickModal(randomAlt.id, true)
  })
}

/* ============================= */
/* STATS */
/* ============================= */

function renderStats() {
  const root = $("#statsPanel")
  if (!root) return

  const stats = Engine.getStats()
  root.innerHTML = `
    <div>Estimé : ${stats.estimated} min</div>
    <div>Réel : ${stats.real} min</div>
    <div>Écart : ${stats.real - stats.estimated} min</div>
    <div>Projets : ${Engine.state.projects.length}</div>
    <div>Fragments : ${Engine.state.tasks.length}</div>
  `
}

/* ============================= */
/* MODALS */
/* ============================= */

function closeModal() {
  const root = $("#modalLayer")
  if (root) root.innerHTML = ""
}

function openModal(contentHTML, bindAfter = null) {
  const root = $("#modalLayer")
  if (!root) return

  root.innerHTML = `
    <div class="modal-overlay" id="globalModalOverlay"></div>
    <div class="modal">
      <button class="modal-close" id="globalModalClose">×</button>
      ${contentHTML}
    </div>
  `

  $("#globalModalOverlay")?.addEventListener("click", closeModal)
  $("#globalModalClose")?.addEventListener("click", closeModal)

  if (typeof bindAfter === "function") {
    bindAfter()
  }
}

function openProjectCreateModal() {
  openModal(`
    <h2>Nouveau projet</h2>
    <label>Nom<br><input id="newProjName"></label><br><br>
    <label>Deadline<br><input id="newProjDeadline" type="date" value="${AppDate.addDays(App.selectedDate, 30)}"></label><br><br>
    <label>Fragments<br><input id="newProjFragments" type="number" value="8"></label><br><br>
    <label>Durée fragment (min)<br><input id="newProjDuration" type="number" value="30"></label><br><br>
    <label>Priorité<br><input id="newProjPriority" type="number" value="3" min="1" max="5"></label><br><br>
    <label>Fréquence / semaine<br><input id="newProjWeekly" type="number" value="3" min="1" max="7"></label><br><br>
    <label>Énergie requise<br><input id="newProjEnergy" type="number" value="2" min="1" max="5"></label><br><br>
    <label>Couleur<br><input id="newProjColor" type="color" value="#c56f35"></label><br><br>
    <button id="saveProjectBtn">Créer</button>
  `, () => {
    $("#saveProjectBtn")?.addEventListener("click", () => {
      const project = Engine.createProject({
        name: $("#newProjName").value.trim() || "Projet",
        deadline: $("#newProjDeadline").value,
        fragments: Number($("#newProjFragments").value || 8),
        fragmentDuration: Number($("#newProjDuration").value || 30),
        priority: Number($("#newProjPriority").value || 3),
        weeklyTarget: Number($("#newProjWeekly").value || 3),
        energyRequired: Number($("#newProjEnergy").value || 2)
      })

      project.color = $("#newProjColor").value || "#c56f35"
      Engine.save()
      closeModal()
      renderAll()
    })
  })
}

function openProjectDetailModal(projectId) {
  const project = Engine.state.projects.find(p => p.id === projectId)
  if (!project) return

  const tasks = Engine.state.tasks.filter(t => t.projectId === projectId)

  openModal(`
    <h2>${escapeHTML(project.name)}</h2>
    <p>Progression : ${project.progress}%</p>
    <p>Deadline : ${escapeHTML(project.deadline)}</p>
    <p>Fragments : ${project.fragments}</p>
    <p>Durée moyenne : ${project.fragmentDuration} min</p>
    <hr>
    <h3>Fragments</h3>
    <div id="projectTaskList">
      ${tasks.map(t => `
        <div class="project-task-row" data-task-id="${t.id}">
          ${escapeHTML(t.title)} · ${t.duration} min · ${t.status}
        </div>
      `).join("")}
    </div>
    <hr>
    <button id="planProjectBtn">Planifier semaine</button>
  `, () => {
    $("#planProjectBtn")?.addEventListener("click", () => {
      Scheduler.generateWeekPlan(new Date(AppDate.fromISO(App.selectedDate)))
      closeModal()
      renderAll()
    })

    $all(".project-task-row").forEach(row => {
      row.addEventListener("click", () => {
        openTaskQuickModal(row.dataset.taskId)
      })
    })
  })
}

function openTaskQuickModal(taskId, withSchedule = false) {
  const task = Engine.state.tasks.find(t => t.id === taskId)
  if (!task) return

  const project = Engine.state.projects.find(p => p.id === task.projectId)

  openModal(`
    <h2>${escapeHTML(task.title)}</h2>
    <p>${escapeHTML(project?.name || "")}</p>
    <p>Durée : ${task.duration} min</p>
    <p>Énergie : ${task.energy}</p>
    ${withSchedule ? `
      <hr>
      <label>Date<br><input id="quickTaskDate" type="date" value="${App.selectedDate}"></label><br><br>
      <label>Heure<br><input id="quickTaskTime" type="time" value="20:00"></label><br><br>
      <button id="scheduleTaskBtn">Ajouter au planning</button>
    ` : `
      <button id="markDoneBtn">Marquer fait</button>
    `}
  `, () => {
    $("#markDoneBtn")?.addEventListener("click", () => {
      Engine.completeTask(task.id, task.duration)
      Engine.learnEnergyPatterns()
      Engine.save()
      closeModal()
      renderAll()
    })

    $("#scheduleTaskBtn")?.addEventListener("click", () => {
      const date = $("#quickTaskDate").value
      const [h, m] = $("#quickTaskTime").value.split(":").map(Number)

      Scheduler.createBlock({
        taskId: task.id,
        projectId: task.projectId,
        date,
        startHour: h,
        startMinute: m,
        duration: task.duration
      })

      Engine.save()
      closeModal()
      renderAll()
    })
  })
}

function openBlockEditModal(blockId) {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return

  const task = Scheduler.getTask(block.taskId)
  const project = Scheduler.getProject(block.projectId)

  openModal(`
    <h2>Bloc</h2>
    <p>${escapeHTML(task?.title || "Tâche")}</p>
    <p>${escapeHTML(project?.name || "Projet")}</p>
    <label>Date<br><input id="editBlockDate" type="date" value="${block.date}"></label><br><br>
    <label>Heure<br><input id="editBlockTime" type="time" value="${Scheduler.pad(block.startHour)}:${Scheduler.pad(block.startMinute)}"></label><br><br>
    <label>Durée<br><input id="editBlockDuration" type="number" value="${block.duration}"></label><br><br>
    <button id="saveBlockBtn">Sauver</button>
    <button id="deleteBlockBtn">Supprimer</button>
  `, () => {
    $("#saveBlockBtn")?.addEventListener("click", () => {
      const [h, m] = $("#editBlockTime").value.split(":").map(Number)
      Scheduler.updateBlock(block.id, {
        date: $("#editBlockDate").value,
        startHour: h,
        startMinute: m,
        duration: Number($("#editBlockDuration").value || block.duration)
      })
      closeModal()
      renderAll()
    })

    $("#deleteBlockBtn")?.addEventListener("click", () => {
      Scheduler.deleteBlock(block.id)
      closeModal()
      renderAll()
    })
  })
}

function openSchedulerModal() {
  openModal(`
    <h2>Planification automatique</h2>
    <p>Générer la semaine à partir des tâches non planifiées.</p>
    <button id="runSchedulerBtn">Générer</button>
  `, () => {
    $("#runSchedulerBtn")?.addEventListener("click", () => {
      Scheduler.generateWeekPlan(new Date(AppDate.fromISO(App.selectedDate)))
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
    <p>Différence : ${stats.real - stats.estimated} min</p>
    <p>Historique : ${Engine.state.history.length} entrée(s)</p>
  `)
}

function openSettingsModal() {
  openModal(`
    <h2>Paramètres</h2>
    <p>La police reste Yusei Magic, comme demandé. Pas de mutation capricieuse ici.</p>
    <label>Type semaine
      <select id="settingsWeekTypeModal">
        <option value="work">Travail</option>
        <option value="holiday">Congé</option>
      </select>
    </label>
  `, () => {
    const weekType = $("#weekType")
    const modalWeekType = $("#settingsWeekTypeModal")
    if (weekType && modalWeekType) {
      modalWeekType.value = weekType.value
      modalWeekType.addEventListener("change", () => {
        weekType.value = modalWeekType.value
      })
    }
  })
      }
