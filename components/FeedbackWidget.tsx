// components/FeedbackWidget.tsx
'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface FeedbackWidgetProps {
  matchId: string;
  rallyNumber: number;
  setNumber: number;
  commentary: string;
}

export default function FeedbackWidget({
  matchId,
  rallyNumber,
  setNumber,
  commentary,
}: FeedbackWidgetProps) {
  const [nickname, setNickname] = useState<string>('');
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [suggestion, setSuggestion] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Load nickname from localStorage on mount
  useEffect(() => {
    const savedNickname = localStorage.getItem('voc_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  const saveNickname = () => {
    if (nickname.trim()) {
      localStorage.setItem('voc_nickname', nickname.trim());
    }
  };

  const handleRatingClick = (value: number) => {
    // Jeśli nie ma nicka, nie pozwól oceniać
    if (!nickname.trim()) {
      setError('Najpierw podaj swój nick!');
      return;
    }
    setRating(value);
    setError('');
  };

  const handleSubmit = async () => {
    // Validation
    if (rating === 0) {
      setError('Wybierz ocenę (1-5 gwiazdek)');
      return;
    }

    if (rating <= 3 && !suggestion.trim()) {
      setError('Dla ocen 1-3 wymagana jest sugestia poprawy');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          rallyNumber,
          setNumber,
          rating,
          userNickname: nickname.trim(),
          originalCommentary: commentary,
          userSuggestion: suggestion.trim() || undefined,
          userComment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Success!
      setSubmitted(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setRating(0);
        setSuggestion('');
        setComment('');
        setSubmitted(false);
      }, 2000);

    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">
          💬 Oceń ten komentarz
        </h4>
        <span className="text-xs text-gray-500">
          Rally {rallyNumber} | Set {setNumber}
        </span>
      </div>

      {/* Nickname Input - pokazuje tylko jak nie ma nicka */}
      {!nickname.trim() && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-blue-700 mb-2">
            👋 Podaj swój nick aby oceniać:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Twój nick..."
              className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && saveNickname()}
              autoFocus
            />
            <button
              onClick={saveNickname}
              disabled={!nickname.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => handleRatingClick(value)}
            onMouseEnter={() => setHoverRating(value)}
            onMouseLeave={() => setHoverRating(0)}
            className="transition-transform hover:scale-110 focus:outline-none"
            disabled={isSubmitting || submitted}
          >
            <Star
              size={32}
              className={`${
                value <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } transition-colors`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-medium text-gray-700">
            {rating === 5 ? '🔥 Świetne!' : rating === 4 ? '👍 Dobre' : rating === 3 ? '😐 OK' : rating === 2 ? '😕 Słabe' : '👎 Bardzo słabe'}
          </span>
        )}
      </div>

      {/* Suggestion textarea (for ratings 1-3) */}
      {rating > 0 && rating <= 3 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ✏️ Twoja sugestia poprawy <span className="text-red-500">*</span>
          </label>
          <textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Jak by to skomentować lepiej? Napisz swoją wersję..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            disabled={isSubmitting || submitted}
          />
        </div>
      )}

      {/* Optional comment textarea (for ratings 4-5) */}
      {rating >= 4 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💭 Dodatkowy komentarz (opcjonalnie)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Co Ci się spodobało? (opcjonalnie)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={isSubmitting || submitted}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Submit button */}
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || submitted}
          className={`w-full py-2 rounded-lg font-medium transition-colors ${
            submitted
              ? 'bg-green-500 text-white'
              : isSubmitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {submitted ? '✅ Wysłano!' : isSubmitting ? '⏳ Wysyłanie...' : '📤 Wyślij feedback'}
        </button>
      )}

      {/* User info - pokazuje tylko jak jest nick */}
      {nickname.trim() && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Oceniasz jako: <span className="font-medium">{nickname}</span>
          {' • '}
          <button
            onClick={() => {
              localStorage.removeItem('voc_nickname');
              setNickname('');
            }}
            className="text-blue-500 hover:underline"
          >
            Zmień nick
          </button>
        </div>
      )}
    </div>
  );
}