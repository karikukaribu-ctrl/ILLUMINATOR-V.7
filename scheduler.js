/* ============================= */
/* ILLUMINATOR SCHEDULER */
/* ============================= */

const Scheduler = {}

/* ============================= */
/* DATA STORE */
/* ============================= */

if (!Engine.state.scheduledBlocks) {
  Engine.state.scheduledBlocks = []
}

if (!Engine.state.weekTemplates) {
  Engine.state.weekTemplates = {
    work: {
      label: "Semaine travail",
      allowedWindows: [
        { start: 8 * 60, end: 8 * 60 + 30, tag: "morning-write" },
        { start: 12 * 60, end: 12 * 60 + 30, tag: "midday-short" },
        { start: 20 * 60, end: 23 * 60, tag: "evening" }
      ]
    },
    holiday: {
      label: "Semaine congé",
      allowedWindows: [
        { start: 8 * 60, end: 23 * 60, tag: "free-day" }
      ]
    },
    weekend: {
      label: "Week-end",
      allowedWindows: [
        { start: 9 * 60, end: 13 * 60, tag: "weekend-focus" },
        { start: 14 * 60, end: 18 * 60, tag: "weekend-flex" }
      ]
    }
  }
}

/* ============================= */
/* HELPERS */
/* ============================= */

Scheduler.pad = function (n) {
  return String(n).padStart(2, "0")
}

Scheduler.toMinutes = function (hour, minute = 0) {
  return hour * 60 + minute
}

Scheduler.fromMinutes = function (total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return { hour: h, minute: m }
}

