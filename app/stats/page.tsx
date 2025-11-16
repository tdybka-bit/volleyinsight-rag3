import { getAllPlayersEnhanced } from '@/lib/playerData';
import StatsTableWithFilters from '@/components/stats/StatsTableWithFilters';
import Link from 'next/link';

export const dynamic = 'force-dynamic'; // ← DODAJ TĘ LINIĘ TUTAJ!

export default function StatsPage() {
  const allPlayers = getAllPlayersEnhanced();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <nav className="border-b border-blue-800/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex space-x-8">
              <Link href="/" className="text-orange-400 hover:text-orange-300 font-semibold">
                Home
              </Link>
              <Link href="/stats" className="text-white font-semibold">
                Gracze
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsTableWithFilters players={allPlayers} />
      </div>
    </div>
  );
}