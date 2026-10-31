import { NextResponse } from 'next/server';
import { getBundledDemoAnalysis } from '@/lib/samples/bundledSamples';

export async function GET() {
  try {
    const data = getBundledDemoAnalysis();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load demo scenario: ${msg}` }, { status: 500 });
  }
}
