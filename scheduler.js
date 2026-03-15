const Scheduler = {}

Scheduler.pad = n => String(n).padStart(2, "0")

Scheduler.toMinutes = (h, m = 0) => h * 60 + m

Scheduler.fromMinutes = total => ({
  hour: Math.floor(total / 60),
  minute: total % 60
})

Scheduler.toISODate = date => {
  const d = new Date(date)
  return `${d.getFullYear()}-${Scheduler.pad(d.getMonth() + 1)}-${Scheduler.pad(d.getDate())}`
}

Scheduler.fromISO = iso => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

Scheduler.startOfWeek = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

Scheduler.addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

Scheduler.roundQuarter = mins => Math.round(mins / 15) * 15

Scheduler.makeBlockId = () => Engine.makeId()

Scheduler.getWeekTypeForDate = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  if (day === 0 || day === 6) return "weekend"
  return Engine.state.preferences.weekType === "holiday" ? "holiday" : "work"
}

Scheduler.getAllowedWindows = (date) => {
  const weekType = Scheduler.getWeekTypeForDate(date)
  return Config.planning.templates[weekType].allowedWindows
}

Scheduler.getBlocksForDate = (isoDate) => {
  return Engine.state.scheduledBlocks
    .filter(b => b.date === isoDate)
    .sort((a, b) => Scheduler.toMinutes(a.startHour, a.startMinute) - Scheduler.toMinutes(b.startHour, b.startMinute))
}

Scheduler.getBlockById = (blockId) => {
  return Engine.state.scheduledBlocks.find(b => b.id === blockId) || null
}

Scheduler.blockRange = (block) => {
  const start = Scheduler.toMinutes(block.startHour, block.startMinute)
  return { start, end: start + block.duration }
}

Scheduler.hasCollision = (candidate, ignoreId = null) => {
  const blocks = Scheduler.getBlocksForDate(candidate.date)
  const candStart = Scheduler.toMinutes(candidate.startHour, candidate.startMinute)
  const candEnd = candStart + candidate.duration

  return blocks.some(block => {
    if (ignoreId && block.id === ignoreId) return false
    const other = Scheduler.blockRange(block)
    return candStart < other.end && candEnd > other.start
  })
}

