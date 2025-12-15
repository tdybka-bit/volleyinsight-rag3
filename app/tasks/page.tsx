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
  status: 'todo' | 'in-progress' | 'done' | 'parking-lot';
  order: number;
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
        const parsedTasks = JSON.parse(savedTasks).map((task: any, index: number) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          // Dodaj pole order jeśli nie istnieje (migracja starych danych)
          order: task.order || index + 1,
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

  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => {
    // Znajdź wszystkie zadania w tym samym statusie
    const tasksInStatus = tasks.filter(task => task.status === taskData.status);
    
    // Przesuń wszystkie istniejące zadania w tym statusie o 1 w dół (zwiększ ich order)
    const updatedTasks = tasks.map(task => 
      task.status === taskData.status 
        ? { ...task, order: (task.order || 0) + 1, updatedAt: new Date() }
        : task
    );
    
    // Utwórz nowe zadanie z order = 0 (na górze)
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setTasks(prev => [...updatedTasks, newTask]);
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

  const copyTask = (originalTask: Task) => {
    // Przesuń wszystkie istniejące zadania w tym samym statusie o 1 w dół
    const updatedTasks = tasks.map(task => 
      task.status === originalTask.status 
        ? { ...task, order: (task.order || 0) + 1, updatedAt: new Date() }
        : task
    );
    
    // Utwórz skopiowane zadanie z order = 0 (na górze)
    const copiedTask: Task = {
      ...originalTask,
      id: Date.now().toString(),
      title: `${originalTask.title} (kopia)`,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setTasks(prev => [...updatedTasks, copiedTask]);
  };

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    setTasks(prev => {
      const taskToMove = prev.find(task => task.id === taskId);
      if (!taskToMove) return prev;
      
      // Znajdź maksymalny order w nowej sekcji
      const tasksInNewStatus = prev.filter(task => task.status === newStatus);
      const maxOrder = tasksInNewStatus.length > 0 ? Math.max(...tasksInNewStatus.map(t => t.order || 0)) : 0;
      
      return prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: newStatus, 
              order: maxOrder + 1,
              updatedAt: new Date() 
            }
          : task
      );
    });
  };

  const reorderTask = (taskId: string, newOrder: number, status: Task['status']) => {
    setTasks(prev => {
      // Znajdź wszystkie zadania w tej sekcji
      const tasksInStatus = prev.filter(task => task.status === status);
      const sortedTasks = tasksInStatus.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Znajdź zadanie do przesunięcia
      const taskToMove = sortedTasks.find(task => task.id === taskId);
      if (!taskToMove) {
        return prev;
      }
      
      const currentIndex = sortedTasks.findIndex(task => task.id === taskId);
      
      // Jeśli ta sama pozycja, nie rób nic
      if (currentIndex === newOrder) {
        return prev;
      }
      
      // Utwórz nową tablicę z przesuniętym zadaniem
      const newTasks = [...sortedTasks];
      const [movedTask] = newTasks.splice(currentIndex, 1);
      newTasks.splice(newOrder, 0, movedTask);
      
      // Przypisz nowe order
      const reorderedTasks = newTasks.map((task, index) => ({
        ...task,
        order: index + 1,
        updatedAt: new Date()
      }));
      
      // Połącz z zadaniami z innych sekcji
      const otherTasks = prev.filter(task => task.status !== status);
      return [...otherTasks, ...reorderedTasks];
    });
  };

  const getTasksByStatus = (status: Task['status']) => {
    return tasks
      .filter(task => task.status === status)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900/20 to-green-900/30">
      {/* Navigation */}
      <nav className="border-b border-yellow-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex space-x-8">
              <Link href="/" className="text-yellow-400 hover:text-yellow-300 font-semibold">
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
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Task Tracker</h1>
              <p className="text-green-200 text-sm">Zarządzaj swoimi zadaniami w trzech kolumnach</p>
            </div>
            {/* Add Task Button */}
            <button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-yellow-500 to-green-600 hover:from-yellow-600 hover:to-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
            >
              + Dodaj nowe zadanie
            </button>
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <TaskColumn
            title="To Do"
            status="todo"
            tasks={getTasksByStatus('todo')}
            onMoveTask={moveTask}
            onReorderTask={reorderTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onCopyTask={copyTask}
            getCategoryColor={getCategoryColor}
          />
          <TaskColumn
            title="In Progress"
            status="in-progress"
            tasks={getTasksByStatus('in-progress')}
            onMoveTask={moveTask}
            onReorderTask={reorderTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onCopyTask={copyTask}
            getCategoryColor={getCategoryColor}
          />
          <TaskColumn
            title="Done"
            status="done"
            tasks={getTasksByStatus('done')}
            onMoveTask={moveTask}
            onReorderTask={reorderTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onCopyTask={copyTask}
            getCategoryColor={getCategoryColor}
          />
          <TaskColumn
            title="Parking Lot"
            status="parking-lot"
            tasks={getTasksByStatus('parking-lot')}
            onMoveTask={moveTask}
            onReorderTask={reorderTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onCopyTask={copyTask}
            getCategoryColor={getCategoryColor}
          />
        </div>
      </div>
    </div>
  );
}
