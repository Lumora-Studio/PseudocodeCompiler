const { execFileSync } = require("node:child_process");

function getCodeSigningIdentities() {
  try {
    return execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }
}

function hasDeveloperIdIdentity(output) {
  return /Developer ID Application:/i.test(output);
}

if (process.platform !== "darwin") {
  process.exit(0);
}

const identities = getCodeSigningIdentities();

if (hasDeveloperIdIdentity(identities)) {
  process.exit(0);
}

console.error(
  [
    "macOS distribution build aborted.",
    "",
    "No 'Developer ID Application' signing identity was found in your keychain.",
    "electron-builder will still create an ad-hoc signed app, but Finder/Gatekeeper",
    "will reject that packaged DMG on macOS.",
    "",
    "Use one of these paths instead:",
    "- Local testing: npm run pack --workspace=@igcse/web",
    "- Signed distribution: install an Apple Developer ID certificate, then run dist again",
  ].join("\n"),
);

process.exit(1);
