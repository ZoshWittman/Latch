import { NextRequest, NextResponse } from 'next/server';
import { LatchService } from '@/lib/latch-service';

let latchService: LatchService | null = null;

function getService(): LatchService {
  if (!latchService) {
    latchService = new LatchService();
  }
  return latchService;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = getService();
    const result = service.verifyPacketIntegrity(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to verify packet' },
      { status: 500 }
    );
  }
}
