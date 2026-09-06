import { NextRequest, NextResponse } from 'next/server';
import { LatchService } from '@/lib/latch-service';

let latchService: LatchService | null = null;

function getService(): LatchService {
  if (!latchService) {
    latchService = new LatchService();
  }
  return latchService;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    if (!body.sealedBy) {
      return NextResponse.json(
        { error: 'sealedBy is required' },
        { status: 400 }
      );
    }

    const service = getService();
    const result = service.sealPacket({
      packetId: params.id,
      sealedBy: body.sealedBy
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const packet = service.getPacket(params.id);
    return NextResponse.json({ packet });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to seal packet' },
      { status: 500 }
    );
  }
}
