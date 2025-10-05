'use client'

import { TrendingUp, CheckCircle, Clock, BookOpen } from 'lucide-react'

interface ProgressTrackerProps {
  topic: string
  topicName: string
  progress: number
  totalMaterials: number
  completedMaterials: number
  keySkills: string[]
}

export default function ProgressTracker({ 
  topic, 
  topicName, 
  progress, 
  totalMaterials, 
  completedMaterials, 
  keySkills 
}: ProgressTrackerProps) {
  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-card-foreground flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Postęp w nauce
          </h3>
          <span className="text-2xl font-bold text-primary">{progress}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-3 mb-4">
          <div 
            className="h-3 rounded-full transition-all duration-500"
            style={{ 
              width: `${progress}%`,
              background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))`
            }}
          ></div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground">Ukończone:</span>
            <span className="font-semibold text-card-foreground">{completedMaterials}</span>
          </div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-muted-foreground">Wszystkie:</span>
            <span className="font-semibold text-card-foreground">{totalMaterials}</span>
          </div>
        </div>
      </div>

      {/* Key Skills */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Kluczowe umiejętności
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {keySkills.map((skill, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ 
                  background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                }}
              ></div>
              <span className="text-card-foreground">{skill}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}




