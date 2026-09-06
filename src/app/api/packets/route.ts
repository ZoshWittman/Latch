import { NextRequest, NextResponse } from 'next/server';
import { LatchService } from '@/lib/latch-service';
import { CreatePacketRequest } from '@/types';

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
    const packets = service.getAllPackets();
    return NextResponse.json({ packets });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch packets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePacketRequest = await request.json();
    
    if (!body.toolCall || !body.toolCall.tool) {
      return NextResponse.json(
        { error: 'Invalid request: toolCall is required' },
        { status: 400 }
      );
    }

    const service = getService();
    const packet = service.createPacket(body.toolCall);
    
    return NextResponse.json({ packet }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create packet' },
      { status: 500 }
    );
  }
}
