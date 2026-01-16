'use client';

import { useState, useEffect } from 'react';

interface Feedback {
  id: string;
  matchId: string;
  rallyNumber: number;
  setNumber: number;
  commentary: string;
  rating: number;
  suggestion?: string;
  status?: string;  // ← DODAJ TO!
  timestamp: string;
}

export default function FeedbackReviewPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [setFilter, setSetFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');  // ← DODAJ TO!

  const updateStatus = async (feedbackId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId,
          status: newStatus
        })
      });

      if (response.ok) {
        // Refresh feedbacks
        fetchFeedbacks();
        console.log(`✅ Status updated: ${feedbackId} → ${newStatus}`);
      } else {
        console.error('❌ Failed to update status');
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
    }
  };  // ← KONIEC FUNKCJI

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/feedback');
      const data = await response.json();
      
      // Sort by timestamp (newest first)
      const sorted = (data.feedbacks || []).sort((a: Feedback, b: Feedback) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setFeedbacks(sorted);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(fb => {
    if (ratingFilter !== 'all' && fb.rating.toString() !== ratingFilter) {
      return false;
    }
    if (setFilter !== 'all' && fb.setNumber.toString() !== setFilter) {
      return false;
    }
    if (statusFilter !== 'all' && fb.status !== statusFilter) {  // ← DODANE!
      return false;
    }
    return true;
  });

  // Stats
  const avgRating = feedbacks.length > 0 
    ? (feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length).toFixed(1)
    : '0';
  
  const lowRatings = feedbacks.filter(fb => fb.rating <= 3).length;
  const highRatings = feedbacks.filter(fb => fb.rating >= 4).length;

  const getRatingStars = (rating: number) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating === 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 Feedback Review</h1>
              <p className="text-gray-600">Voice of Customer - Oceny komentarzy</p>
            </div>
            <button
              onClick={fetchFeedbacks}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Odśwież
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-semibold">Total Feedbacks</p>
              <p className="text-3xl font-bold text-blue-900">{feedbacks.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-semibold">Średnia Ocena</p>
              <p className="text-3xl font-bold text-green-900">{avgRating}/5</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-semibold">Pozytywne (4-5⭐)</p>
              <p className="text-3xl font-bold text-green-900">{highRatings}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-600 font-semibold">Do Poprawy (1-3⭐)</p>
              <p className="text-3xl font-bold text-red-900">{lowRatings}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ocena:</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-4 py-2 text-gray-900 bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Wszystkie</option>
                <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                <option value="4">⭐⭐⭐⭐ (4)</option>
                <option value="3">⭐⭐⭐ (3)</option>
                <option value="2">⭐⭐ (2)</option>
                <option value="1">⭐ (1)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Set:</label>
              <select
                value={setFilter}
                onChange={(e) => setSetFilter(e.target.value)}
                className="px-4 py-2 text-gray-900 bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Wszystkie</option>
                <option value="1">Set 1</option>
                <option value="2">Set 2</option>
                <option value="3">Set 3</option>
                <option value="4">Set 4</option>
                <option value="5">Set 5</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 text-gray-900 bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Wszystkie</option>
                <option value="new">🆕 New</option>
                <option value="reviewed">✅ Reviewed</option>
                <option value="implemented">🚀 Implemented</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedbacks List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Ładowanie feedbacków...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-600 text-lg">Brak feedbacków</p>
            <p className="text-gray-400 text-sm mt-2">Zmień filtry lub poczekaj na oceny użytkowników</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                      Rally #{feedback.rallyNumber}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                      Set {feedback.setNumber}
                    </span>
                    <span className={`text-2xl ${getRatingColor(feedback.rating)}`}>
                      {getRatingStars(feedback.rating)}
                    </span>
                    <span className={`font-bold ${getRatingColor(feedback.rating)}`}>
                      {feedback.rating}/5
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(feedback.timestamp)}
                  </span>
                </div>

                {/* Commentary */}
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <p className="text-sm text-gray-500 mb-1">Komentarz:</p>
                  <p className="text-gray-700">{feedback.commentary}</p>
                </div>

                {/* Suggestion (if exists) */}
                {feedback.suggestion && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                    <p className="text-sm font-semibold text-yellow-800 mb-1">💬 Sugestia użytkownika:</p>
                    <p className="text-yellow-900">{feedback.suggestion}</p>
                  </div>
                )}

                {/* Match ID */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Match ID: {feedback.matchId}</span>
                </div>
                {/* Match ID */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Match ID: {feedback.matchId}</span>
                </div>

                {/* Status & Actions */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      feedback.status === 'implemented' ? 'bg-purple-100 text-purple-700' :
                      feedback.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {feedback.status === 'implemented' ? '🚀 Implemented' :
                       feedback.status === 'reviewed' ? '✅ Reviewed' :
                       '🆕 New'}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  {feedback.status === 'new' && (
                    <button
                      onClick={() => updateStatus(feedback.id, 'reviewed')}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Mark as Reviewed
                    </button>
                  )}
                  
                  {feedback.status === 'reviewed' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(feedback.id, 'implemented')}
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Mark as Implemented
                      </button>
                      <button
                        onClick={() => updateStatus(feedback.id, 'new')}
                        className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        ↩️
                      </button>
                    </div>
                  )}
                  
                  {feedback.status === 'implemented' && (
                    <button
                      onClick={() => updateStatus(feedback.id, 'reviewed')}
                      className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      ↩️ Back to Reviewed
                    </button>
                  )}
                </div>
           
              </div>
            ))}
          </div>
        )}

        {/* Export Button (future) */}
        {filteredFeedbacks.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                // TODO: Export to CSV
                alert('Export to CSV - coming soon!');
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📥 Export do CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}