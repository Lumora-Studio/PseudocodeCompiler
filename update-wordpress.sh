#!/usr/bin/env bash
# ============================================================
# update-wordpress.sh
# Updates your self-hosted WordPress site at 45.249.244.34:8080
# to showcase your two projects: IGCSE Pseudocode Compiler & SchedoraX
#
# Usage:
#   chmod +x update-wordpress.sh
#   ./update-wordpress.sh
# ============================================================

set -euo pipefail

SERVER="45.249.244.34"
SSH_USER="ubuntu"
SSH_PASS="PujZVf4FZwPwrDCL"

echo "==> Installing sshpass locally if needed..."
if ! command -v sshpass &>/dev/null; then
  if command -v brew &>/dev/null; then
    brew install hudochenkov/sshpass/sshpass
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y sshpass
  else
    echo "ERROR: sshpass not found. Please install it manually."
    exit 1
  fi
fi

SSH_CMD="sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER}"

echo "==> Connecting to ${SERVER} and updating WordPress..."

sshpass -p "${SSH_PASS}" ssh -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER}" << 'ENDSSH'
set -e

echo "--- Detecting WordPress root ---"
WP_PATH=""
for candidate in /var/www/html /var/www/wordpress /var/www/html/wordpress /opt/bitnami/wordpress; do
  if [ -f "${candidate}/wp-config.php" ]; then
    WP_PATH="${candidate}"
    break
  fi
done

if [ -z "${WP_PATH}" ]; then
  WP_PATH=$(find /var/www -name "wp-config.php" 2>/dev/null | head -1 | xargs dirname || true)
fi

if [ -z "${WP_PATH}" ]; then
  echo "ERROR: Could not find WordPress installation."
  exit 1
fi

echo "WordPress found at: ${WP_PATH}"
cd "${WP_PATH}"

# ---- Install WP-CLI if missing ----
if ! command -v wp &>/dev/null; then
  echo "--- Installing WP-CLI ---"
  curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  chmod +x wp-cli.phar
  sudo mv wp-cli.phar /usr/local/bin/wp
fi

WP="wp --path=${WP_PATH} --allow-root"

echo "--- WordPress info ---"
$WP core version
$WP option get siteurl

# ================================================================
# 1. SITE SETTINGS
# ================================================================
echo "--- Updating site settings ---"
$WP option update blogname "Alex's Projects"
$WP option update blogdescription "Developer Portfolio — IGCSE Pseudocode Compiler & SchedoraX"

# ================================================================
# 2. HOME PAGE — Projects Overview
# ================================================================
echo "--- Creating / updating Home page ---"

HOME_CONTENT='<!-- wp:heading {"textAlign":"center","level":1} -->
<h1 class="wp-block-heading has-text-align-center">Hi, I&rsquo;m Alex 👋</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">I build tools that help students learn and people stay organised. Here are my two latest projects.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:columns {"isStackedOnMobile":true} -->
<div class="wp-block-columns">

<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">🖥️ IGCSE Pseudocode Compiler</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>A full-stack toolchain that compiles IGCSE-style pseudocode into Python — live, in the browser. Designed for Cambridge IGCSE students and teachers.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/igcse-pseudocode-compiler/">Learn More</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">📅 SchedoraX</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>A native iOS, macOS, and watchOS scheduling app that brings your Apple Calendar and Reminders together in a clean, focused interface.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/schedorax/">Learn More</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:column -->

</div>
<!-- /wp:columns -->'

HOME_ID=$($WP post list --post_type=page --name=home --field=ID 2>/dev/null | head -1 || true)
if [ -z "${HOME_ID}" ]; then
  HOME_ID=$($WP post create \
    --post_type=page \
    --post_status=publish \
    --post_title="Home" \
    --post_name="home" \
    --post_content="${HOME_CONTENT}" \
    --porcelain)
  echo "Created Home page (ID ${HOME_ID})"
else
  $WP post update "${HOME_ID}" \
    --post_title="Home" \
    --post_content="${HOME_CONTENT}" \
    --post_status=publish
  echo "Updated Home page (ID ${HOME_ID})"
fi

# Set as the static front page
$WP option update show_on_front page
$WP option update page_on_front "${HOME_ID}"

