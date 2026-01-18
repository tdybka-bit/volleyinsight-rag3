'use client';

import { useState } from 'react';

export default function IdeaSubmitPage() {
  const [idea, setIdea] = useState('');
  const [type, setType] = useState<'commentary' | 'feature'>('commentary');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/submit-idea-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, type, priority })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit idea');
      }

      setResult(data);
      setIdea(''); // Clear form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            💡 VolleyInsight Ideas
          </h1>
          <p className="text-gray-600">
            Podziel się swoim pomysłem - pomóż RAG-owi się uczyć!
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Type Selection - RADIO BUTTONS */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Typ zgłoszenia:
              </label>
              <div className="space-y-3">
                {/* Commentary Option */}
                <label className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  type === 'commentary' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}>
                  <input
                    type="radio"
                    name="type"
                    value="commentary"
                    checked={type === 'commentary'}
                    onChange={(e) => setType('commentary')}
                    disabled={submitting}
                    className="mt-1 w-4 h-4 text-purple-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">💬</span>
                      <span className="font-semibold text-gray-900">Commentary Improvement</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Poprawki komentarzy, słownictwa, stylu → <strong>RAG uczy się natychmiast</strong>
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      Np: "Używaj 'Tavares' zamiast 'Rodrigues'", "Przy block error chwal atakującego"
                    </p>
                  </div>
                </label>

                {/* Feature Option */}
                <label className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  type === 'feature' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <input
                    type="radio"
                    name="type"
                    value="feature"
                    checked={type === 'feature'}
                    onChange={(e) => setType('feature')}
                    disabled={submitting}
                    className="mt-1 w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">✨</span>
                      <span className="font-semibold text-gray-900">Feature Request / Bug</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Nowe funkcje, dane, logika, bugi → <strong>Manual review</strong>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Np: "Liczenie asów od początku meczu", "Fix: demo mode pokazuje zły set"
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Idea Input */}
            <div>
              <label htmlFor="idea" className="block text-sm font-semibold text-gray-700 mb-2">
                {type === 'commentary' ? 'Jak powinien komentować RAG?' : 'Opisz feature/bug:'}
              </label>
              <textarea
                id="idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={
                  type === 'commentary' 
                    ? "Np: 'Używaj Tavares zamiast Rodrigues' lub 'Przy block error pochwał atakującego, nie krytykuj bloku'"
                    : "Np: 'Chcę tracking bloków per set dla każdego zawodnika' lub 'Bug: demo mode pokazuje zły numer seta'"
                }
                rows={6}
                required
                disabled={submitting}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors resize-none text-gray-800 disabled:bg-gray-50"
              />
            </div>

            {/* Priority Dropdown */}
            <div>
              <label htmlFor="priority" className="block text-sm font-semibold text-gray-700 mb-2">
                Priorytet:
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-gray-800 disabled:bg-gray-50"
              >
                <option value="high">🔥 High - Pilne</option>
                <option value="medium">⚡ Medium - Ważne</option>
                <option value="low">💡 Low - Nice to have</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !idea.trim()}
              className={`w-full py-4 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl ${
                type === 'commentary'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {type === 'commentary' ? 'RAG uczy się...' : 'Zapisuję...'}
                </span>
              ) : (
                type === 'commentary' ? '🧠 Naucz RAG! 🚀' : '📝 Wyślij do review 🚀'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-700 font-semibold">❌ Błąd:</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className={`mt-6 p-6 border-2 rounded-xl space-y-4 ${
              result.type === 'commentary'
                ? 'bg-purple-50 border-purple-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <p className={`font-bold text-lg ${
                  result.type === 'commentary' ? 'text-purple-800' : 'text-blue-800'
                }`}>
                  {result.type === 'commentary' ? 'RAG nauczony!' : 'Zapisane do review!'}
                </p>
              </div>

              <div className="space-y-2 bg-white p-4 rounded-lg">
                {result.id && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">ID:</span>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{result.id}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Typ:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    result.type === 'commentary' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {result.type === 'commentary' ? '💬 Commentary Training' : '✨ Feature Request'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                {result.type === 'commentary' 
                  ? '🎉 RAG będzie używał tego hinta przy generowaniu komentarzy!'
                  : '📝 Pomysł zapisany i czeka na Twoje review!'}
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6">
          <h3 className="font-bold text-gray-900 mb-3">💡 Jak to działa?</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-purple-700 mb-2">💬 Commentary</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>✅ Zapisuje hint do Pinecone</li>
                <li>✅ RAG uczy się natychmiast</li>
                <li>✅ Działa na WSZYSTKICH meczach</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-blue-700 mb-2">✨ Feature</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>✅ Zapisuje do VoC (Redis)</li>
                <li>✅ Czeka na manual review</li>
                <li>✅ Ty decydujesz co zrobić</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}