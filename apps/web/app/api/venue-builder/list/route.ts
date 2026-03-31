import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const venuesDir = path.join(process.cwd(), 'public', 'venues');
    const entries = await readdir(venuesDir, { withFileTypes: true }).catch(() => []);
    const venues = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    return NextResponse.json({ venues });
  } catch {
    return NextResponse.json({ venues: [] });
  }
}
