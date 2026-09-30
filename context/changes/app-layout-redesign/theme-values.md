# Theme values — light beach/travel palette

**Source:** the beach/travel palette agreed in `change.md` ("Theme details": sand and warm neutrals for backgrounds and surfaces, orange as primary/accent, WCAG AA text contrast). The concrete OKLCH values were chosen in this change (Phase 2) and live in `src/styles/global.css` `:root`, published through `@theme inline`.

Scope: light theme only. `.dark`, `--chart-*` and `--sidebar-*` keep the shadcn defaults (dark mode is out of scope).

## Tokens

| Token | OKLCH value | Role |
| --- | --- | --- |
| `--background` | `oklch(0.97 0.018 80)` | Page background, warm sand off-white |
| `--foreground` | `oklch(0.27 0.04 50)` | Body text, deep warm brown |
| `--card` | `oklch(0.99 0.008 85)` | Card surface, near-white warm, lifts off the sand |
| `--card-foreground` | `oklch(0.27 0.04 50)` | Text on cards |
| `--popover` | `oklch(0.99 0.008 85)` | Popover/menu surface (same as card) |
| `--popover-foreground` | `oklch(0.27 0.04 50)` | Text in popovers |
| `--primary` | `oklch(0.55 0.15 45)` | Primary actions, burnt orange (dark enough for light text) |
| `--primary-foreground` | `oklch(0.99 0.008 85)` | Text/icons on primary |
| `--secondary` | `oklch(0.93 0.03 80)` | Secondary buttons, deeper sand |
| `--secondary-foreground` | `oklch(0.33 0.05 50)` | Text on secondary |
| `--muted` | `oklch(0.94 0.022 80)` | Muted fills (skeletons, subtle panels) |
| `--muted-foreground` | `oklch(0.48 0.035 55)` | Secondary/helper text |
| `--accent` | `oklch(0.93 0.04 70)` | Hover/active fills, light apricot |
| `--accent-foreground` | `oklch(0.33 0.06 45)` | Text on accent |
| `--destructive` | `oklch(0.53 0.2 27)` | Errors and destructive actions (used as text and fill) |
| `--border` | `oklch(0.88 0.03 75)` | Borders and dividers, warm sand line |
| `--input` | `oklch(0.88 0.03 75)` | Input borders |
| `--ring` | `oklch(0.62 0.16 48)` | Focus ring, orange |
| `--success` | `oklch(0.5 0.12 155)` | Success state fill (new role) |
| `--success-foreground` | `oklch(0.99 0.008 85)` | Text/icons on success |

All values are inside the sRGB gamut.

## Contrast (WCAG 2.x relative luminance)

Text pairs need ≥ 4.5:1 (AA). The focus ring is a non-text UI indicator and needs ≥ 3:1.

| Pair (text / background) | Ratio | Requirement |
| --- | --- | --- |
| `foreground` / `background` | 13.95:1 | ≥ 4.5 |
| `card-foreground` / `card` | 14.79:1 | ≥ 4.5 |
| `popover-foreground` / `popover` | 14.79:1 | ≥ 4.5 |
| `muted-foreground` / `background` | 6.05:1 | ≥ 4.5 |
| `muted-foreground` / `card` | 6.42:1 | ≥ 4.5 |
| `muted-foreground` / `muted` | 5.54:1 | ≥ 4.5 |
| `primary-foreground` / `primary` | 5.02:1 | ≥ 4.5 |
| `secondary-foreground` / `secondary` | 10.09:1 | ≥ 4.5 |
| `accent-foreground` / `accent` | 10.11:1 | ≥ 4.5 |
| `destructive` / `card` | 5.69:1 | ≥ 4.5 |
| `destructive` / `background` | 5.36:1 | ≥ 4.5 |
| `success-foreground` / `success` | 5.50:1 | ≥ 4.5 |
| `ring` / `background` | 3.54:1 | ≥ 3 (non-text) |
| `ring` / `card` | 3.76:1 | ≥ 3 (non-text) |

Method: OKLCH → OKLab → LMS → linear sRGB (clamped to [0, 1]), relative luminance `0.2126 R + 0.7152 G + 0.0722 B`, ratio `(L1 + 0.05) / (L2 + 0.05)`.

When changing a value, recompute the ratios and keep every text pair ≥ 4.5:1. Orange is the easy one to break: a brighter `--primary` with light text drops below AA fast.
