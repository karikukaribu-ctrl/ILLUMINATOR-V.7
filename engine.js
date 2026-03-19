const Engine = {}

Engine.state = {
  cortex: Config.app.defaultCortex,
  timelineZoom: Config.planning.defaultZoom,
  quests: [],
  museum: [],
  traces: [],
  camp: null,
  notes: "",
  stickyNotes: [],
  blocks: [],
  preferences: {
    season: Config.defaults.season,
    mode: Config.defaults.mode,
    fog: Config.defaults.fog,
    focus: Config.defaults.focus,
    weather: Config.defaults.weather,
    weekType: Config.defaults.weekType,
    energyPeak: Config.defaults.energyPeak,
    focusDuration: Config.defaults.focusDuration,
    clarity: Config.defaults.clarity,
    anchor: Config.defaults.anchor,
    momentum: Config.defaults.momentum
  },
  energyProfile: {}
}

Engine.makeId = function () {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

Engine.save = function () {
  localStorage.setItem(Config.app.storageKey, JSON.stringify(Engine.state))
}

Engine.load = function () {
  const raw = localStorage.getItem(Config.app.storageKey)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    Engine.state = {
      ...Engine.state,
      ...parsed,
      preferences: {
        ...Engine.state.preferences,
        ...(parsed.preferences || {})
      }
    }
  } catch (e) {
    console.warn("Impossible de charger l’état :", e)
  }
}

Engine.createQuest = function ({
  name,
  deadline,
  fragments = Config.questDefaults.fragments,
  fragmentDuration = Config.questDefaults.fragmentDuration,
  priority = Config.questDefaults.priority,
  weeklyTarget = Config.questDefaults.weeklyTarget,
  energyRequired = Config.questDefaults.energyRequired,
  color = Config.questDefaults.color
}) {
  const quest = {
    id: Engine.makeId(),
    name,
    deadline,
    priority,
    weeklyTarget,
    energyRequired,
    color,
    progress: 0,
    awakened: false,
    expanded: false,
    x: 0,
    y: 0,
    fragments: []
  }

  for (let i = 0; i < fragments; i++) {
    quest.fragments.push({
      id: Engine.makeId(),
      title: `${name} — fragment ${i + 1}`,
      duration: fragmentDuration,
      energy: energyRequired,
      temperature: energyRequired >= 4 ? "hot" : energyRequired >= 3 ? "warm" : "cool",
      done: false,
      notes: "",
      scheduled: null,
      realDuration: null
    })
  }

  Engine.state.quests.push(quest)
  Engine.updateQuestProgress(quest.id)
  Engine.addTrace("Nouvelle quête", name)
  Engine.save()
  return quest
}

Engine.getQuest = function (questId) {
  return Engine.state.quests.find(q => q.id === questId) || null
}

Engine.getFragment = function (questId, fragmentId) {
  const quest = Engine.getQuest(questId)
  if (!quest) return null
  return quest.fragments.find(f => f.id === fragmentId) || null
}

Engine.getAllFragments = function () {
  return Engine.state.quests.flatMap(quest =>
    quest.fragments.map(fragment => ({
      ...fragment,
      questId: quest.id,
      questName: quest.name,
      questColor: quest.color,
      priority: quest.priority,
      deadline: quest.deadline,
      weeklyTarget: quest.weeklyTarget,
      awakened: quest.awakened
    }))
  )
}

Engine.updateQuestProgress = function (questId) {
  const quest = Engine.getQuest(questId)
  if (!quest) return
  const total = quest.fragments.length
  const done = quest.fragments.filter(f => f.done).length
  quest.progress = total ? Math.round((done / total) * 100) : 0
}

