'use client'

import { useState } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'

export default function ZagrywkaPage() {
  const [materials, setMaterials] = useState([
    {
      id: 'zagrywka-1',
      title: 'Podstawy techniki zagrywki',
      type: 'text' as const,
      duration: '10 min',
      completed: true,
      description: 'Prawidłowa technika zagrywki i ustawienie ciała.'
    },
    {
      id: 'zagrywka-2',
      title: 'Rodzaje zagrywek',
      type: 'video' as const,
      duration: '16 min',
      completed: true,
      description: 'Różne rodzaje zagrywek: float, jump serve, topspin.'
    },
    {
      id: 'zagrywka-3',
      title: 'Strategia zagrywki',
      type: 'interactive' as const,
      duration: '18 min',
      completed: false,
      description: 'Jak wybierać kierunek i rodzaj zagrywki.'
    },
    {
      id: 'zagrywka-4',
      title: 'Zagrywka pod presją',
      type: 'text' as const,
      duration: '12 min',
      completed: false,
      description: 'Jak radzić sobie ze stresem przy zagrywce.'
    },
    {
      id: 'zagrywka-5',
      title: 'Analiza przyjęcia przeciwnika',
      type: 'video' as const,
      duration: '14 min',
      completed: false,
      description: 'Jak analizować słabe punkty przyjęcia przeciwnika.'
    }
  ])

  const keySkills = [
    'Prawidłowa technika zagrywki',
    'Różne rodzaje zagrywek',
    'Strategia i wybór kierunku',
    'Radzenie sobie ze stresem',
    'Analiza przeciwnika',
    'Konsystencja zagrywki'
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
          topic="zagrywka"
          topicName="Zagrywka"
          emoji="🏐"
          description="Rodzaje i techniki zagrywek"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="zagrywka"
              topicName="Zagrywka"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="zagrywka"
                topicName="Zagrywka"
              />
            </div>
            
            <ProgressTracker
              topic="zagrywka"
              topicName="Zagrywka"
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
