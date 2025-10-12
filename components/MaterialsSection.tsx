'use client'

import { BookOpen, Play, CheckCircle, Clock, FileText, Video, Image } from 'lucide-react'

interface Material {
  id: string
  title: string
  type: 'text' | 'video' | 'image' | 'interactive'
  duration?: string
  completed: boolean
  description: string
}

interface MaterialsSectionProps {
  topic: string
  topicName: string
  materials: Material[]
  onMaterialComplete: (materialId: string) => void
}

export default function MaterialsSection({ 
  topic, 
  topicName, 
  materials, 
  onMaterialComplete 
}: MaterialsSectionProps) {
  const getMaterialIcon = (type: Material['type']) => {
    switch (type) {
      case 'video': return Video
      case 'image': return Image
      case 'interactive': return Play
      default: return FileText
    }
  }

  const getMaterialColor = (type: Material['type']) => {
    switch (type) {
      case 'video': return 'text-red-500'
      case 'image': return 'text-green-500'
      case 'interactive': return 'text-purple-500'
      default: return 'text-blue-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-foreground flex items-center">
          <BookOpen className="w-6 h-6 mr-3" />
          Materiały do nauki - {topicName}
        </h3>
        <div className="text-sm text-muted-foreground">
          {materials.filter(m => m.completed).length} / {materials.length} ukończone
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materials.map((material) => {
          const IconComponent = getMaterialIcon(material.type)
          const iconColor = getMaterialColor(material.type)
          
          return (
            <div
              key={material.id}
              className={`glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-lg ${
                material.completed ? 'opacity-75' : 'hover:scale-105'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      material.completed ? 'bg-green-500/20' : 'bg-primary/20'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-card-foreground">{material.title}</h4>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span className="capitalize">{material.type}</span>
                      {material.duration && (
                        <>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{material.duration}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {material.completed ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <button
                    onClick={() => onMaterialComplete(material.id)}
                    className="px-3 py-1 text-xs text-white rounded-lg transition-all hover:scale-105"
                    style={{ 
                      background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                    }}
                  >
                    Oznacz jako ukończone
                  </button>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">{material.description}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      material.completed ? 'bg-green-500' : 'bg-muted-foreground'
                    }`}
                  ></div>
                  <span className="text-xs text-muted-foreground">
                    {material.completed ? 'Ukończone' : 'Do ukończenia'}
                  </span>
                </div>
                
                <button className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Rozpocznij naukę →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}











