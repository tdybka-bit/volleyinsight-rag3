import { NextRequest, NextResponse } from 'next/server';
import { 
  loadAndStoreContent, 
  searchContent, 
  getContentByType, 
  getDatabaseStats,
  getSystemStatus 
} from '@/lib/vectorIntegration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '3');

    let result;

    switch (action) {
      case 'status':
        result = await getSystemStatus();
        break;
      
      case 'stats':
        result = await getDatabaseStats();
        break;
      
      case 'search':
        if (!query) {
          return NextResponse.json({ error: 'Brak zapytania do wyszukania' }, { status: 400 });
        }
        result = await searchContent(query, limit);
        break;
      
      case 'by-type':
        if (!type) {
          return NextResponse.json({ error: 'Brak typu do wyszukania' }, { status: 400 });
        }
        result = await getContentByType(type, limit);
        break;
      
      default:
        return NextResponse.json({ error: 'Nieprawidłowa akcja' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Błąd API vector store:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Błąd serwera vector store',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, type, limit = 3, contentDir = './content', chunkSize = 500, overlap = 100 } = body;

    let result;

    switch (action) {
      case 'load-and-store':
        result = await loadAndStoreContent(contentDir, chunkSize, overlap);
        break;
      
      case 'search':
        if (!query) {
          return NextResponse.json({ error: 'Brak zapytania do wyszukania' }, { status: 400 });
        }
        result = await searchContent(query, limit);
        break;
      
      case 'by-type':
        if (!type) {
          return NextResponse.json({ error: 'Brak typu do wyszukania' }, { status: 400 });
        }
        result = await getContentByType(type, limit);
        break;
      
      case 'stats':
        result = await getDatabaseStats();
        break;
      
      case 'status':
        result = await getSystemStatus();
        break;
      
      default:
        return NextResponse.json({ error: 'Nieprawidłowa akcja' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Błąd POST API vector store:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Błąd serwera vector store',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}
