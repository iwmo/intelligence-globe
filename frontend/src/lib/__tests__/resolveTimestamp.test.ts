import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveTimestamp } from '../resolveTimestamp';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveTimestamp', () => {
  describe('playback mode — paused', () => {
    it('returns null when replayMode=playback and isPlaying=false (pause guard)', () => {
      const result = resolveTimestamp('playback', false, 1_000_000);
      expect(result).toBeNull();
    });
  });

  describe('playback mode — playing', () => {
    it('returns replayTs when replayMode=playback and isPlaying=true', () => {
      const result = resolveTimestamp('playback', true, 1_000_000);
      expect(result).toBe(1_000_000);
    });

    it('returns the exact replayTs value passed in', () => {
      const ts = 1_700_000_000_000;
      const result = resolveTimestamp('playback', true, ts);
      expect(result).toBe(ts);
    });
  });

  describe('live mode', () => {
    it('returns approximately Date.now() when replayMode=live and isPlaying=true', () => {
      const fakeNow = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
      const result = resolveTimestamp('live', true, 1_000_000);
      expect(result).toBe(fakeNow);
    });

    it('returns approximately Date.now() when replayMode=live and isPlaying=false (never paused in live)', () => {
      const fakeNow = 1_700_000_000_001;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
      const result = resolveTimestamp('live', false, 1_000_000);
      expect(result).toBe(fakeNow);
    });

    it('ignores the replayTs argument in live mode', () => {
      const fakeNow = 9_999_999_999;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
      // replayTs is 0; live mode must return wall clock regardless
      const result = resolveTimestamp('live', true, 0);
      expect(result).toBe(fakeNow);
    });
  });
});
