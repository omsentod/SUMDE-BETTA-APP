import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'SUMDE-BETTA API Server is healthy' });
}