Engine.toggleFragmentDone = function (questId, fragmentId) {
  const fragment = Engine.getFragment(questId, fragmentId)
  if (!fragment) return

  fragment.done = !fragment.done

  if (fragment.done) {
    Engine.addTrace("Fragment accompli", fragment.title)
  } else {
    Engine.addTrace("Fragment rouvert", fragment.title)
  }

  Engine.updateQuestProgress(questId)
  Engine.learnEnergyPatterns()
  Engine.save()
}

Engine.updateFragment = function (questId, fragmentId, patch) {
  const fragment = Engine.getFragment(questId, fragmentId)
  if (!fragment) return null
  Object.assign(fragment, patch)
  Engine.updateQuestProgress(questId)
  Engine.save()
  return fragment
}

Engine.splitFragment = function (questId, fragmentId) {
  const quest = Engine.getQuest(questId)
  const fragment = Engine.getFragment(questId, fragmentId)
  if (!quest || !fragment) return
  if (fragment.duration <= 10) return

  const half = Math.max(10, Math.round(fragment.duration / 2))
  const idx = quest.fragments.findIndex(f => f.id === fragmentId)

  const a = {
    ...fragment,
    id: Engine.makeId(),
    title: `${fragment.title} — A`,
    duration: half,
    done: false,
    scheduled: null
  }

  const b = {
    ...fragment,
    id: Engine.makeId(),
    title: `${fragment.title} — B`,
    duration: Math.max(10, fragment.duration - half),
    done: false,
    scheduled: null
  }

  quest.fragments.splice(idx, 1, a, b)
  Engine.updateQuestProgress(questId)
  Engine.addTrace("Forgeron", `Fragment découpé : ${fragment.title}`)
  Engine.save()
}

Engine.archiveQuest = function (questId) {
  const quest = Engine.state.quests.find(q => q.id === questId)
  if (!quest) return
  Engine.state.quests = Engine.state.quests.filter(q => q.id !== questId)
  Engine.state.museum.push(quest)
  Engine.addTrace("Musée", `Quête mise en sommeil : ${quest.name}`)
  Engine.save()
}

Engine.restoreQuest = function (questId) {
  const quest = Engine.state.museum.find(q => q.id === questId)
  if (!quest) return
  Engine.state.museum = Engine.state.museum.filter(q => q.id !== questId)
  Engine.state.quests.push(quest)
  Engine.addTrace("Musée", `Quête restaurée : ${quest.name}`)
  Engine.save()
}

Engine.awakenQuest = function (questId) {
  Engine.state.quests.forEach(q => {
    q.awakened = q.id === questId
  })
  const quest = Engine.getQuest(questId)
  if (quest) Engine.addTrace("Éveil", `Quête éveillée : ${quest.name}`)
  Engine.save()
}

Engine.addTrace = function (title, text) {
  Engine.state.traces.unshift({
    id: Engine.makeId(),
    title,
    text,
    date: new Date().toISOString()
  })
  Engine.state.traces = Engine.state.traces.slice(0, 60)
}

Engine.setCamp = function (data) {
  Engine.state.camp = {
    ...data,
    savedAt: new Date().toISOString()
  }
  Engine.addTrace("Campement", data.label || "Campement posé")
  Engine.save()
}

Engine.clearCamp = function () {
  Engine.state.camp = null
  Engine.save()
}

Engine.createSticky = function (text = Config.stickyDefaults.text) {
  const note = {
    id: Engine.makeId(),
    text,
    x: Config.stickyDefaults.x,
    y: Config.stickyDefaults.y
  }
  Engine.state.stickyNotes.push(note)
  Engine.addTrace("Post-it", "Nouveau post-it")
  Engine.save()
  return note
}

Engine.updateSticky = function (noteId, patch) {
  const note = Engine.state.stickyNotes.find(n => n.id === noteId)
  if (!note) return null
  Object.assign(note, patch)
  Engine.save()
  return note
}

Engine.deleteSticky = function (noteId) {
  Engine.state.stickyNotes = Engine.state.stickyNotes.filter(n => n.id !== noteId)
  Engine.save()
}

