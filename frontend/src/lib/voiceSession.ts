import { runVoiceTool } from './voiceTools';

export interface VoiceStatus {
  available: boolean;
  model: string | null;
  cap_usd: number;
}

const SESSION_MS = 8 * 60 * 1000; // Mini hard-stop ≈ $3 cap
const REALTIME_CALLS = 'https://api.openai.com/v1/realtime/calls';

export async function fetchVoiceStatus(): Promise<VoiceStatus> {
  const res = await fetch('/api/voice/status');
  if (!res.ok) return { available: false, model: null, cap_usd: 3 };
  return res.json() as Promise<VoiceStatus>;
}

function toolCallName(msg: Record<string, unknown>): string | null {
  if (msg.type === 'response.function_call_arguments.done' && typeof msg.name === 'string') {
    return msg.name;
  }
  const item = msg.item as { type?: string; name?: string; arguments?: string } | undefined;
  if (msg.type === 'response.output_item.done' && item?.type === 'function_call' && item.name) {
    return item.name;
  }
  return null;
}

function toolCallArgs(msg: Record<string, unknown>): Record<string, unknown> {
  const raw = typeof msg.arguments === 'string'
    ? msg.arguments
    : (msg.item as { arguments?: string } | undefined)?.arguments;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  if (!session.client_secret) {
    throw new Error('Voice session failed');
  }

  const pc = new RTCPeerConnection();
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  pc.ontrack = (ev) => {
    audioEl.srcObject = ev.streams[0] ?? null;
  };

  const dc = pc.createDataChannel('oai-events');
  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      const name = toolCallName(msg);
      if (!name) return;
      void runVoiceTool(name, toolCallArgs(msg)).then((result) => {
        dc.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', output: result },
        }));
      });
    } catch {
      // ignore malformed events
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(REALTIME_CALLS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.client_secret}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp,
  });
  if (!sdpRes.ok) {
    stream.getTracks().forEach((t) => t.stop());
    pc.close();
    throw new Error('Voice session failed');
  }
  const answer = await sdpRes.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  const timer = window.setTimeout(() => stop(), SESSION_MS);

  function stop() {
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    audioEl.srcObject = null;
    pc.close();
  }

  return { stop };
}
