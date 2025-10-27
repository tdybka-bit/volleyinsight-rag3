'use client';

import { useState } from 'react';
import TaskCard from './TaskCard';
import { Task } from '@/app/tasks/page';

interface TaskColumnProps {
  title: string;
  status: Task['status'];
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: Task['status']) => void;
  onReorderTask: (taskId: string, newOrder: number, status: Task['status']) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  getCategoryColor: (category: Task['category']) => string;
}

export default function TaskColumn({
  title,
  status,
  tasks,
  onMoveTask,
  onReorderTask,
  onUpdateTask,
  onDeleteTask,
  getCategoryColor,
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);
  const [lastDropTime, setLastDropTime] = useState<number>(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDraggedOverIndex(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDraggedOverIndex(null);
    setDragOverPosition(null);
    
    const taskId = e.dataTransfer.getData('text/plain');
    const sourceStatus = e.dataTransfer.getData('text/status') as Task['status'];
    
    if (taskId) {
      if (sourceStatus === status) {
        // Sortowanie wewnątrz sekcji - użyj pozycji na końcu listy
        onReorderTask(taskId, tasks.length - 1, status);
      } else {
        // Przenoszenie między sekcjami
        onMoveTask(taskId, status);
      }
    }
  };

  const handleTaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDraggedOverIndex(index);
    
    // Określ czy przeciągamy nad górną czy dolną połową elementu
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (y < height / 2) {
      setDragOverPosition('top');
    } else {
      setDragOverPosition('bottom');
    }
  };

  const handleTaskDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation(); // Zatrzymaj propagację eventu
    
    const taskId = e.dataTransfer.getData('text/plain');
    const sourceStatus = e.dataTransfer.getData('text/status') as Task['status'];
    
    setDraggedOverIndex(null);
    setDragOverPosition(null);
    
    if (taskId && sourceStatus === status) {
      // Proste podejście - użyj targetIndex bezpośrednio
      onReorderTask(taskId, targetIndex, status);
    } else if (taskId) {
      onMoveTask(taskId, status);
    }
  };

  const getColumnColor = () => {
    switch (status) {
      case 'todo':
        return 'border-blue-500/30 bg-blue-900/10';
      case 'in-progress':
        return 'border-yellow-500/30 bg-yellow-900/10';
      case 'done':
        return 'border-green-500/30 bg-green-900/10';
      case 'parking-lot':
        return 'border-gray-500/30 bg-gray-900/10';
      default:
        return 'border-gray-500/30 bg-gray-900/10';
    }
  };

  const getHeaderColor = () => {
    switch (status) {
      case 'todo':
        return 'text-blue-300';
      case 'in-progress':
        return 'text-yellow-300';
      case 'done':
        return 'text-green-300';
      case 'parking-lot':
        return 'text-gray-300';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div
      className={`min-h-[600px] rounded-lg border-2 border-dashed transition-all duration-200 ${
        isDragOver 
          ? 'border-opacity-60 bg-opacity-20 scale-105' 
          : getColumnColor()
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-white/10">
        <h2 className={`text-lg font-semibold ${getHeaderColor()}`}>
          {title} ({tasks.length})
        </h2>
      </div>

      {/* Tasks Container */}
      <div className="p-3 space-y-2 min-h-[500px]">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-xs">Brak zadań</p>
            <p className="text-xs mt-1">Przeciągnij zadanie tutaj</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <div 
              key={task.id}
              onDrop={(e) => handleTaskDrop(e, index)}
              onDragOver={(e) => handleTaskDragOver(e, index)}
              className={`transition-all duration-200 ${
                draggedOverIndex === index ? 'bg-blue-500/20 rounded-lg' : ''
              }`}
            >
              {/* Wskaźnik pozycji przed zadaniem */}
              {draggedOverIndex === index && dragOverPosition === 'top' && (
                <div className="h-1 bg-blue-500 rounded-full mb-2 mx-2"></div>
              )}
              
              <TaskCard
                task={task}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
                getCategoryColor={getCategoryColor}
              />
              
              {/* Wskaźnik pozycji po zadaniu */}
              {draggedOverIndex === index && dragOverPosition === 'bottom' && (
                <div className="h-1 bg-blue-500 rounded-full mt-2 mx-2"></div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
