/**
 * Replay protection helper — callers store hash in Redis with TTL = maxAgeSec.
 */
export function initDataReplayKey(platform: string, hash: string): string {
  return `initdata:replay:${platform}:${hash}`;
}
