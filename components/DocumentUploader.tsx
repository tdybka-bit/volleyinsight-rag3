'use client';

import { useState, useRef } from 'react';

export default function DocumentUploader() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sprawdź rozszerzenie
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['docx', 'md', 'pdf'].includes(ext || '')) {
      setError('Nieobsługiwany format. Dozwolone: .docx, .md, .pdf');
      return;
    }

    // Sprawdź rozmiar (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Plik za duży. Maksymalny rozmiar: 10MB');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Błąd uploadu');
      }

      setMessage(`Sukces! ${data.message}`);
      
      // Wyczyść input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
      <div className="space-y-4">
        <div>
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <label
            htmlFor="file-upload"
            className="relative cursor-pointer rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 inline-block transition-colors"
          >
            <span>{uploading ? 'Uploading...' : 'Wybierz plik'}</span>
            <input
              ref={fileInputRef}
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept=".docx,.md,.pdf"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Obsługiwane formaty: DOCX, MD, PDF (max 10MB)
        </p>

        {uploading && (
          <div className="mt-4">
            <div className="animate-pulse flex space-x-4 justify-center items-center">
              <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-200"></div>
              <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-400"></div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Przetwarzanie dokumentu... To może potrwać 1-2 minuty
            </p>
          </div>
        )}

        {message && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}