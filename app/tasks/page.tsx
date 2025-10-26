'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TaskColumn from '@/components/TaskColumn';
import TaskForm from '@/components/TaskForm';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'Frontend' | 'Backend' | 'Scraping' | 'Data' | 'RAG' | 'Other';
  status: 'todo' | 'in-progress' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

const CATEGORIES = ['Frontend', 'Backend', 'Scraping', 'Data', 'RAG', 'Other'] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Load tasks from localStorage on component mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        }));
        setTasks(parsedTasks);
      } catch (error) {
        console.error('Error parsing saved tasks:', error);
      }
    }
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTasks(prev => [...prev, newTask]);
    setShowForm(false);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, ...updates, updatedAt: new Date() }
          : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    updateTask(taskId, { status: newStatus });
  };

  const getTasksByStatus = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

  const getCategoryColor = (category: Task['category']) => {
    const colors = {
      Frontend: 'bg-blue-500',
      Backend: 'bg-green-500',
      Scraping: 'bg-purple-500',
      Data: 'bg-yellow-500',
      RAG: 'bg-pink-500',
      Other: 'bg-gray-500',
    };
    return colors[category];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-blue-800/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex space-x-8">
              <Link href="/" className="text-orange-400 hover:text-orange-300 font-semibold">
                Home
              </Link>
              <Link href="/tasks" className="text-white font-semibold">
                Task Tracker
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Task Tracker</h1>
          <p className="text-blue-200">Zarządzaj swoimi zadaniami w trzech kolumnach</p>
        </div>

        {/* Add Task Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            + Dodaj nowe zadanie
          </button>
        </div>

        {/* Task Form Modal */}
        {showForm && (
          <TaskForm
            categories={CATEGORIES}
            onSubmit={addTask}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Task Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TaskColumn
            title="To Do"
            status="todo"
            tasks={getTasksByStatus('todo')}
            onMoveTask={moveTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            getCategoryColor={getCategoryColor}
          />
          <TaskColumn
            title="In Progress"
            status="in-progress"
            tasks={getTasksByStatus('in-progress')}
            onMoveTask={moveTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            getCategoryColor={getCategoryColor}
          />
          <TaskColumn
            title="Done"
            status="done"
            tasks={getTasksByStatus('done')}
            onMoveTask={moveTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            getCategoryColor={getCategoryColor}
          />
        </div>
      </div>
    </div>
  );
}
