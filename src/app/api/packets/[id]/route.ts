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
    const packet = service.getPacket(params.id);
    
    if (!packet) {
      return NextResponse.json(
        { error: 'Packet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ packet });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch packet' },
      { status: 500 }
    );
  }
}
