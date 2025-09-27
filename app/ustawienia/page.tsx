'use client'

import { useState } from 'react'
import TopicHeader from '../../components/TopicHeader'
import TopicChat from '../../components/TopicChat'
import ProgressTracker from '../../components/ProgressTracker'
import MaterialsSection from '../../components/MaterialsSection'

export default function UstawieniaPage() {
  const [materials, setMaterials] = useState([
    {
      id: 'ustawienia-1',
      title: 'Podstawy techniki ustawiania',
      type: 'text' as const,
      duration: '12 min',
      completed: true,
      description: 'Prawidłowa technika ustawiania piłki i ustawienie ciała.'
    },
    {
      id: 'ustawienia-2',
      title: 'Różne rodzaje ustawień',
      type: 'video' as const,
      duration: '20 min',
      completed: true,
      description: 'Różne rodzaje ustawień: szybkie, wysokie, z tyłu, z przodu.'
    },
    {
      id: 'ustawienia-3',
      title: 'Komunikacja z atakującymi',
      type: 'interactive' as const,
      duration: '16 min',
      completed: false,
      description: 'Jak komunikować się z atakującymi i koordynować ataki.'
    },
    {
      id: 'ustawienia-4',
      title: 'Ustawienia w różnych sytuacjach',
      type: 'text' as const,
      duration: '14 min',
      completed: false,
      description: 'Jak dostosować ustawienia do różnych sytuacji w grze.'
    },
    {
      id: 'ustawienia-5',
      title: 'Analiza atakujących',
      type: 'video' as const,
      duration: '18 min',
      completed: false,
      description: 'Jak analizować preferencje i możliwości atakujących.'
    }
  ])

  const keySkills = [
    'Prawidłowa technika ustawiania',
    'Różne rodzaje ustawień',
    'Komunikacja z atakującymi',
    'Czytanie sytuacji w grze',
    'Dostosowanie do atakujących',
    'Konsystencja ustawień'
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
          topic="ustawienia"
          topicName="Ustawienia"
          emoji="⚙️"
          description="Prawidłowe ustawianie piłki"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Materials */}
          <div className="lg:col-span-2 space-y-6">
            <MaterialsSection
              topic="ustawienia"
              topicName="Ustawienia"
              materials={materials}
              onMaterialComplete={handleMaterialComplete}
            />
          </div>

          {/* Right Column - Chat & Progress */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl h-96">
              <TopicChat
                topic="ustawienia"
                topicName="Ustawienia"
              />
            </div>
            
            <ProgressTracker
              topic="ustawienia"
              topicName="Ustawienia"
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
