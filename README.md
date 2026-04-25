<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/logo-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="branding/logo-black.svg">
    <img alt="Lumora Studio" src="branding/logo-black.svg" width="92">
  </picture>
</p>

<h1 align="center">Pseudocode Compiler</h1>

<p align="center">
  An educational toolchain from <a href="https://www.lumorastudio.top/">Lumora Studio</a>
  for turning IGCSE-style pseudocode into Python.
</p>

<p align="center">
  <a href="https://apps.lumorastudio.top/">Try it online</a>
  ·
  <a href="https://www.lumorastudio.top/products/pseudocode">Product page</a>
  ·
  <a href="https://www.lumorastudio.top/">Lumora Studio</a>
</p>

## Why This Exists

Pseudocode is supposed to help students think clearly before they worry about a real programming language. In practice, it often becomes frustrating: mistakes are hard to check, examples are static, and students do not always see how their exam-style logic connects to executable code.

Pseudocode Compiler was built to close that gap. It gives learners a place to write pseudocode, see helpful diagnostics, translate their work into Python, and run the result immediately. The goal is not to replace learning. The goal is to make the feedback loop faster, clearer, and less intimidating.

## Lumora Studio

Lumora Studio builds software that feels deliberate, calm, and useful. The studio's work is guided by a simple idea: tools should respect the person using them. They should remove friction, explain what went wrong, and make progress feel possible without getting in the way.

Pseudocode Compiler reflects that approach. It is an educational tool, but it is treated like a real product: clean interface, direct feedback, local and web versions, and enough structure for students to build confidence over time.

You can get started by downloading the macOS application from this release, or by trying the online version:

https://apps.lumorastudio.top/

To learn more about Lumora Studio and our other projects, visit:

https://www.lumorastudio.top/

## What It Does

- Compiles IGCSE-style pseudocode into Python.
- Shows syntax and semantic diagnostics with source locations.
- Runs generated Python inside the browser, desktop app, or mobile app.
- Provides a multi-file workspace for folders, documents, and virtual files.
- Includes a study manual with examples and reference material.

## Project Structure

```text
.
├── apps
│   ├── mobile      # Expo / React Native app
│   └── web         # Next.js app and Electron desktop packaging
├── branding        # Lumora Studio brand assets
├── convex          # Cloud workspace schema and functions
├── packages
│   ├── compiler    # Pseudocode parser, validator, and Python generator
│   └── workspace   # Shared workspace model and persistence helpers
└── package.json
```

## Development

Install dependencies:

```bash
npm install
```

Run the web and desktop development app:

```bash
npm run dev
```

Run only the browser app:

```bash
npm run dev:web
```

Run tests:

```bash
npm run test
```

## Links

- Lumora Studio: [lumorastudio.top](https://www.lumorastudio.top/)
- Pseudocode Compiler product page: [lumorastudio.top/products/pseudocode](https://www.lumorastudio.top/products/pseudocode)
- Online compiler: [apps.lumorastudio.top](https://apps.lumorastudio.top/)

## License

This project is licensed under the GNU General Public License, version 3. See [LICENSE](./LICENSE).
