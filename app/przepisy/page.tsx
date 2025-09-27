'use client'

import { useState } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'

export default function PrzepisyPage() {
  const [materials, setMaterials] = useState([
    {
      id: 'przepisy-1',
      title: 'Podstawowe przepisy gry',
      type: 'text' as const,
      duration: '15 min',
      completed: true,
      description: 'Najważniejsze przepisy siatkówki według FIVB.'
    },
    {
      id: 'przepisy-2',
      title: 'Przepisy dotyczące zagrywki',
      type: 'video' as const,
      duration: '12 min',
      completed: true,
      description: 'Szczegółowe przepisy dotyczące zagrywki i jej wykonywania.'
    },
    {
      id: 'przepisy-3',
      title: 'Przepisy dotyczące bloku',
      type: 'interactive' as const,
      duration: '14 min',
      completed: false,
      description: 'Regulamin dotyczący bloku i jego wykonywania.'
    },
    {
      id: 'przepisy-4',
      title: 'Przepisy dotyczące ataku',
      type: 'text' as const,
      duration: '16 min',
      completed: false,
      description: 'Zasady dotyczące ataku i jego wykonywania.'
    },
    {
      id: 'przepisy-5',
      title: 'Interpretacje sędziowskie',
      type: 'video' as const,
      duration: '18 min',
      completed: false,
      description: 'Najczęstsze interpretacje sędziowskie i kontrowersyjne sytuacje.'
    }
  ])

  const keySkills = [
    'Znajomość podstawowych przepisów',
    'Przepisy dotyczące zagrywki',
    'Regulamin bloku i ataku',
    'Interpretacje sędziowskie',
    'Kontrowersyjne sytuacje',
    'Aktualizacje przepisów'
  ]


  const completedMaterials = materials.filter(m => m.completed).length
  const progress = Math.round((completedMaterials / materials.length) * 100)

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
          topic="przepisy"
          topicName="Przepisy"
          emoji="📋"
          description="Zasady i regulamin gry"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="przepisy"
              topicName="Przepisy"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="przepisy"
                topicName="Przepisy"
              />
            </div>
            
            <ProgressTracker
              topic="przepisy"
              topicName="Przepisy"
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