Scheduler.createBlock = ({ taskId, projectId, date, startHour, startMinute, duration }) => {
  const block = {
    id: Scheduler.makeBlockId(),
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

Scheduler.updateBlock = (blockId, patch) => {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return null
  Object.assign(block, patch)
  Engine.save()
  return block
}

Scheduler.deleteBlock = (blockId) => {
  Engine.state.scheduledBlocks = Engine.state.scheduledBlocks.filter(b => b.id !== blockId)
  Engine.save()
}

Scheduler.findSlotForTask = (task, date) => {
  const windows = Scheduler.getAllowedWindows(date)

  for (const win of windows) {
    let cursor = win.start

    while (cursor + task.duration <= win.end) {
      const rounded = Scheduler.roundQuarter(cursor)
      const { hour, minute } = Scheduler.fromMinutes(rounded)

      const candidate = {
        date: Scheduler.toISODate(date),
        startHour: hour,
        startMinute: minute,
        duration: task.duration
      }

      if (!Scheduler.hasCollision(candidate)) {
        return candidate
      }

      cursor += 15
    }
  }

  return null
}

Scheduler.scheduleTask = (task, date) => {
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

Scheduler.generateWeekPlan = (startDate = new Date()) => {
  const monday = Scheduler.startOfWeek(startDate)
  const dates = Array.from({ length: 7 }, (_, i) => Scheduler.addDays(monday, i))

  const pending = Engine.state.tasks.filter(t => {
    if (t.status === "done") return false
    return !Engine.state.scheduledBlocks.some(b => b.taskId === t.id)
  })

  pending.sort((a, b) => Engine.scoreTask(b, 20) - Engine.scoreTask(a, 20))

  const created = []

  for (const task of pending) {
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

Scheduler.createManualBlock = ({ date, startHour, startMinute, duration, title = "Bloc libre", projectId = null }) => {
  const taskId = Engine.makeId()

  Engine.state.tasks.push({
    id: taskId,
    projectId,
    title,
    duration,
    energy: 1,
    status: "pending",
    scheduled: date,
    realDuration: null
  })

  const block = Scheduler.createBlock({
    taskId,
    projectId,
    date,
    startHour,
    startMinute,
    duration
  })

  Engine.save()
  return block
}

Scheduler.requestRender = null

Scheduler.dragState = {
  blockId: null,
  startY: 0,
  originalStart: 0,
  originalDuration: 0,
  resizeMode: false
}

Scheduler.attachBlockInteractions = (element, block) => {
  const body = element.querySelector(".timeline-block__body")
  const resize = element.querySelector(".timeline-block__resize")

  body?.addEventListener("mousedown", (e) => {
    e.preventDefault()
    Scheduler.dragState.blockId = block.id
    Scheduler.dragState.startY = e.clientY
    Scheduler.dragState.originalStart = Scheduler.toMinutes(block.startHour, block.startMinute)
    Scheduler.dragState.originalDuration = block.duration
    Scheduler.dragState.resizeMode = false
    document.body.classList.add("dragging-block")
  })

  resize?.addEventListener("mousedown", (e) => {
    e.preventDefault()
    e.stopPropagation()
    Scheduler.dragState.blockId = block.id
    Scheduler.dragState.startY = e.clientY
    Scheduler.dragState.originalStart = Scheduler.toMinutes(block.startHour, block.startMinute)
    Scheduler.dragState.originalDuration = block.duration
    Scheduler.dragState.resizeMode = true
    document.body.classList.add("dragging-block")
  })
}

document.addEventListener("mousemove", (e) => {
  const state = Scheduler.dragState
  if (!state.blockId) return

  const block = Scheduler.getBlockById(state.blockId)
  if (!block) return

  const deltaY = e.clientY - state.startY
  const pxPer15 = Config.ui.timeline.pxPer15Min
  const deltaSlots = Math.round(deltaY / pxPer15)
  const deltaMinutes = deltaSlots * 15

  if (state.resizeMode) {
    const newDuration = Math.max(15, Scheduler.roundQuarter(state.originalDuration + deltaMinutes))
    const candidate = { ...block, duration: newDuration }
    if (!Scheduler.hasCollision(candidate, block.id)) {
      Scheduler.updateBlock(block.id, { duration: newDuration })
      Scheduler.requestRender && Scheduler.requestRender()
    }
  } else {
    const moved = Math.max(Scheduler.toMinutes(Config.ui.timeline.startHour, 0), Scheduler.roundQuarter(state.originalStart + deltaMinutes))
    const { hour, minute } = Scheduler.fromMinutes(moved)
    const candidate = { ...block, startHour: hour, startMinute: minute }
    if (!Scheduler.hasCollision(candidate, block.id)) {
      Scheduler.updateBlock(block.id, { startHour: hour, startMinute: minute })
      Scheduler.requestRender && Scheduler.requestRender()
    }
  }
})

document.addEventListener("mouseup", () => {
  if (!Scheduler.dragState.blockId) return
  Scheduler.dragState.blockId = null
  Scheduler.dragState.resizeMode = false
  document.body.classList.remove("dragging-block")
  Engine.save()
})

Scheduler.getTimelineRows = (isoDate) => {
  const rows = []
  for (let h = Config.ui.timeline.startHour; h <= Config.ui.timeline.endHour; h++) {
    for (let m = 0; m < 60; m += Config.ui.timeline.minutesStep) {
      rows.push({
        hour: h,
        minute: m,
        label: `${Scheduler.pad(h)}:${Scheduler.pad(m)}`,
        minuteValue: Scheduler.toMinutes(h, m)
      })
    }
  }

  const blocks = Scheduler.getBlocksForDate(isoDate).map(block => {
    const task = Engine.getTask(block.taskId)
    const project = Engine.getProject(block.projectId)
    return {
      ...block,
      taskTitle: task?.title || "Tâche",
      projectName: project?.name || "Projet",
      color: project?.color || Config.projectDefaults.color
    }
  })

  return { rows, blocks }
}
