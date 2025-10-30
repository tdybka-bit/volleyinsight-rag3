'use client';

import { useState } from 'react';
import { Task } from '@/app/tasks/page';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onCopy: (task: Task) => void;
  getCategoryColor: (category: Task['category']) => string;
}

export default function TaskCard({
  task,
  onUpdate,
  onDelete,
  onCopy,
  getCategoryColor,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description,
    category: task.category,
  });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('text/status', task.status);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(task.id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      title: task.title,
      description: task.description,
      category: task.category,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Czy na pewno chcesz usunąć to zadanie?')) {
      onDelete(task.id);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3 cursor-move hover:bg-white/15 transition-all duration-200 hover:scale-105 hover:shadow-lg"
    >
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            className="w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Tytuł zadania"
          />
          <textarea
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            className="w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={2}
            placeholder="Opis zadania"
          />
          <select
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value as Task['category'] })}
            className="w-full bg-slate-700 border border-white/30 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            style={{ backgroundColor: '#334155' }}
          >
            <option value="Frontend" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Frontend</option>
            <option value="Backend" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Backend</option>
            <option value="Scraping" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Scraping</option>
            <option value="Data" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Data</option>
            <option value="RAG" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>RAG</option>
            <option value="Other" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Other</option>
          </select>
          <div className="flex space-x-1">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
            >
              Zapisz
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Category Badge */}
          <div className="flex justify-between items-start mb-1">
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-medium text-white ${getCategoryColor(task.category)}`}
            >
              {task.category}
            </span>
            <div className="flex space-x-1">
              <button
                onClick={handleEdit}
                className="text-gray-400 hover:text-white transition-colors text-xs"
                title="Edytuj"
              >
                ✏️
              </button>
              <button
                onClick={() => onCopy(task)}
                className="text-gray-400 hover:text-blue-400 transition-colors text-xs"
                title="Kopiuj zadanie"
              >
                📋
              </button>
              <button
                onClick={handleDelete}
                className="text-gray-400 hover:text-red-400 transition-colors text-xs"
                title="Usuń"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Task Title */}
          <h3 className="text-white font-semibold mb-1 text-sm line-clamp-2">
            {task.title}
          </h3>

          {/* Task Description */}
          {task.description && (
            <p className="text-gray-300 text-xs mb-2 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Task Meta */}
          <div className="text-xs text-gray-400">
            <p className="text-xs">{formatDate(task.createdAt)}</p>
          </div>
        </>
      )}
    </div>
  );
}
