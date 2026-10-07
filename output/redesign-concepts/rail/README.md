# Rail redesign mockups

Static HTML mockups for a simpler, consistent marketing site and editor. Open the files directly in a browser.

| Page | File |
| --- | --- |
| Marketing landing page | `site.html` |
| Docs page | `docs.html` |
| Editor | `app.html` |

Query parameters switch the state:

- `?theme=dark` switches the interface to dark mode.
- `?syntax=pseudo-light`, `pseudo-dark`, `paper`, `contrast` or `night-shift` picks a code theme. `night-shift` is an example of a user-made theme.
- `?settings` opens Settings › Appearance in the editor.

For example: `app.html?theme=dark&syntax=night-shift&settings`.

## How theming works

`rail.css` keeps two layers separate:

- `data-theme` sets the interface colours (`--bg`, `--ink`, `--accent`, …).
- `data-syntax` sets the code colours (`--syn-keyword`, `--syn-string`, …), including the editor and output background.

A custom theme is just a set of `--syn-*` values, so it can be saved as JSON and mapped to a Monaco theme with `monaco.editor.defineTheme`.

The PNG files are 1440×900 screenshots of each state at 2× scale.
