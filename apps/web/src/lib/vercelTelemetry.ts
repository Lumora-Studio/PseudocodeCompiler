export function shouldEnableVercelTelemetry(
  appRuntime = process.env.NEXT_PUBLIC_APP_RUNTIME,
): boolean {
  return appRuntime !== "local";
}
