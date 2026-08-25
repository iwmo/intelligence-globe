import { runVoiceTool } from './voiceTools';

export interface VoiceStatus {
  available: boolean;
  model: string | null;
  cap_usd: number;
}

const SESSION_MS = 8 * 60 * 1000; // Mini hard-stop ≈ $3 cap

export async function fetchVoiceStatus(): Promise<VoiceStatus> {
  const res = await fetch('/api/voice/status');
  if (!res.ok) return { available: false, model: null, cap_usd: 3 };
  return res.json() as Promise<VoiceStatus>;
}

export async function startVoiceSession(): Promise<{ stop: () => void }> {
  const res = await fetch('/api/voice/session', {
    method: 'POST',
    headers: { 'X-API-Key': import.meta.env.VITE_API_KEY ?? '' },
  });
  if (!res.ok) {
    throw new Error(res.status === 503 ? 'Voice unavailable' : 'Voice session failed');
  }
  const session = await res.json() as { client_secret?: string; model: string };

  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel('oai-events');
  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as {
        type?: string;
        name?: string;
        arguments?: string;
      };
      if (msg.type === 'response.function_call_arguments.done' && msg.name) {
        const args = msg.arguments ? JSON.parse(msg.arguments) as Record<string, unknown> : {};
        const result = runVoiceTool(msg.name, args);
        dc.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', output: result },
        }));
      }
    } catch {
      // ignore malformed events
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.client_secret}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp,
  });
  const answer = await sdpRes.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  const timer = window.setTimeout(() => stop(), SESSION_MS);

  function stop() {
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    pc.close();
  }

  return { stop };
}
