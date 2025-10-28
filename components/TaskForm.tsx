'use client';

import { useState } from 'react';
import { Task } from '@/app/tasks/page';

interface TaskFormProps {
  categories: readonly Task['category'][];
  onSubmit: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function TaskForm({ categories, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Frontend' as Task['category'],
    status: 'todo' as Task['status'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSubmit(formData);
      setFormData({
        title: '',
        description: '',
        category: 'Frontend',
        status: 'todo',
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-sm border border-white/20 rounded-lg p-4 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">Dodaj nowe zadanie</h2>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-xs font-medium text-gray-300 mb-1">
              Tytuł *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="Wprowadź tytuł zadania"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-300 mb-1">
              Opis
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
              placeholder="Wprowadź opis zadania (opcjonalnie)"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-xs font-medium text-gray-300 mb-1">
              Kategoria
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-white/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              {categories.map((category) => (
                <option key={category} value={category} className="bg-slate-800">
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-white/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="todo" className="bg-slate-800">To Do</option>
              <option value="in-progress" className="bg-slate-800">In Progress</option>
              <option value="done" className="bg-slate-800">Done</option>
              <option value="parking-lot" className="bg-slate-800">Parking Lot</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex space-x-2 pt-3">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
            >
              Dodaj zadanie
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 text-sm"
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