# ================================================================
# 3. IGCSE PSEUDOCODE COMPILER PAGE
# ================================================================
echo "--- Creating / updating IGCSE Pseudocode Compiler page ---"

PC_CONTENT='<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">IGCSE Pseudocode Compiler</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>An open-source monorepo that takes IGCSE-style pseudocode and compiles it to executable Python — complete with syntax diagnostics, a built-in runtime, and a study manual.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What It Does</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>Tokenises, parses, validates, and transpiles IGCSE pseudocode to Python</li>
<li>Runs the generated Python inside an in-browser WebAssembly Python runtime</li>
<li>Produces detailed syntax and semantic diagnostics with exact source locations</li>
<li>Persists a multi-file workspace — folders, documents, and virtual files</li>
<li>Ships a built-in study manual at <code>/manual</code> with exam command words, loop patterns, and copyable worked examples</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Platforms</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Web</strong> — Next.js app, open in any browser</li>
<li><strong>Desktop</strong> — Electron shell wrapping the Next.js UI (macOS)</li>
<li><strong>Mobile</strong> — Expo / React Native app for iPhone and iPad</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Tech Stack</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Compiler core:</strong> TypeScript — tokenizer → parser → semantic analyser → code generator</li>
<li><strong>Web UI:</strong> Next.js (React)</li>
<li><strong>Desktop shell:</strong> Electron</li>
<li><strong>Mobile:</strong> Expo / React Native</li>
<li><strong>Package manager:</strong> npm workspaces (monorepo)</li>
<li><strong>Runtime:</strong> In-browser / WebView Python interpreter</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Quick Example</h2>
<!-- /wp:heading -->

<!-- wp:code -->
<pre class="wp-block-code"><code>DECLARE Total : INTEGER
DECLARE Index : INTEGER

FOR Index &lt;- 1 TO 3
    Total &lt;- Total + Index
NEXT Index

OUTPUT Total</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>The compiler converts this to valid Python, runs it, and outputs <code>6</code> — all inside the browser.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Repository Layout</h2>
<!-- /wp:heading -->

<!-- wp:code -->
<pre class="wp-block-code"><code>.
├── apps/
│   ├── mobile      # Expo / React Native app
│   └── web         # Next.js + Electron desktop
├── packages/
│   ├── compiler    # Shared compiler core
│   └── workspace   # Shared workspace state &amp; persistence
├── package.json
└── README.md</code></pre>
<!-- /wp:code -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">License</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Released under the MIT License.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="/">← Back to Projects</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->'

PC_ID=$($WP post list --post_type=page --name=igcse-pseudocode-compiler --field=ID 2>/dev/null | head -1 || true)
if [ -z "${PC_ID}" ]; then
  PC_ID=$($WP post create \
    --post_type=page \
    --post_status=publish \
    --post_title="IGCSE Pseudocode Compiler" \
    --post_name="igcse-pseudocode-compiler" \
    --post_content="${PC_CONTENT}" \
    --porcelain)
  echo "Created IGCSE Pseudocode Compiler page (ID ${PC_ID})"
else
  $WP post update "${PC_ID}" \
    --post_title="IGCSE Pseudocode Compiler" \
    --post_content="${PC_CONTENT}" \
    --post_status=publish
  echo "Updated IGCSE Pseudocode Compiler page (ID ${PC_ID})"
fi

# ================================================================
# 4. SCHEDORAX PAGE
# ================================================================
echo "--- Creating / updating SchedoraX page ---"

SX_CONTENT='<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">SchedoraX</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>A native scheduling app for iOS, iPadOS, macOS, and watchOS that unifies your Apple Calendar events and Reminders into a single, focused view.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What It Does</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>Reads and writes directly to Apple Calendar and Reminders via the EventKit framework</li>
<li>Displays events and reminders in a unified timeline</li>
<li>Supports creating, editing, and deleting calendar events and reminder items</li>
<li>Configurable alert offsets — from "at time of event" up to one week before</li>
<li>Apple Watch companion app for at-a-glance scheduling</li>
<li>Light and dark mode with a fully custom theme system</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Platforms &amp; Requirements</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>iOS / iPadOS 17+</strong> — full-featured phone and tablet layout</li>
<li><strong>macOS 14 Sonoma+</strong> — native Mac app with a hidden-title-bar window</li>
<li><strong>watchOS 10+</strong> — Apple Watch companion app</li>
<li>Built with Xcode 16 and Swift 5.9</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Tech Stack</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Language:</strong> Swift 5.9</li>
<li><strong>UI framework:</strong> SwiftUI</li>
<li><strong>Data layer:</strong> EventKit (Apple Calendar &amp; Reminders)</li>
<li><strong>Notifications:</strong> UserNotifications framework</li>
<li><strong>Build system:</strong> XcodeGen (<code>project.yml</code>)</li>
<li><strong>Bundle ID:</strong> <code>com.schedora.ios</code> / <code>com.schedora.macos</code></li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Project Structure</h2>
<!-- /wp:heading -->

