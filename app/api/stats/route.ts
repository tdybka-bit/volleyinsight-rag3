import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get('league') || 'plusliga';
    const season = searchParams.get('season') || '2024-2025';
    
    const filename = `${league}-${season}.json`;
    const filePath = path.join(process.cwd(), 'data', filename);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { 
          error: 'Data not found',
          message: `No data for ${league} season ${season}`,
          available: [
            'plusliga-2022-2023',
            'plusliga-2023-2024',
            'plusliga-2024-2025'
          ]
        },
        { status: 404 }
      );
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(data);
    
    return NextResponse.json(json);
    
  } catch (error) {
    console.error('API stats error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}