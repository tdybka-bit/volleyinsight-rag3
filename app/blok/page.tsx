'use client'

import { useState, useEffect } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'
import { useAnalytics } from '../../lib/analytics'

export default function BlokPage() {
  const { trackPageView } = useAnalytics()
  const [materials, setMaterials] = useState([
    {
      id: 'blok-1',
      title: 'Podstawy techniki bloku',
      type: 'text' as const,
      duration: '10 min',
      completed: true,
      description: 'Poznaj podstawowe zasady ustawienia i techniki bloku w siatkówce.'
    },
    {
      id: 'blok-2',
      title: 'Timing i koordynacja',
      type: 'video' as const,
      duration: '15 min',
      completed: true,
      description: 'Naucz się prawidłowego timingu i koordynacji z partnerem przy bloku.'
    },
    {
      id: 'blok-3',
      title: 'Blok pojedynczy vs podwójny',
      type: 'interactive' as const,
      duration: '20 min',
      completed: false,
      description: 'Zrozum różnice między blokiem pojedynczym a podwójnym.'
    },
    {
      id: 'blok-4',
      title: 'Blok na różnych pozycjach',
      type: 'text' as const,
      duration: '12 min',
      completed: false,
      description: 'Techniki bloku z różnych pozycji na boisku.'
    },
    {
      id: 'blok-5',
      title: 'Analiza przeciwnika',
      type: 'video' as const,
      duration: '18 min',
      completed: false,
      description: 'Jak analizować przeciwnika i przewidywać jego ataki.'
    }
  ])

  const keySkills = [
    'Prawidłowe ustawienie rąk i ciała',
    'Timing i koordynacja z partnerem',
    'Czytanie ataku przeciwnika',
    'Blok pojedynczy i podwójny',
    'Przejście z bloku do obrony',
    'Komunikacja z zespołem'
  ]


  const completedMaterials = materials.filter(m => m.completed).length
  const progress = Math.round((completedMaterials / materials.length) * 100)

  // Track page view
  useEffect(() => {
    trackPageView('blok')
  }, [trackPageView])

  const handleMaterialComplete = (materialId: string) => {
    setMaterials(prev => 
      prev.map(material => 
        material.id === materialId 
          ? { ...material, completed: true }
          : material
      )
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="container mx-auto px-4 py-6">
        <TopicHeader
          topic="blok"
          topicName="Blok"
          emoji="🛡️"
          description="Technika i taktyka bloku w siatkówce"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="blok"
              topicName="Blok"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="blok"
                topicName="Blok"
              />
            </div>
            
            <ProgressTracker
              topic="blok"
              topicName="Blok"
              progress={progress}
              totalMaterials={materials.length}
              completedMaterials={completedMaterials}
              keySkills={keySkills}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
