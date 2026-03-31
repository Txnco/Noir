import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get('venue_id');
    const version = searchParams.get('version');

    if (!venue_id || !/^[a-zA-Z0-9\-_]+$/.test(venue_id)) {
      return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
    }

    const dir = path.join(process.cwd(), 'public', 'venues', venue_id);

    let filename: string;

    if (!version || version === 'latest') {
      // Find the highest version number
      const files = await readdir(dir).catch(() => [] as string[]);
      const vFiles = files
        .filter((f) => /^v\d+\.json$/.test(f))
        .map((f) => ({ name: f, num: parseInt(f.replace(/[^0-9]/g, ''), 10) }))
        .sort((a, b) => b.num - a.num);

      if (vFiles.length === 0) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      filename = vFiles[0].name;
    } else {
      filename = `v${version}.json`;
    }

    const filepath = path.join(dir, filename);
    const content = await readFile(filepath, 'utf-8');
    const json = JSON.parse(content);

    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
