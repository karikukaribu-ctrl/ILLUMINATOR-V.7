/* ============================= */
/* ILLUMINATOR CONFIG */
/* ============================= */

const Config = {
  app: {
    name: "Illuminator",
    version: "6.0.0",
    storageKey: "illuminator-v6-state",
    defaultView: "day",
    defaultTheme: "theme-automne",
    defaultDarkMode: false,
    defaultFontFamily: "Yusei Magic",
    defaultFontSize: 16
  },

  ui: {
    timeline: {
      startHour: 6,
      endHour: 23,
      minutesStep: 15,
      defaultBlockDuration: 30,
      pxPer15Min: 20
    },

    map: {
      canvasMinWidth: 700,
      canvasHeight: 420,
      projectNodeRadius: 34,
      orbitRadius: 140,
      maxVisibleTaskLinks: 4
    },

    panels: {
      leftCollapsed: false,
      rightCollapsed: false
    },

    labels: {
      weekTypes: {
        work: "Semaine travail",
        holiday: "Semaine congé",
        weekend: "Week-end"
      }
    }
  },

  cognitive: {
    focusMode: {
      enabled: false,
      targetProjectId: null,
      hideOtherProjects: true,
      reduceVisibleChoicesTo: 3
    },

    recommendation: {
      useEnergyProfile: true,
      useUrgency: true,
      useDurationFit: true,
      useProjectMomentum: true,
      includeRandomAlternative: true,
      maxSuggestions: 3
    },

    energy: {
      defaultPeakHour: 21,
      minEnergy: 1,
      maxEnergy: 10,
      defaultFocusDuration: 40
    },

    frictionReduction: {
      autoSuggestOnLoad: true,
      autoOpenBestTask: false,
      preferShortTasksWhenTired: true,
      preferContinuationOfActiveProject: true
    }
  },

  planning: {
    templates: {
      work: {
        label: "Semaine travail",
        allowedWindows: [
          { start: 8 * 60, end: 8 * 60 + 30, tag: "morning-write" },
          { start: 12 * 60, end: 12 * 60 + 30, tag: "midday-short" },
          { start: 20 * 60, end: 23 * 60, tag: "evening" }
        ],
        maxDailyWritingMinutesAtWork: 30
      },

      holiday: {
        label: "Semaine congé",
        allowedWindows: [
          { start: 8 * 60, end: 23 * 60, tag: "free-day" }
        ],
        maxDailyWritingMinutesAtWork: 999
      },

      weekend: {
        label: "Week-end",
        allowedWindows: [
          { start: 9 * 60, end: 13 * 60, tag: "weekend-focus" }
        ],
        maxDailyWritingMinutesAtWork: 240
      }
    },

    defaults: {
      weekType: "work",
      autoGenerateOnCreateProject: false,
      autoGenerateOnOpenScheduler: true,
      preserveManualBlocks: true
    }
  },

  projectDefaults: {
    priority: 3,
    weeklyTarget: 3,
    energyRequired: 2,
    fragmentDuration: 30,
    fragments: 8,
    color: "#c56f35"
  },

  googleCalendar: {
    enabled: false,

    /*
      Pour activer :
      1. créer un projet Google Cloud
      2. activer Google Calendar API
      3. créer un OAuth Client ID
      4. remplacer les valeurs ci-dessous
    */
    clientId: "YOUR_GOOGLE_CLIENT_ID",
    apiKey: "YOUR_GOOGLE_API_KEY",
    discoveryDocs: [
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
    ],
    scope: "https://www.googleapis.com/auth/calendar.readonly",

    calendarIds: ["primary"],

    importMode: {
      includeAllDayEvents: true,
      includeTimedEvents: true,
      markAsLockedBlocks: true
    }
  }
}

/* ============================= */
/* CONFIG HELPERS */
/* ============================= */

const ConfigStore = {
  key: "illuminator-v6-config-overrides",

  loadOverrides() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return {}
      return JSON.parse(raw)
    } catch (error) {
      console.warn("Impossible de lire les overrides config :", error)
      return {}
    }
  },

  saveOverrides(overrides) {
    try {
      localStorage.setItem(this.key, JSON.stringify(overrides))
    } catch (error) {
      console.warn("Impossible de sauvegarder les overrides config :", error)
    }
  },

  mergeDeep(target, source) {
    const output = { ...target }

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          output[key] = key in target
            ? this.mergeDeep(target[key], source[key])
            : source[key]
        } else {
          output[key] = source[key]
        }
      })
    }

    return output
  },

  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item)
  },

  getResolvedConfig() {
    const overrides = this.loadOverrides()
    return this.mergeDeep(Config, overrides)
  }
}

/* ============================= */
/* RUNTIME CONFIG */
/* ============================= */

window.IlluminatorConfig = ConfigStore.getResolvedConfig()

/* ============================= */
/* OPTIONAL GOOGLE CALENDAR HELPERS */
/* ============================= */

const GoogleCalendarBridge = {
  isReady() {
    const cfg = window.IlluminatorConfig.googleCalendar
    return !!(
      cfg.enabled &&
      cfg.clientId &&
      cfg.clientId !== "YOUR_GOOGLE_CLIENT_ID" &&
      cfg.apiKey &&
      cfg.apiKey !== "YOUR_GOOGLE_API_KEY"
    )
  },

  async init() {
    if (!this.isReady()) {
      console.info("Google Calendar non activé : configuration incomplète.")
      return false
    }

    if (!window.gapi) {
      console.warn("gapi non chargé. Ajouter le script Google API si tu veux la synchro.")
      return false
    }

    const cfg = window.IlluminatorConfig.googleCalendar

    await new Promise((resolve, reject) => {
      window.gapi.load("client:auth2", {
        callback: resolve,
        onerror: reject,
        timeout: 5000,
        ontimeout: reject
      })
    })

    await window.gapi.client.init({
      apiKey: cfg.apiKey,
      clientId: cfg.clientId,
      discoveryDocs: cfg.discoveryDocs,
      scope: cfg.scope
    })

    return true
  },

  async signIn() {
    if (!this.isReady()) return false
    const auth = window.gapi.auth2.getAuthInstance()
    if (!auth.isSignedIn.get()) {
      await auth.signIn()
    }
    return auth.isSignedIn.get()
  },

  async listEvents({ timeMin, timeMax } = {}) {
    const cfg = window.IlluminatorConfig.googleCalendar

    if (!this.isReady()) {
      return []
    }

    const signed = await this.signIn()
    if (!signed) return []

    const results = []

    for (const calendarId of cfg.calendarIds) {
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: "startTime"
      })

      const items = response.result.items || []
      results.push(
        ...items.map(event => ({
          id: event.id,
          calendarId,
          title: event.summary || "Événement",
          start: event.start?.dateTime || event.start?.date || null,
          end: event.end?.dateTime || event.end?.date || null,
          allDay: !!event.start?.date,
          source: "google-calendar"
        }))
      )
    }

    return results
  }
}
