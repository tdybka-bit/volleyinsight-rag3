'use client';

import { useState } from 'react';

interface InlineFeedbackProps {
  matchId: string;
  rallyNumber: number;
  setNumber: number;
  commentary: string;
}

export default function InlineFeedback({ 
  matchId, 
  rallyNumber, 
  setNumber, 
  commentary 
}: InlineFeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleStarClick = async (stars: number) => {
    setRating(stars);
    
    if (stars <= 3) {
      // Low rating - show suggestion box
      setShowSuggestion(true);
    } else {
      // High rating - submit immediately
      await submitFeedback(stars, '');
    }
  };

  const submitFeedback = async (stars: number, sugg: string) => {
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          rallyNumber,
          setNumber,
          commentary,
          rating: stars,
          suggestion: sugg,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setSubmitted(true);
        setShowSuggestion(false);
        
        // Hide success message after 2 seconds
        setTimeout(() => {
          setSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestionSubmit = () => {
    if (rating) {
      submitFeedback(rating, suggestion);
    }
  };

  const handleCancel = () => {
    setShowSuggestion(false);
    setRating(null);
    setSuggestion('');
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 py-1">
        <span>✅</span>
        <span>Dziękujemy za ocenę!</span>
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      {/* Star Rating */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Oceń:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              disabled={submitting}
              className="text-lg hover:scale-110 transition-transform disabled:opacity-50"
            >
              {(hoveredStar !== null && star <= hoveredStar) || 
               (rating !== null && star <= rating) ? (
                <span className="text-yellow-400">⭐</span>
              ) : (
                <span className="text-gray-300">☆</span>
              )}
            </button>
          ))}
        </div>
        {rating && !showSuggestion && (
          <span className="text-xs text-gray-400 ml-2">{rating}/5</span>
        )}
      </div>

      {/* Suggestion Box (for low ratings) */}
      {showSuggestion && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 animate-slide-down">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💬 Co można poprawić?
          </label>
          <textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Twoja sugestia..."
            rows={3}
            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSuggestionSubmit}
              disabled={submitting}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Wysyłam...' : 'Wyślij'}
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}