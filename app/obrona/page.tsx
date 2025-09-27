'use client'

import { useState } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'

export default function ObronaPage() {
  const [materials, setMaterials] = useState([
    {
      id: 'obrona-1',
      title: 'Podstawy pozycji obronnej',
      type: 'text' as const,
      duration: '8 min',
      completed: true,
      description: 'Prawidłowa pozycja ciała i ustawienie w obronie.'
    },
    {
      id: 'obrona-2',
      title: 'Technika przyjęcia piłki',
      type: 'video' as const,
      duration: '12 min',
      completed: true,
      description: 'Podstawowe techniki przyjęcia piłki w obronie.'
    },
    {
      id: 'obrona-3',
      title: 'Ruch w obronie',
      type: 'interactive' as const,
      duration: '15 min',
      completed: false,
      description: 'Jak poruszać się po boisku w obronie.'
    },
    {
      id: 'obrona-4',
      title: 'Obrona na różnych pozycjach',
      type: 'text' as const,
      duration: '10 min',
      completed: false,
      description: 'Specyfika obrony z różnych pozycji na boisku.'
    },
    {
      id: 'obrona-5',
      title: 'Komunikacja w obronie',
      type: 'video' as const,
      duration: '14 min',
      completed: false,
      description: 'Jak komunikować się z zespołem w obronie.'
    }
  ])

  const keySkills = [
    'Prawidłowa pozycja obronna',
    'Technika przyjęcia piłki',
    'Ruch i przemieszczanie się',
    'Czytanie ataku przeciwnika',
    'Komunikacja z zespołem',
    'Przejście z obrony do ataku'
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
          topic="obrona"
          topicName="Obrona"
          emoji="🛡️"
          description="Podstawy obrony w siatkówce"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="obrona"
              topicName="Obrona"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="obrona"
                topicName="Obrona"
              />
            </div>
            
            <ProgressTracker
              topic="obrona"
              topicName="Obrona"
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
