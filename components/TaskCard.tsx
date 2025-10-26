'use client';

import { useState } from 'react';
import { Task } from '@/app/tasks/page';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  getCategoryColor: (category: Task['category']) => string;
}

export default function TaskCard({
  task,
  onUpdate,
  onDelete,
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
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 cursor-move hover:bg-white/15 transition-all duration-200 hover:scale-105 hover:shadow-lg"
    >
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Tytuł zadania"
          />
          <textarea
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={3}
            placeholder="Opis zadania"
          />
          <select
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value as Task['category'] })}
            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="Scraping">Scraping</option>
            <option value="Data">Data</option>
            <option value="RAG">RAG</option>
            <option value="Other">Other</option>
          </select>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Zapisz
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Category Badge */}
          <div className="flex justify-between items-start mb-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(task.category)}`}
            >
              {task.category}
            </span>
            <div className="flex space-x-1">
              <button
                onClick={handleEdit}
                className="text-gray-400 hover:text-white transition-colors"
                title="Edytuj"
              >
                ✏️
              </button>
              <button
                onClick={handleDelete}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Usuń"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Task Title */}
          <h3 className="text-white font-semibold mb-2 line-clamp-2">
            {task.title}
          </h3>

          {/* Task Description */}
          {task.description && (
            <p className="text-gray-300 text-sm mb-3 line-clamp-3">
              {task.description}
            </p>
          )}

          {/* Task Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Utworzone: {formatDate(task.createdAt)}</p>
            {task.updatedAt.getTime() !== task.createdAt.getTime() && (
              <p>Zaktualizowane: {formatDate(task.updatedAt)}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
