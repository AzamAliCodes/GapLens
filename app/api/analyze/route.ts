import { NextRequest } from 'next/server';
import { AnalyzeRequestSchema } from '@/lib/schemas';
import { checkRateLimit } from '@/lib/security/ratelimit';
import { runAnalysisPipeline } from '@/lib/analyze/pipeline';
import { StreamEvent } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               req.headers.get('x-real-ip') || 
               '127.0.0.1';
    
    const rateLimit = checkRateLimit(ip, 12, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Please wait ${rateLimit.resetInSec} seconds before submitting a new analysis.` }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Request body validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = AnalyzeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorDetails = parseResult.error.issues.map(e => e.message).join(', ');
      return new Response(
        JSON.stringify({ error: `Validation failed: ${errorDetails}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const analyzeRequest = parseResult.data;

    // 3. Set up streaming response (NDJSON) using standard ReadableStream
    // Using ReadableStream.start() ensures the serverless function lifecycle remains active until controller.close()
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: StreamEvent) => {
          try {
            const line = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(line));
          } catch {
            // Stream may be closed if client disconnected
          }
        };

        try {
          await runAnalysisPipeline(analyzeRequest, (event) => {
            sendEvent(event);
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[API /api/analyze] Pipeline execution error:', errorMsg);
          sendEvent({
            stage: 'error',
            status: 'Analysis failed',
            progress: 0,
            error: errorMsg,
          });
        } finally {
          try {
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/analyze] Top-level handler failure:', errorMsg);
    return new Response(
      JSON.stringify({ error: `Server error: ${errorMsg}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
