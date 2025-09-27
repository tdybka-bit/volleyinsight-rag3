interface AnalyticsEvent {
  id: string
  type: 'block_click' | 'question_asked' | 'page_view' | 'session_start' | 'session_end'
  data: any
  timestamp: number
  sessionId: string
  userAgent: string
  ip?: string
}

interface BlockClickData {
  blockId: string
  blockName: string
  fromPage: string
}

interface QuestionData {
  question: string
  topic?: string
  responseLength: number
  hasContext: boolean
  sourcesCount: number
}

interface PageViewData {
  page: string
  timeSpent: number
  referrer?: string
}

interface SessionData {
  sessionId: string
  startTime: number
  endTime?: number
  pagesVisited: string[]
  totalTime: number
  userAgent: string
  ip?: string
}

class AnalyticsTracker {
  private events: AnalyticsEvent[] = []
  private sessions: Map<string, SessionData> = new Map()
  private currentSession: string | null = null

  constructor() {
    this.loadFromStorage()
    this.startNewSession()
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startNewSession() {
    this.currentSession = this.generateSessionId()
    const sessionData: SessionData = {
      sessionId: this.currentSession,
      startTime: Date.now(),
      pagesVisited: [],
      totalTime: 0,
      userAgent: navigator.userAgent
    }
    this.sessions.set(this.currentSession, sessionData)
    this.saveToStorage()
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return
    
    try {
      const savedEvents = localStorage.getItem('volleyinsight-analytics-events')
      const savedSessions = localStorage.getItem('volleyinsight-analytics-sessions')
      
      if (savedEvents) {
        this.events = JSON.parse(savedEvents)
      }
      
      if (savedSessions) {
        const sessionsData = JSON.parse(savedSessions)
        this.sessions = new Map(sessionsData)
      }
    } catch (error) {
      console.error('Error loading analytics data:', error)
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem('volleyinsight-analytics-events', JSON.stringify(this.events))
      localStorage.setItem('volleyinsight-analytics-sessions', JSON.stringify(Array.from(this.sessions.entries())))
    } catch (error) {
      console.error('Error saving analytics data:', error)
    }
  }

  // Public methods
  trackBlockClick(blockId: string, blockName: string, fromPage: string = 'home') {
    const event: AnalyticsEvent = {
      id: this.generateId(),
      type: 'block_click',
      data: { blockId, blockName, fromPage } as BlockClickData,
      timestamp: Date.now(),
      sessionId: this.currentSession || '',
      userAgent: navigator.userAgent
    }
    this.events.push(event)
    this.saveToStorage()
  }

  trackQuestion(question: string, topic?: string, responseLength: number = 0, hasContext: boolean = false, sourcesCount: number = 0) {
    const event: AnalyticsEvent = {
      id: this.generateId(),
      type: 'question_asked',
      data: { question, topic, responseLength, hasContext, sourcesCount } as QuestionData,
      timestamp: Date.now(),
      sessionId: this.currentSession || '',
      userAgent: navigator.userAgent
    }
    this.events.push(event)
    this.saveToStorage()
  }

  trackPageView(page: string, timeSpent: number = 0, referrer?: string) {
    const event: AnalyticsEvent = {
      id: this.generateId(),
      type: 'page_view',
      data: { page, timeSpent, referrer } as PageViewData,
      timestamp: Date.now(),
      sessionId: this.currentSession || '',
      userAgent: navigator.userAgent
    }
    this.events.push(event)

    // Update session
    if (this.currentSession) {
      const session = this.sessions.get(this.currentSession)
      if (session) {
        if (!session.pagesVisited.includes(page)) {
          session.pagesVisited.push(page)
        }
        session.totalTime += timeSpent
        this.sessions.set(this.currentSession, session)
      }
    }

    this.saveToStorage()
  }

  endSession() {
    if (this.currentSession) {
      const session = this.sessions.get(this.currentSession)
      if (session) {
        session.endTime = Date.now()
        this.sessions.set(this.currentSession, session)
      }
      this.currentSession = null
      this.saveToStorage()
    }
  }

  // Analytics queries
  getBlockClickStats() {
    const blockClicks = this.events.filter(e => e.type === 'block_click')
    const stats = new Map<string, { count: number, name: string }>()
    
    blockClicks.forEach(event => {
      const data = event.data as BlockClickData
      const existing = stats.get(data.blockId) || { count: 0, name: data.blockName }
      existing.count++
      stats.set(data.blockId, existing)
    })

    return Array.from(stats.entries()).map(([id, data]) => ({
      blockId: id,
      blockName: data.name,
      clickCount: data.count
    })).sort((a, b) => b.clickCount - a.clickCount)
  }

  getTopQuestions(limit: number = 10) {
    const questions = this.events.filter(e => e.type === 'question_asked')
    const questionCounts = new Map<string, { count: number, topic?: string }>()
    
    questions.forEach(event => {
      const data = event.data as QuestionData
      const existing = questionCounts.get(data.question) || { count: 0, topic: data.topic }
      existing.count++
      questionCounts.set(data.question, existing)
    })

    return Array.from(questionCounts.entries())
      .map(([question, data]) => ({ question, count: data.count, topic: data.topic }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  getSessionStats() {
    const sessions = Array.from(this.sessions.values())
    const activeSessions = sessions.filter(s => !s.endTime)
    const completedSessions = sessions.filter(s => s.endTime)
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      averageSessionTime: completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.totalTime || 0), 0) / completedSessions.length 
        : 0,
      totalEvents: this.events.length
    }
  }

  getPageStats() {
    const pageViews = this.events.filter(e => e.type === 'page_view')
    const pageStats = new Map<string, { views: number, totalTime: number }>()
    
    pageViews.forEach(event => {
      const data = event.data as PageViewData
      const existing = pageStats.get(data.page) || { views: 0, totalTime: 0 }
      existing.views++
      existing.totalTime += data.timeSpent
      pageStats.set(data.page, existing)
    })

    return Array.from(pageStats.entries()).map(([page, stats]) => ({
      page,
      views: stats.views,
      averageTime: stats.views > 0 ? stats.totalTime / stats.views : 0
    }))
  }

  exportData() {
    return {
      events: this.events,
      sessions: Array.from(this.sessions.entries()),
      exportedAt: new Date().toISOString()
    }
  }

  clearData() {
    this.events = []
    this.sessions.clear()
    this.currentSession = null
    localStorage.removeItem('volleyinsight-analytics-events')
    localStorage.removeItem('volleyinsight-analytics-sessions')
  }
}

// Singleton instance
export const analytics = new AnalyticsTracker()

// Hook for React components
export function useAnalytics() {
  return {
    trackBlockClick: (blockId: string, blockName: string, fromPage?: string) => 
      analytics.trackBlockClick(blockId, blockName, fromPage),
    trackQuestion: (question: string, topic?: string, responseLength?: number, hasContext?: boolean, sourcesCount?: number) => 
      analytics.trackQuestion(question, topic, responseLength, hasContext, sourcesCount),
    trackPageView: (page: string, timeSpent?: number, referrer?: string) => 
      analytics.trackPageView(page, timeSpent, referrer),
    endSession: () => analytics.endSession()
  }
}
