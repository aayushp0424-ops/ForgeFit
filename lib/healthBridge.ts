// Read-only phone health bridge. It exists ONLY in ForgeFit's native iOS wrapper.
// A Safari/PWA window has no HealthKit permission or API.
type NativeHealthReply = { ok?: boolean; steps?: number; error?: string };
type NativeHealthRequest = { action: 'requestPermission' | 'getDailySteps'; date?: string };
type NativeHealthHandler = { postMessage(payload: NativeHealthRequest): Promise<NativeHealthReply> };
type HealthWindow = Window & { webkit?: { messageHandlers?: { forgefitHealth?: NativeHealthHandler } } };
function healthHandler(): NativeHealthHandler | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as HealthWindow).webkit?.messageHandlers?.forgefitHealth;
}
export function isHealthBridgeAvailable(): boolean { return Boolean(healthHandler()); }
async function callNative(request: NativeHealthRequest): Promise<NativeHealthReply> {
  const bridge = healthHandler();
  if (!bridge) throw new Error('Direct Apple Health sync requires the native ForgeFit iPhone app, not Safari.');
  const reply = await bridge.postMessage(request);
  if (!reply || reply.ok !== true) throw new Error(reply?.error || 'Apple Health could not complete this request.');
  return reply;
}
export async function requestAppleHealthAccess(): Promise<void> {
  await callNative({ action: 'requestPermission' });
  // HealthKit never confirms to apps that read permission was granted.
}
export async function fetchAppleHealthSteps(date: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid step date.');
  const response = await callNative({ action: 'getDailySteps', date });
  const count = response.steps;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100000)
    throw new Error('Apple Health returned an invalid step count.');
  return count;
}
