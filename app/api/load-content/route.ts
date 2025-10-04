import { NextRequest, NextResponse } from 'next/server';
import { loadMarkdownFiles, loadMarkdownFilesByType, searchChunks } from '@/lib/markdownLoader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';
    const query = searchParams.get('query') || '';
    const chunkSize = parseInt(searchParams.get('chunkSize') || '1200');
    const overlap = parseInt(searchParams.get('overlap') || '300');

    let result;

    switch (action) {
      case 'all':
        result = await loadMarkdownFiles('./content', chunkSize, overlap);
        break;
      
      case 'by-type':
        result = await loadMarkdownFilesByType('./content', chunkSize, overlap);
        break;
      
      case 'search':
        const allChunks = await loadMarkdownFiles('./content', chunkSize, overlap);
        result = searchChunks(allChunks, query);
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      count: Array.isArray(result) ? result.length : Object.keys(result).length,
      action,
      query: query || null,
      settings: { chunkSize, overlap }
    });

  } catch (error) {
    console.error('Error loading markdown content:', error);
    return NextResponse.json(
      { error: 'Failed to load markdown content' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, chunkSize = 1200, overlap = 300 } = body;

    let result;

    switch (action) {
      case 'search':
        const allChunks = await loadMarkdownFiles('./content', chunkSize, overlap);
        result = searchChunks(allChunks, query);
        break;
      
      case 'by-type':
        result = await loadMarkdownFilesByType('./content', chunkSize, overlap);
        break;
      
      default:
        result = await loadMarkdownFiles('./content', chunkSize, overlap);
    }

    return NextResponse.json({
      success: true,
      data: result,
      count: Array.isArray(result) ? result.length : Object.keys(result).length,
      action,
      query: query || null,
      settings: { chunkSize, overlap }
    });

  } catch (error) {
    console.error('Error processing markdown content:', error);
    return NextResponse.json(
      { error: 'Failed to process markdown content' },
      { status: 500 }
    );
  }
}


