'use client';

import { useState, useEffect } from 'react';

interface Idea {
  id: string;
  idea: string;
  priority: string;
  classification: {
    type: string;
    title: string;
    description: string;
    category: string;
  };
  status: string;
  created_at: string;
}

export default function IdeasReviewPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchIdeas();
  }, [filter, statusFilter]);

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      let url = '/api/submit-idea?limit=100';
      if (filter !== 'all') url += `&type=${filter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;

      const response = await fetch(url);
      const data = await response.json();
      setIdeas(data.ideas || []);
    } catch (error) {
      console.error('Error fetching ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    // TODO: Add PATCH endpoint to update status
    console.log('Update status:', id, newStatus);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'commentary_training': return '💬';
      case 'feature_request': return '✨';
      case 'bug_fix': return '🐛';
      case 'ui_ux_improvement': return '🎨';
      default: return '💡';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'commentary_training': return 'bg-purple-100 text-purple-700';
      case 'feature_request': return 'bg-blue-100 text-blue-700';
      case 'bug_fix': return 'bg-red-100 text-red-700';
      case 'ui_ux_improvement': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📋 Ideas Review</h1>
              <p className="text-gray-600">Wszystkie zgłoszone pomysły i feedback</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{ideas.length}</p>
              <p className="text-sm text-gray-600">Total Ideas</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Type:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="commentary_training">💬 Commentary</option>
                <option value="feature_request">✨ Features</option>
                <option value="bug_fix">🐛 Bugs</option>
                <option value="ui_ux_improvement">🎨 UI/UX</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="new">🆕 New</option>
                <option value="in_progress">⏳ In Progress</option>
                <option value="done">✅ Done</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ideas List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading ideas...</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-600 text-lg">No ideas found</p>
            <p className="text-gray-400 text-sm mt-2">Try changing filters or submit a new idea</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <div key={idea.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Priority Indicator */}
                  <div className={`w-2 h-full rounded-full ${getPriorityColor(idea.priority)}`} />

                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getTypeColor(idea.classification?.type)}`}>
                          {getTypeIcon(idea.classification?.type)} {idea.classification?.type?.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {idea.id}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          idea.priority === 'high' ? 'bg-red-100 text-red-700' :
                          idea.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {idea.priority.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(idea.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>

                    {/* Title */}
                    {idea.classification?.title && (
                      <h3 className="font-bold text-lg text-gray-900 mb-2">
                        {idea.classification.title}
                      </h3>
                    )}

                    {/* Original Idea */}
                    <p className="text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg">
                      "{idea.idea}"
                    </p>

                    {/* Classification Details */}
                    {idea.classification?.description && (
                      <p className="text-gray-600 text-sm mb-3">
                        <span className="font-semibold">AI Analysis:</span> {idea.classification.description}
                      </p>
                    )}

                    {/* Category */}
                    {idea.classification?.category && (
                      <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {idea.classification.category}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => updateStatus(idea.id, 'in_progress')}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                      >
                        ⏳ Start
                      </button>
                      <button
                        onClick={() => updateStatus(idea.id, 'done')}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        ✅ Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
