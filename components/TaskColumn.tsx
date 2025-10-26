'use client';

import { useState } from 'react';
import TaskCard from './TaskCard';
import { Task } from '@/app/tasks/page';

interface TaskColumnProps {
  title: string;
  status: Task['status'];
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: Task['status']) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  getCategoryColor: (category: Task['category']) => string;
}

export default function TaskColumn({
  title,
  status,
  tasks,
  onMoveTask,
  onUpdateTask,
  onDeleteTask,
  getCategoryColor,
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
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
      <div className="p-4 border-b border-white/10">
        <h2 className={`text-xl font-semibold ${getHeaderColor()}`}>
          {title}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {tasks.length} zadanie{tasks.length !== 1 ? 'a' : ''}
        </p>
      </div>

      {/* Tasks Container */}
      <div className="p-4 space-y-3 min-h-[500px]">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">Brak zadań</p>
            <p className="text-xs mt-1">Przeciągnij zadanie tutaj</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={onUpdateTask}
              onDelete={onDeleteTask}
              getCategoryColor={getCategoryColor}
            />
          ))
        )}
      </div>
    </div>
  );
}