<!-- wp:code -->
<pre class="wp-block-code"><code>SchedoraX/
├── App/               # App entry point (SchedoraXApp.swift)
├── Components/        # Reusable UI views (EventRow, EventDetailView…)
├── Models/            # Data models (CalendarEvent, ReminderItem, AlertOffset…)
├── Services/          # EventKitService, NotificationService
├── Settings/          # AppSettings (theme, colour scheme, preferences)
├── ViewModels/        # View-model layer
├── iOS/               # iOS-specific layouts
├── macOS/             # macOS-specific layouts
SchedoraXWatch/        # watchOS companion target
project.yml            # XcodeGen project definition</code></pre>
<!-- /wp:code -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Permissions</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>SchedoraX requests Full Calendar Access and Reminders Access at first launch — required to read and write your events via EventKit.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="/">← Back to Projects</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->'

SX_ID=$($WP post list --post_type=page --name=schedorax --field=ID 2>/dev/null | head -1 || true)
if [ -z "${SX_ID}" ]; then
  SX_ID=$($WP post create \
    --post_type=page \
    --post_status=publish \
    --post_title="SchedoraX" \
    --post_name="schedorax" \
    --post_content="${SX_CONTENT}" \
    --porcelain)
  echo "Created SchedoraX page (ID ${SX_ID})"
else
  $WP post update "${SX_ID}" \
    --post_title="SchedoraX" \
    --post_content="${SX_CONTENT}" \
    --post_status=publish
  echo "Updated SchedoraX page (ID ${SX_ID})"
fi

# ================================================================
# 5. NAVIGATION MENU
# ================================================================
echo "--- Setting up navigation menu ---"

MENU_NAME="Main Menu"
MENU_EXISTS=$($WP menu list --field=name 2>/dev/null | grep -c "${MENU_NAME}" || true)

if [ "${MENU_EXISTS}" -eq 0 ]; then
  $WP menu create "${MENU_NAME}"
fi

MENU_ID=$($WP menu list --field=id,name 2>/dev/null | grep "${MENU_NAME}" | awk '{print $1}' | head -1)

# Clear old items and rebuild
$WP menu item list "${MENU_ID}" --field=db_id 2>/dev/null | xargs -r -I{} wp menu item delete {} --allow-root 2>/dev/null || true

$WP menu item add-post "${MENU_ID}" "${HOME_ID}" --title="Home" --allow-root
$WP menu item add-post "${MENU_ID}" "${PC_ID}" --title="Pseudocode Compiler" --allow-root
$WP menu item add-post "${MENU_ID}" "${SX_ID}" --title="SchedoraX" --allow-root

# Assign to primary location
$WP menu location assign "${MENU_ID}" primary 2>/dev/null || \
$WP menu location assign "${MENU_ID}" main-menu 2>/dev/null || \
$WP menu location assign "${MENU_ID}" header-menu 2>/dev/null || \
echo "Note: Could not assign menu to a theme location — assign it manually in Appearance → Menus."

# ================================================================
# 6. FLUSH CACHE
# ================================================================
echo "--- Flushing caches ---"
$WP cache flush 2>/dev/null || true
$WP rewrite flush 2>/dev/null || true

echo ""
echo "============================================"
echo " WordPress updated successfully!"
echo " Site URL: $($WP option get siteurl)"
echo " Home page ID:            ${HOME_ID}"
echo " Pseudocode Compiler ID:  ${PC_ID}"
echo " SchedoraX ID:            ${SX_ID}"
echo "============================================"
ENDSSH

echo ""
echo "Done! Visit http://45.249.244.34:8080 to see your updated site."
