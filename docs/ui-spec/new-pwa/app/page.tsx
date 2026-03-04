'use client'

import { useState, useCallback } from 'react'
import { AppHeader } from '@/components/app-header'
import { JourneyMap } from '@/components/journey-map'
import { BottomNav } from '@/components/bottom-nav'
import { SessionSheet } from '@/components/session-sheet'
import { StatsView } from '@/components/stats-view'
import { ProfileView } from '@/components/profile-view'
import { type SessionNode } from '@/lib/map-data'

type Tab = 'map' | 'stats' | 'my'

export default function Page() {
  // Current active session (1-indexed, user progresses through them)
  const [currentSession, setCurrentSession] = useState(8)
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [selectedSession, setSelectedSession] = useState<SessionNode | null>(null)

  const completedCount = currentSession - 1

  const handleNodeTap = useCallback((session: SessionNode) => {
    setSelectedSession(session)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedSession(null)
  }, [])

  const handleCompleteSession = useCallback((id: number) => {
    if (id === currentSession) {
      setCurrentSession(prev => Math.min(prev + 1, 21))
      setSelectedSession(null)
    }
  }, [currentSession])

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-background">
      <AppHeader completed={completedCount} total={20} />

      {activeTab === 'map' && (
        <JourneyMap
          currentSession={currentSession}
          onNodeTap={handleNodeTap}
        />
      )}
      {activeTab === 'stats' && (
        <StatsView completed={completedCount} currentSession={currentSession} />
      )}
      {activeTab === 'my' && (
        <ProfileView completed={completedCount} />
      )}

      <BottomNav active={activeTab} onTabChange={setActiveTab} />

      <SessionSheet
        session={selectedSession}
        isCompleted={selectedSession ? selectedSession.id < currentSession : false}
        isCurrent={selectedSession ? selectedSession.id === currentSession : false}
        onClose={handleCloseSheet}
        onComplete={handleCompleteSession}
      />
    </div>
  )
}
