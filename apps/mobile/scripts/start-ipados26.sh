#!/usr/bin/env bash
set -euo pipefail

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is required. Install Xcode + Command Line Tools first." >&2
  exit 1
fi

selection="$({
  RUNTIMES_JSON="$(xcrun simctl list runtimes --json)"
  DEVICES_JSON="$(xcrun simctl list devices --json)"
  export RUNTIMES_JSON DEVICES_JSON
  node <<'NODE'
const runtimes = JSON.parse(process.env.RUNTIMES_JSON || '{}').runtimes || [];
const devicesByRuntime = JSON.parse(process.env.DEVICES_JSON || '{}').devices || {};

const runtimeCandidates = runtimes
  .filter((runtime) => runtime.isAvailable !== false)
  .filter((runtime) => {
    const name = String(runtime.name || '');
    const identifier = String(runtime.identifier || '');
    return /(iPadOS|iOS)\s*26(?:\.|$)/i.test(name) || /SimRuntime\.(iPadOS|iOS)-26-/i.test(identifier);
  })
  .sort((a, b) => String(b.version || '').localeCompare(String(a.version || ''), undefined, { numeric: true }));

let best = null;
for (const runtime of runtimeCandidates) {
  const devices = (devicesByRuntime[runtime.identifier] || [])
    .filter((device) => device.isAvailable !== false && /iPad/i.test(String(device.name || '')))
    .sort((a, b) => {
      if (a.state === 'Booted' && b.state !== 'Booted') return -1;
      if (a.state !== 'Booted' && b.state === 'Booted') return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  if (devices.length > 0) {
    best = { runtime, device: devices[0] };
    break;
  }
}

if (!best) {
  process.exit(1);
}

const deviceName = String(best.device.name || '').replace(/\|/g, '');
const deviceUdid = String(best.device.udid || '').replace(/\|/g, '');
const deviceState = String(best.device.state || '').replace(/\|/g, '');
const runtimeName = String(best.runtime.name || '').replace(/\|/g, '');
const runtimeId = String(best.runtime.identifier || '').replace(/\|/g, '');

process.stdout.write(`${deviceName}|${deviceUdid}|${deviceState}|${runtimeName}|${runtimeId}`);
NODE
} || true)"

if [[ -z "${selection}" ]]; then
  echo "No available iPad simulator was found on runtime 26." >&2
  echo "Install an iPadOS/iOS 26 simulator runtime in Xcode > Settings > Components, then try again." >&2
  exit 1
fi

IFS='|' read -r device_name device_udid device_state runtime_name runtime_id <<<"${selection}"

echo "Using simulator: ${device_name}"
echo "Runtime: ${runtime_name} (${runtime_id})"

if [[ "${device_state}" != "Booted" ]]; then
  xcrun simctl boot "${device_udid}" >/dev/null 2>&1 || true
fi

xcrun simctl bootstatus "${device_udid}" -b
open -a Simulator --args -CurrentDeviceUDID "${device_udid}"

if [[ "${SKIP_EXPO_START:-0}" == "1" ]]; then
  echo "SKIP_EXPO_START=1 set; simulator preparation complete."
  exit 0
fi

echo "Launching Expo on iPad simulator..."
pnpm run ios