Scheduler.toISODate = function (date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${Scheduler.pad(d.getMonth() + 1)}-${Scheduler.pad(d.getDate())}`
}

Scheduler.startOfWeek = function (date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

Scheduler.addDays = function (date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

Scheduler.isWeekend = function (date) {
  const d = new Date(date)
  const day = d.getDay()
  return day === 0 || day === 6
}

Scheduler.roundToQuarter = function (minutes) {
  return Math.round(minutes / 15) * 15
}

Scheduler.clamp = function (value, min, max) {
  return Math.max(min, Math.min(max, value))
}

Scheduler.generateId = function () {
  return crypto.randomUUID ? crypto.randomUUID() : `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/* ============================= */
/* BLOCK CRUD */
/* ============================= */

Scheduler.createBlock = function ({
  taskId,
  projectId,
  date,
  startHour,
  startMinute,
  duration
}) {
  const block = {
    id: Scheduler.generateId(),
    taskId,
    projectId,
    date,
    startHour,
    startMinute,
    duration
  }

  Engine.state.scheduledBlocks.push(block)
  Engine.save()
  return block
}

Scheduler.updateBlock = function (blockId, patch) {
  const block = Engine.state.scheduledBlocks.find(b => b.id === blockId)
  if (!block) return null

  Object.assign(block, patch)
  Engine.save()
  return block
}

Scheduler.deleteBlock = function (blockId) {
  Engine.state.scheduledBlocks = Engine.state.scheduledBlocks.filter(b => b.id !== blockId)
  Engine.save()
}

Scheduler.getBlocksForDate = function (date) {
  const iso = typeof date === "string" ? date : Scheduler.toISODate(date)
  return Engine.state.scheduledBlocks
    .filter(b => b.date === iso)
    .sort((a, b) => {
      const aMin = Scheduler.toMinutes(a.startHour, a.startMinute)
      const bMin = Scheduler.toMinutes(b.startHour, b.startMinute)
      return aMin - bMin
    })
}

Scheduler.getBlockById = function (blockId) {
  return Engine.state.scheduledBlocks.find(b => b.id === blockId) || null
}

/* ============================= */
/* TASK / PROJECT HELPERS */
/* ============================= */

Scheduler.getTask = function (taskId) {
  return Engine.state.tasks.find(t => t.id === taskId) || null
}

Scheduler.getProject = function (projectId) {
  return Engine.state.projects.find(p => p.id === projectId) || null
}

/* ============================= */
/* COLLISION CHECK */
/* ============================= */

Scheduler.blockRange = function (block) {
  const start = Scheduler.toMinutes(block.startHour, block.startMinute)
  const end = start + block.duration
  return { start, end }
}

Scheduler.hasCollision = function (candidate, ignoreBlockId = null) {
  const blocks = Scheduler.getBlocksForDate(candidate.date)

  const cand = {
    start: Scheduler.toMinutes(candidate.startHour, candidate.startMinute),
    end: Scheduler.toMinutes(candidate.startHour, candidate.startMinute) + candidate.duration
  }

  return blocks.some(block => {
    if (ignoreBlockId && block.id === ignoreBlockId) return false
    const other = Scheduler.blockRange(block)
    return cand.start < other.end && cand.end > other.start
  })
}

/* ============================= */
/* AVAILABLE WINDOWS */
/* ============================= */

Scheduler.getWeekTypeForDate = function (date) {
  const selected = document.getElementById("weekType")?.value || "work"
  const d = new Date(date)

  if (Scheduler.isWeekend(d)) {
    return "weekend"
  }

  return selected === "holiday" ? "holiday" : "work"
}

Scheduler.getAllowedWindowsForDate = function (date) {
  const weekType = Scheduler.getWeekTypeForDate(date)
  return Engine.state.weekTemplates[weekType].allowedWindows
}

/* ============================= */
/* AUTO PLANIFICATION */
/* ============================= */

Scheduler.findSlotForTask = function (task, date) {
  const windows = Scheduler.getAllowedWindowsForDate(date)
  const dayBlocks = Scheduler.getBlocksForDate(date)

  for (const win of windows) {
    let cursor = win.start

    while (cursor + task.duration <= win.end) {
      const rounded = Scheduler.roundToQuarter(cursor)
      const { hour, minute } = Scheduler.fromMinutes(rounded)

      const candidate = {
        date: Scheduler.toISODate(date),
        startHour: hour,
        startMinute: minute,
        duration: task.duration
      }

      const tooLate = rounded + task.duration > win.end
      if (!tooLate && !Scheduler.hasCollision(candidate)) {
        return candidate
      }

      cursor += 15
    }
  }

  return null
}

Scheduler.scheduleTask = function (task, date) {
  const slot = Scheduler.findSlotForTask(task, date)
  if (!slot) return null

  return Scheduler.createBlock({
    taskId: task.id,
    projectId: task.projectId,
    date: slot.date,
    startHour: slot.startHour,
    startMinute: slot.startMinute,
    duration: task.duration
  })
}

Scheduler.generateWeekPlan = function (startDate = new Date()) {
  const monday = Scheduler.startOfWeek(startDate)
  const dates = Array.from({ length: 7 }, (_, i) => Scheduler.addDays(monday, i))

  const unscheduledTasks = Engine.state.tasks.filter(t => {
    if (t.status === "done") return false
    const alreadyScheduled = Engine.state.scheduledBlocks.some(b => b.taskId === t.id)
    return !alreadyScheduled
  })

  const sortedTasks = unscheduledTasks.slice().sort((a, b) => {
    const scoreA = Engine.scoreTask(a, 20)
    const scoreB = Engine.scoreTask(b, 20)
    return scoreB - scoreA
  })

  const created = []

  for (const task of sortedTasks) {
    for (const date of dates) {
      const block = Scheduler.scheduleTask(task, date)
      if (block) {
        created.push(block)
        break
      }
    }
  }

  Engine.save()
  return created
}

/* ============================= */
/* DRAG & DROP + EDITABLE BLOCKS */
/* ============================= */

Scheduler.dragState = {
  blockId: null,
  startY: 0,
  originalMinutes: 0,
  originalDuration: 0,
  resizeMode: false
}

Scheduler.attachBlockInteractions = function (blockEl, block) {
  const handle = blockEl.querySelector(".timeline-block__resize")
  const body = blockEl.querySelector(".timeline-block__body")

  if (!body) return

  body.addEventListener("mousedown", (e) => {
    e.preventDefault()
    Scheduler.dragState.blockId = block.id
    Scheduler.dragState.startY = e.clientY
    Scheduler.dragState.originalMinutes = Scheduler.toMinutes(block.startHour, block.startMinute)
    Scheduler.dragState.originalDuration = block.duration
    Scheduler.dragState.resizeMode = false
    document.body.classList.add("dragging-block")
  })

  if (handle) {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      Scheduler.dragState.blockId = block.id
      Scheduler.dragState.startY = e.clientY
      Scheduler.dragState.originalMinutes = Scheduler.toMinutes(block.startHour, block.startMinute)
      Scheduler.dragState.originalDuration = block.duration
      Scheduler.dragState.resizeMode = true
      document.body.classList.add("dragging-block")
    })
  }
}

