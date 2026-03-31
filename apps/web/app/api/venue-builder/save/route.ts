import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { venue_id, version, json } = await request.json();

    if (!venue_id || typeof venue_id !== 'string') {
      return NextResponse.json({ error: 'Missing venue_id' }, { status: 400 });
    }

    // Sanitize venue_id — only alphanumeric, dash, underscore
    if (!/^[a-zA-Z0-9\-_]+$/.test(venue_id)) {
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    const dir = path.join(process.cwd(), 'public', 'venues', venue_id);
    await mkdir(dir, { recursive: true });

    const versionNum = typeof version === 'number' ? version : 1;
    const filename = `v${versionNum}.json`;
    const filepath = path.join(dir, filename);

    await writeFile(filepath, JSON.stringify(json, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      path: `/venues/${venue_id}/${filename}`,
    });
  } catch (err) {
    console.error('Save error:', err);
    return NextResponse.json({ error: 'Failed to save venue' }, { status: 500 });
  }
}
