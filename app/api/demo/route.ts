import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const demoFilePath = path.join(process.cwd(), 'public', 'samples', 'demo-analysis.json');
    const content = await fs.readFile(demoFilePath, 'utf-8');
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load demo scenario: ${msg}` }, { status: 500 });
  }
}
