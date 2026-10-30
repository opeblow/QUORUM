# UI-REFERENCES.md — World-class UI sources & design system

Rule: we **use** permissively licensed components (MIT/Apache/ISC/OFL) and keep their license notices; we take **inspiration only** (layout, motion, rhythm) from commercial sites — never copy their assets, logos, copy or proprietary code. "Check" = verify license before importing.

## 1. Component sources (GitHub)
| Source | Repo | License | Use it for |
|---|---|---|---|
| shadcn/ui | github.com/shadcn-ui/ui | MIT | Base primitives (dialog, sheet, tabs, command, form) |
| Radix UI | github.com/radix-ui/primitives | MIT | Accessible primitives under shadcn |
| Magic UI | github.com/magicuidesign/magicui | MIT | Landing hero, animated beams (agent↔agent links), border beams, number tickers |
| Origin UI | github.com/origin-space/originui | MIT | Dense app UI: inputs, tables, timelines, badges |
| motion-primitives | github.com/ibelick/motion-primitives | MIT | Text effects, transitions, morphing cards |
| prompt-kit | github.com/ibelick/prompt-kit | MIT | AI-native message/stream components |
| Kibo UI | github.com/haydenbleasel/kibo | MIT | Kanban, status, avatar stacks |
| Cult UI | github.com/nolly-studio/cult-ui | MIT | Expressive cards, dynamic island |
| Aceternity UI | ui.aceternity.com | Custom (check) | Spotlight / glow hero effects (marketing only) |
| React Bits | github.com/DavidHDev/react-bits | Check | Background effects |
| React Flow (xyflow) | github.com/xyflow/xyflow | MIT | Agent constellation graph (if not custom SVG) |
| Motion | github.com/motiondivision/motion | MIT | All animation |
| Sonner / Vaul / cmdk | emilkowalski/sonner, emilkowalski/vaul, pacocoursey/cmdk | MIT | Toasts, mobile drawers (approval on phone), ⌘K |
| Lucide | github.com/lucide-icons/lucide | ISC | Icons |
| Geist | github.com/vercel/geist-font | OFL | Typeface (Sans + Mono) |
| Tremor | github.com/tremorlabs/tremor | Apache-2.0 | Usage/cost charts in dashboard |

Avoid: tldraw (non-permissive commercial license), any "premium" template we don't own.

## 2. Inspiration (look, don't copy)
| Site | Steal the *idea* of |
|---|---|
| linear.app | Density, keyboard-first, calm dark surfaces, crisp 1px borders |
| vercel.com / geist | Typographic hierarchy, grid backgrounds, restraint |
| granola.ai | Meeting-notes UX (our closest competitor — beat it on liveness) |
| raycast.com | Command palette, glassy panels |
| cursor.com / perplexity.ai | Streaming AI answers with inline sources |
| resend.com | Developer-grade marketing page polish |
| **kaleidoskop.jigjoy.ai** | **The judges' own visual language**: hexagon participants, event "ripples". Nod to it in our constellation + offer export to it. |

## 3. Quorum design system
- **Theme:** dark-first (meeting rooms are projected), full light theme. Tokens as CSS vars; `prefers-color-scheme` + manual toggle.
- **Type:** Geist Sans (UI), Geist Mono (timestamps, event log). Scale 12/14/16/20/28/44.
- **Color:** neutral zinc surfaces; **one hue per agent** (Scribe slate, Fact-Checker emerald, Researcher sky, Decision violet, Action amber, Devil's Advocate rose, Memory indigo, Moderator zinc). Status colors separate from agent hues.
- **Motion:** 150–250ms ease-out; agent "thinking" = soft pulse; event fan-out = beam from source agent to card; respect `prefers-reduced-motion`.
- **Layout (Room view):** 3 columns ≥1280px — Transcript | Constellation | Cards. Tablet: Constellation collapses to a strip. Phone (≥360px): tabs (Live · Cards · Approvals) + bottom-sheet approvals.
- **A11y:** WCAG AA contrast, full keyboard nav, live regions for new cards, captions always on.
- **Signature moments:** (1) constellation where several agents light up at once, (2) Fact-Checker card flip with verdict, (3) approval request sliding onto a phone.

## 4. Screens
1. Landing (hero w/ live demo loop) · 2. Sign-in · 3. Dashboard (rooms, teams, usage) · 4. New room (template picker) · 5. **Live Room** · 6. Approvals sheet · 7. Recap page (shareable) · 8. Replay (scrubber) · 9. Team memory · 10. Settings/billing.
