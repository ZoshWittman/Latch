import { NextResponse } from 'next/server';
import { LatchService } from '@/lib/latch-service';

let latchService: LatchService | null = null;

function getService(): LatchService {
  if (!latchService) {
    latchService = new LatchService();
  }
  return latchService;
}

export async function GET() {
  try {
    const service = getService();
    const policies = service.getPolicies();
    return NextResponse.json({ policies });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}