Engine.estimateEnergy = function (hour) {
  if (Engine.state.energyProfile[hour] !== undefined) {
    return Engine.state.energyProfile[hour]
  }
  const peak = Number(Engine.state.preferences.energyPeak || 21)
  const distance = Math.abs(hour - peak)
  return Math.max(1, 10 - distance)
}

Engine.learnEnergyPatterns = function () {
  const hourly = {}
  Engine.state.traces.forEach(trace => {
    const hour = new Date(trace.date).getHours()
    if (!hourly[hour]) hourly[hour] = 0
    hourly[hour] += 1
  })

  Object.keys(hourly).forEach(h => {
    Engine.state.energyProfile[h] = Math.min(10, Math.max(1, hourly[h]))
  })
}

Engine.scoreFragment = function (fragment, currentHour) {
  let urgency = 1

  if (fragment.deadline) {
    const daysLeft = (new Date(fragment.deadline) - new Date()) / (1000 * 60 * 60 * 24)
    urgency = Math.max(1, 10 - daysLeft)
  }

  const energyMatch = Engine.estimateEnergy(currentHour) / Math.max(fragment.energy, 1)
  const durationFit = fragment.duration <= Number(Engine.state.preferences.focusDuration || 40) ? 1.2 : 1
  const awakenBonus = fragment.awakened ? 1.25 : 1
  const scheduleBonus = fragment.scheduled ? 1.1 : 1
  const priorityBonus = 1 + ((fragment.priority || 1) * 0.08)

  return urgency * energyMatch * durationFit * awakenBonus * scheduleBonus * priorityBonus
}

Engine.suggestBestFragment = function () {
  const hour = new Date().getHours()
  const fragments = Engine.getAllFragments().filter(f => !f.done)
  if (!fragments.length) return null

  let best = null
  let bestScore = -Infinity

  fragments.forEach(fragment => {
    const score = Engine.scoreFragment(fragment, hour)
    if (score > bestScore) {
      best = fragment
      bestScore = score
    }
  })

  return best
}

Engine.randomFragment = function () {
  const fragments = Engine.getAllFragments().filter(f => !f.done)
  if (!fragments.length) return null
  return fragments[Math.floor(Math.random() * fragments.length)]
}

Engine.getFirstStepText = function (fragment) {
  if (!fragment) return "Aucun premier pas disponible."

  const title = fragment.title.toLowerCase()

  if (title.includes("article")) {
    return `Ouvre le document et écris juste le titre de « ${fragment.title} ».`
  }
  if (title.includes("rapport")) {
    return `Écris l’en-tête puis une phrase d’ouverture pour « ${fragment.title} ».`
  }
  if (title.includes("plan")) {
    return `Pose trois lignes de squelette pour « ${fragment.title} ».`
  }
  return `Premier pas : ouvrir, regarder, écrire une ligne pour « ${fragment.title} ».`
}

Engine.getTriad = function () {
  const pending = Engine.getAllFragments().filter(f => !f.done)
  if (!pending.length) return []

  const byDuration = [...pending].sort((a, b) => a.duration - b.duration)
  const byEnergy = [...pending].sort((a, b) => a.energy - b.energy)
  const byUrgency = [...pending].sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity
    return ad - bd
  })

  return [
    { label: "Lourd", fragment: byUrgency[0] || null },
    { label: "Fluide", fragment: byDuration[0] || null },
    { label: "Plaisir", fragment: byEnergy[0] || null }
  ]
}

Engine.getStats = function () {
  let estimated = 0
  let doneFragments = 0
  let totalFragments = 0

  Engine.state.quests.forEach(quest => {
    quest.fragments.forEach(fragment => {
      totalFragments += 1
      estimated += fragment.duration
      if (fragment.done) doneFragments += 1
    })
  })

  return {
    quests: Engine.state.quests.length,
    fragments: totalFragments,
    doneFragments,
    estimated
  }
}
