'use client'

import { useState } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'

export default function AtakPage() {
  const [materials, setMaterials] = useState([
    {
      id: 'atak-1',
      title: 'Podstawy techniki ataku',
      type: 'text' as const,
      duration: '12 min',
      completed: true,
      description: 'Prawidłowa technika ataku i ustawienie ciała.'
    },
    {
      id: 'atak-2',
      title: 'Rozbieg i wyskok',
      type: 'video' as const,
      duration: '18 min',
      completed: true,
      description: 'Technika rozbiegu i wyskoku przy ataku.'
    },
    {
      id: 'atak-3',
      title: 'Rodzaje ataków',
      type: 'interactive' as const,
      duration: '20 min',
      completed: false,
      description: 'Różne rodzaje ataków: power, tip, roll shot.'
    },
    {
      id: 'atak-4',
      title: 'Atak z różnych pozycji',
      type: 'text' as const,
      duration: '15 min',
      completed: false,
      description: 'Techniki ataku z różnych pozycji na boisku.'
    },
    {
      id: 'atak-5',
      title: 'Analiza bloku przeciwnika',
      type: 'video' as const,
      duration: '16 min',
      completed: false,
      description: 'Jak analizować blok przeciwnika i wybierać kierunek ataku.'
    }
  ])

  const keySkills = [
    'Prawidłowa technika ataku',
    'Rozbieg i wyskok',
    'Różne rodzaje ataków',
    'Czytanie bloku przeciwnika',
    'Wybór kierunku ataku',
    'Koordynacja z rozgrywającym'
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
          topic="atak"
          topicName="Atak"
          emoji="⚡"
          description="Skuteczne ataki i finisze"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="atak"
              topicName="Atak"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="atak"
                topicName="Atak"
              />
            </div>
            
            <ProgressTracker
              topic="atak"
              topicName="Atak"
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