Scheduler.handlePointerMove = function (e) {
  const state = Scheduler.dragState
  if (!state.blockId) return

  const block = Scheduler.getBlockById(state.blockId)
  if (!block) return

  const timeline = document.getElementById("timelineContainer")
  if (!timeline) return

  const pxPer15Min = Number(timeline.dataset.pxPer15 || 20)
  const deltaY = e.clientY - state.startY
  const deltaSlots = Math.round(deltaY / pxPer15Min)
  const deltaMinutes = deltaSlots * 15

  if (state.resizeMode) {
    const newDuration = Scheduler.clamp(
      Scheduler.roundToQuarter(state.originalDuration + deltaMinutes),
      15,
      240
    )

    const candidate = {
      ...block,
      duration: newDuration
    }

    if (!Scheduler.hasCollision(candidate, block.id)) {
      Scheduler.updateBlock(block.id, { duration: newDuration })
      Scheduler.requestRender?.()
    }
  } else {
    const movedMinutes = Scheduler.clamp(
      Scheduler.roundToQuarter(state.originalMinutes + deltaMinutes),
      6 * 60,
      23 * 60
    )

    const { hour, minute } = Scheduler.fromMinutes(movedMinutes)
    const candidate = {
      ...block,
      startHour: hour,
      startMinute: minute
    }

    if (!Scheduler.hasCollision(candidate, block.id)) {
      Scheduler.updateBlock(block.id, {
        startHour: hour,
        startMinute: minute
      })
      Scheduler.requestRender?.()
    }
  }
}

Scheduler.handlePointerUp = function () {
  if (!Scheduler.dragState.blockId) return
  Scheduler.dragState.blockId = null
  Scheduler.dragState.resizeMode = false
  document.body.classList.remove("dragging-block")
  Engine.save()
}

document.addEventListener("mousemove", Scheduler.handlePointerMove)
document.addEventListener("mouseup", Scheduler.handlePointerUp)

/* ============================= */
/* TIMELINE RENDER DATA */
/* ============================= */

Scheduler.getTimelineRows = function (date, startHour = 6, endHour = 23) {
  const rows = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      rows.push({
        hour: h,
        minute: m,
        label: `${Scheduler.pad(h)}:${Scheduler.pad(m)}`,
        minuteValue: Scheduler.toMinutes(h, m)
      })
    }
  }

  const blocks = Scheduler.getBlocksForDate(date).map(block => {
    const task = Scheduler.getTask(block.taskId)
    const project = Scheduler.getProject(block.projectId)

    return {
      ...block,
      taskTitle: task?.title || "Tâche",
      projectName: project?.name || "Projet",
      color: project?.color || "#c56f35"
    }
  })

  return { rows, blocks }
}

/* ============================= */
/* MANUAL BLOCK CREATION */
/* ============================= */

Scheduler.createManualBlock = function ({
  date,
  startHour,
  startMinute,
  duration,
  title = "Bloc libre",
  projectId = null
}) {
  const fakeTaskId = Scheduler.generateId()

  Engine.state.tasks.push({
    id: fakeTaskId,
    projectId,
    title,
    duration,
    energy: 1,
    status: "pending",
    scheduled: date
  })

  const block = Scheduler.createBlock({
    taskId: fakeTaskId,
    projectId,
    date,
    startHour,
    startMinute,
    duration
  })

  Engine.save()
  return block
}

/* ============================= */
/* REAL VS ESTIMATED BY BLOCK */
/* ============================= */

Scheduler.attachRealDurationToTask = function (blockId, realDuration) {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return

  const task = Scheduler.getTask(block.taskId)
  if (!task) return

  task.realDuration = realDuration
  Engine.save()
}

/* ============================= */
/* CLEANUP / RESCHEDULE */
/* ============================= */

Scheduler.rescheduleBlockToDate = function (blockId, newDate) {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return null

  const candidate = {
    ...block,
    date: newDate
  }

  if (Scheduler.hasCollision(candidate, block.id)) {
    const task = Scheduler.getTask(block.taskId)
    const tempTask = {
      duration: task?.duration || block.duration
    }
    const slot = Scheduler.findSlotForTask(tempTask, newDate)
    if (!slot) return null

    return Scheduler.updateBlock(blockId, {
      date: slot.date,
      startHour: slot.startHour,
      startMinute: slot.startMinute
    })
  }

  return Scheduler.updateBlock(blockId, { date: newDate })
}

/* ============================= */
/* REQUEST RENDER HOOK */
/* ============================= */

Scheduler.requestRender = null
