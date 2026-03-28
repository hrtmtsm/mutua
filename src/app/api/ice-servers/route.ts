import { NextResponse } from 'next/server';

const FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export async function GET() {
  const apiKey = process.env.METERED_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`,
        { next: { revalidate: 3600 } },
      );
      if (res.ok) {
        const servers = await res.json();
        return NextResponse.json(servers);
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json(FALLBACK);
}
