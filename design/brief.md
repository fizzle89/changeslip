# Changeslip design brief (2026-10-24)

## Audience and job
Subcontractors (electrical, plumbing, framing crews) who did extra work on a signed
time-and-materials ticket and need a priced change-order packet their GC can sign off.
The job: type the ticket, price it against the approved rate card and the GC's markup
terms, export a packet PDF. Trust and jobsite practicality are the whole product.

## Identity: "Job ticket on the blueprint table"
Construction-document language, distinct from sibling products (Signal Traffic = green
analytics dashboard, Human-made = certificate/seal, Fix-It = warm cream serif editorial):
- Typography: "Barlow Semi Condensed" for headings and the wordmark (sturdy, industrial,
  signage-like), system sans for body, "IBM Plex Mono" for rates, amounts and reference
  labels - money on a ticket is always mono. Loaded from Google Fonts with system fallbacks.
- Color: blueprint ink navy (#16324f heading / #0f2740 deep) on paper (#f7f5f0), hi-vis
  safety orange (#e8590c) as the single action accent, tape-yellow (#f2c94c) reserved for
  warning flags, red for errors. Dark theme: true blueprint (#0e2a47 grid-blue surface,
  #103252 card) with light ink and orange kept as accent.
- Components: numbered step cards that read like ticket sections (big outline step
  numerals), tables styled as ruled ledger paper (thin row rules, mono numeric column),
  dashed-border "backup documents" card (stapled-evidence feel), pill badges for
  rate-card provenance. Buttons: solid orange primary, outlined ghost, small neutral chip
  for row remove.
- Header: product wordmark + one-line promise + theme toggle; footer keeps the honest
  scope paragraph verbatim.

## Layout
Single-column document flow (max 980px). Hero = wordmark + promise + the honest
does/does-not card. Steps 1-6 unchanged in order and IDs (app.js bindings intact).
Pro upsell becomes a dark blueprint band with the $29 Polar link unchanged.

## Mobile
390px first: step cards stack, grid fields collapse to one column, tables scroll inside
their own container (overflow-x:auto, min-width per table) so the page itself never
scrolls horizontally. Touch targets >= 40px.

## Motion
Motion only where it clarifies: step cards fade/slide 12px on scroll entry via
IntersectionObserver (no library; static page), 200ms ease-out, staggered 40ms; theme
toggle cross-fades colors 150ms; button hover lift 1px. prefers-reduced-motion: all
entry motion disabled, content visible without JS. No animation on amounts or flags.
GSAP/Three.js skipped: no earned choreography or spatial concept on a form page.

## Accessibility
Labels stay bound to inputs, focus-visible outlines in accent, contrast checked
(orange on white used only at >= 14px bold or on dark), decorative numerals aria-hidden,
theme toggle is a real button with aria-pressed and localStorage persistence, defaulting
to the device preference with no flash on load.

## References
- https://styles.refero.design/ - "design tool aesthetic" and quiet-document style
  systems reviewed for type/color discipline; chose condensed industrial sans + mono money.
- https://component.gallery/ - table and form-control patterns for ledger rows.
- https://cta.gallery/ - single-accent CTA discipline (one orange action per section).
- https://navbar.gallery/ - minimal product header pattern (wordmark left, toggle right).
- https://footer.design/ - honest-scope footer treatment.
- https://ui.shadcn.com/ - card/field anatomy (radius, border, ring) adapted to CSS vars.
- https://motion-primitives.com/ - entry-transition timing reference (kept CSS-only).

## Visual acceptance criteria
- Real pixels at 390px and 1280px: hero, a filled step card, ledger table, Pro band.
- Zero page horizontal overflow at both widths (document.body.scrollWidth == innerWidth).
- Sample ticket flow runs end-to-end and the flags/summary render in the new styles.
- Both Polar checkout hrefs unchanged; dark and light themes both inspected.
