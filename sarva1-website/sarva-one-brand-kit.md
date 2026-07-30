# Sarva One — Brand Kit v1.0
**Retail Business Management Software for Indian retail shop owners**
Tagline: *Professional Software. Personal Support.* · sarva1.com

---

## SECTION 1 — COLOR PALETTE

### Primary Colors

| Name | Hex | RGB | HSL | Use it for | Don't use it for |
|---|---|---|---|---|---|
| **Primary Blue** | `#2563EB` | `37, 99, 235` | `221°, 83%, 53%` | Primary CTAs, links, active nav states, focus rings, brand accent, left loop of logo. Contrast on white ≈ 5.2:1 — safe for body-size text, not just large text. | Large body-copy blocks (use Slate-700 instead), backgrounds under white text smaller than 14px |
| **Primary Dark (Navy)** | `#0F172A` | `15, 23, 42` | `222°, 47%, 11%` | Headings, primary body text, footer/nav backgrounds, right loop + "1" of logo, dark-mode surface color | Small accents where blue is more on-brand; never use pure black `#000000` anywhere in the system — navy is the brand's "black" |

### Secondary Colors

| Name | Hex | RGB | HSL | Use it for | Don't use it for |
|---|---|---|---|---|---|
| **Success Green** | `#16A34A` | `22, 163, 74` | `142°, 76%, 36%` | Active license, successful sync/backup, "Paid" status, positive deltas | Generic decoration, non-status UI |
| **Warning Amber** | `#D97706` | `217, 119, 6` | `32°, 95%, 44%` | Trial countdown, low stock, pending renewal, unsaved changes | Errors (too easily confused with real failures if overused) |
| **Error Red** | `#DC2626` | `220, 38, 38` | `0°, 72%, 51%` | Expired license, failed payment, destructive-action confirmation, validation errors | Warnings or informational banners |

### Neutral Grays (Slate scale — shares the same hue family as Primary Dark, so text and UI chrome always feel unified with the brand navy)

| Name | Hex | RGB | HSL | Use it for |
|---|---|---|---|---|
| Slate-900 | `#0F172A` | `15, 23, 42` | `222°, 47%, 11%` | Primary text, headings (= Primary Dark) |
| Slate-700 | `#334155` | `51, 65, 85` | `215°, 25%, 27%` | Secondary body text |
| Slate-500 | `#64748B` | `100, 116, 139` | `215°, 16%, 47%` | Placeholder text, disabled text, captions |
| Slate-300 | `#CBD5E1` | `203, 213, 225` | `213°, 27%, 84%` | Borders, dividers, input outlines |
| Slate-100 | `#F1F5F9` | `241, 245, 249` | `210°, 40%, 96%` | Light section backgrounds, table stripe, hover fill |
| Slate-50 | `#F8FAFC` | `248, 250, 252` | `210°, 40%, 98%` | Off-white page background |

### Extended Palette

**Light tints of Primary Blue** (blue mixed over white — for selected states, chart fills, badge backgrounds):

| Tint | Hex | RGB | HSL | Typical use |
|---|---|---|---|---|
| Blue 10% | `#E9EFFD` | `233, 239, 253` | `222°, 83%, 95%` | Selected row background, subtle info banner |
| Blue 20% | `#D3E0FB` | `211, 224, 251` | `221°, 83%, 91%` | Hover state on light cards, chart gridfill |
| Blue 50% | `#92B1F5` | `146, 177, 245` | `221°, 83%, 77%` | Chart bars/lines at reduced emphasis, disabled primary button fill |

**Backgrounds**

| Name | Hex | Use |
|---|---|---|
| Pure White | `#FFFFFF` | Cards, modals, input fields — the "paper" surface |
| Off-White | `#F8FAFC` (Slate-50) | Page/app background behind cards |
| Light Gray | `#F1F5F9` (Slate-100) | Section dividers on marketing pages, disabled field background |

**Dark Mode** (for the desktop app's optional dark theme — billing software is often used in dim shop counters at night, so this isn't cosmetic)

| Token | Hex | Notes |
|---|---|---|
| `--bg-dark` | `#020617` (Slate-950) | App background |
| `--surface-dark` | `#0F172A` (= Primary Dark) | Cards/panels — the brand navy becomes the surface color, so dark mode still reads as "Sarva One" |
| `--text-dark-primary` | `#F8FAFC` | Primary text on dark |
| `--text-dark-secondary` | `#94A3B8` (Slate-400) | Secondary text on dark |
| `--accent-dark` | `#60A5FA` (Blue-400) | Links/CTAs on dark — lighter than the standard Primary Blue so text stays AA/AAA compliant (~7.9:1 against `#020617`); `#2563EB` itself only hits ~3.5:1 on navy, fine for large buttons/icons but not for small text |

---

## SECTION 2 — TYPOGRAPHY

### Font selection

Kannada and Latin need to sit in the same UI (invoices, WhatsApp replies, shop-owner-facing labels), so the pairing is built around **script coverage first, then character**:

| Role | Font | Why |
|---|---|---|
| **Display / Headings** | **Manrope** (Google Fonts, weights 200–800) | Geometric, confident, modern without feeling like a generic startup font. Used only where content is guaranteed English (marketing headlines, app shell chrome) |
| **Body / UI / anywhere English and Kannada may mix** | **Noto Sans** (Latin) + **Noto Sans Kannada** (companion) | Both are part of Google's Noto family, engineered by the same team for harmonized x-height, stroke weight, and rhythm across scripts — so a sentence that switches from English to Kannada mid-line doesn't visually clash. Both ship as variable fonts covering weights 100–900, so every weight in the scale below is available in both scripts |
| **Code / numeric data** | **JetBrains Mono** (weights 400, 500) | Invoice numbers, GSTINs, license keys, SKUs — anywhere a shop owner needs to read a number without ambiguity (tabular figures, clear 0/O and 1/l distinction) |

```css
--font-display: 'Manrope', 'Noto Sans Kannada', sans-serif; /* Kannada display text: skip Manrope, go straight to Noto Sans Kannada Bold */
--font-body: 'Noto Sans', 'Noto Sans Kannada', sans-serif;
--font-mono: 'JetBrains Mono', 'Noto Sans Kannada', monospace;
```

### Type scale

| Level | Font | Weight | Size (px / rem) | Line height | Letter spacing | When to use |
|---|---|---|---|---|---|---|
| Display | Manrope | 700 | 56px / 3.5rem | 1.1 | -0.02em | Website hero headline only |
| H1 | Manrope | 700 | 40px / 2.5rem | 1.2 | -0.01em | Page titles, dashboard section header |
| H2 | Manrope | 600 | 32px / 2rem | 1.25 | -0.01em | Marketing section headings |
| H3 | Manrope | 600 | 24px / 1.5rem | 1.3 | 0em | In-app panel/card group titles |
| H4 | Manrope | 600 | 20px / 1.25rem | 1.35 | 0em | Card titles, modal titles |
| Body Large | Noto Sans | 400 | 18px / 1.125rem | 1.6 | 0em | Intro paragraphs, plan descriptions |
| Body Regular | Noto Sans | 400 | 16px / 1rem | 1.6 | 0em | Default UI text, product copy, all Kannada body copy |
| Body Small | Noto Sans | 400 | 14px / 0.875rem | 1.5 | 0em | Helper text, table cells, secondary info |
| Caption | Noto Sans | 500 | 12px / 0.75rem | 1.4 | 0.01em | Timestamps, metadata, footnotes |
| Label | Noto Sans | 600 | 13px / 0.8125rem | 1.3 | 0.02em | Form labels, table headers (uppercase optional) |
| Code | JetBrains Mono | 400–500 | 14px / 0.875rem | 1.5 | 0em | Invoice #, GSTIN, license key, SKU |

**Kannada note:** when a Kannada string appears in a heading slot (H1–H4), swap Manrope for **Noto Sans Kannada** at the same size/weight — Manrope has no Kannada glyphs and will silently fall back to the system font, breaking the type rhythm.

---

## SECTION 3 — LOGO USAGE RULES

### Logo variants

| Variant | Composition | Use for |
|---|---|---|
| **Primary logo** | ∞1 symbol + "Sarva One" wordmark, horizontal, symbol on the left | Default — website header, invoices, marketing, business cards |
| **Stacked logo** | Symbol centered above "Sarva One" wordmark | Square/near-square spaces — app splash screen, social profile picture, packaging |
| **Symbol only** | Just the ∞1 mark | Favicon, app icon, watermark, anywhere under 80px wide |
| **Wordmark only** | "Sarva One" text, no symbol | Contexts where the symbol is already established (e.g., repeated inside one document) or where the mark won't render legibly |

### Color variations

| Version | Where | Spec |
|---|---|---|
| Full color on white | Default | Left loop `#2563EB`, right loop + "1" `#0F172A` |
| Full color on dark | Dark backgrounds (`#0F172A` or darker) | Left loop stays `#2563EB`; right loop + "1" switch from Navy to White `#FFFFFF` so the mark doesn't disappear into the background |
| Single-color blue | Stamps, one-color print, favicons at small sizes | Entire mark in `#2563EB` |
| Single-color white | Dark photos, colored backgrounds, dark mode footer | Entire mark in `#FFFFFF` |
| Single-color dark | Light non-white backgrounds (e.g., on top of Slate-100 or a light product photo) | Entire mark in `#0F172A` |

### Minimum sizes

| Context | Minimum size |
|---|---|
| Web — primary logo | 120px wide |
| Web — symbol only | 24px wide |
| Print — primary logo | 25mm wide |
| Print — symbol only | 8mm wide |
| App icon | Export at 16, 32, 48, 64, 128, 256, 512px — use **symbol only**, simplified (drop any fine diagonal-slash detail that won't hold at 16px) |

### Clear space

Define **X** = the cap-height of the letter "S" in "Sarva" at the logo's current size.
- Minimum clear space on **all four sides** of the full lockup = **1X**
- No text, icon, edge of a card, or competing graphic may enter that 1X margin
- When the logo sits on a busy photo, increase clear space to **1.5X** and add a solid-color plate behind it if contrast is uncertain

### Incorrect usage — never do this

1. Don't stretch or squash the logo disproportionately
2. Don't rotate the logo off its horizontal axis
3. Don't recolor the loops outside the approved color variations above
4. Don't add drop shadows, glows, bevels, or gradients
5. Don't place the full-color logo on a background that doesn't meet contrast minimums (test against Slate-500 and darker)
6. Don't separate the "1" from the infinity loop or resize it independently
7. Don't recreate the wordmark in a different typeface than the approved lockup file
8. Don't crop or mask the logo into a shape (circle badges, squeezed banners) — use the symbol-only variant instead for tight spaces

---

## SECTION 4 — VOICE AND TONE

### Brand voice pillars

**1. Straightforward**
What it means for Sarva One: a shop owner should understand what the software just did without re-reading the sentence. No jargon, no filler.
- ✅ "Your bill is saved. Print it or send it on WhatsApp."
- ✅ "Stock for Blue Cotton Saree is now 12."
- ❌ "Your transaction has been successfully processed and persisted to the database."
- ❌ "Please utilize the export functionality to obtain your inventory report."

**2. Dependable**
What it means: the tone of a business partner who's been doing this for years, not a startup still figuring things out. Calm, precise, never dramatic.
- ✅ "Backup completed. Last backup: today, 6:42 PM."
- ✅ "This bill number is already used. Try 1043 instead."
- ❌ "Oops! Something went wrong 😬"
- ❌ "We're not 100% sure, but this might work?"

**3. Warm**
What it means: "Personal Support" isn't a slogan — every message should sound like a person who knows the shop owner's business, not a ticketing system.
- ✅ "Namaskara! Saw your message — checking your stock count now."
- ✅ "All set for the festival season — your billing is backed up daily."
- ❌ "Dear Customer, your query has been logged. Reference #48213."
- ❌ "Kindly revert at your earliest convenience."

### Tone by context

| Context | Tone | Example |
|---|---|---|
| Marketing copy (website, ads) | Confident, benefit-first, plain | "Bill in seconds. Track stock without a notebook." |
| Product UI (buttons, labels, errors) | Direct, active-voice, tells you what happens | Button: "Save Bill" · Label: "Customer Name" |
| Support messages (WhatsApp) | Personal, first name, quick | "Hi Ramesh ji, got your message. Give me 5 minutes to check this." |
| Error messages | States what happened + how to fix it, no blame | "This phone number is already used for another customer. Check the number and try again." |
| Success messages | Short, confirms the specific action, no exclamation overload | "Bill #1043 saved." |

### Writing rules

- **Reading level:** 8th grade maximum — every sentence should be understandable to a shop owner, not an engineer
- **Sentence length:** keep to under ~18 words; break longer instructions into two sentences or a numbered list
- **Always use:** plain verbs ("save," "print," "send"), the shop owner's own vocabulary ("bill," "stock," "customer"), Indian number formatting (₹1,25,000 not ₹125,000)
- **Never use:** technical/backend terms ("database," "API," "sync payload," "null"), false urgency ("Hurry!", "Don't miss out!"), passive voice in error messages ("An error has occurred")
- **Kannada/English code-switching:** product and billing terms stay in English even inside Kannada sentences (bill, stock, GST, backup, customer, print) — these are the words shop owners already use daily in this domain. Greetings, connective phrases, and warmth ("Namaskara," "dhanyavadagalu," "sari illa, no problem") can switch to Kannada naturally. Never machine-translate an English idiom literally into Kannada — write the Kannada sentence fresh.
- **Punctuation:** sentence case everywhere (not Title Case for buttons/labels), one exclamation mark maximum per message and only for genuine good news, no ALL CAPS except acronyms (GST, UPI)

---

## SECTION 5 — UI DESIGN TOKENS

```css
/* Spacing — base 4px */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;

/* Border radius */
--radius-sm: 6px;    /* inputs, badges, small buttons */
--radius-md: 10px;   /* buttons, form fields */
--radius-lg: 16px;   /* cards, modals */
--radius-xl: 24px;   /* hero panels, feature cards */
--radius-full: 9999px; /* pills, avatars */

/* Shadows — tinted with brand navy instead of pure black, so elevation feels on-brand */
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
--shadow-md: 0 4px 8px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);
--shadow-lg: 0 12px 24px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06);
--shadow-xl: 0 24px 48px rgba(15, 23, 42, 0.16), 0 8px 16px rgba(15, 23, 42, 0.08);

/* Borders */
--border-default: 1px solid #CBD5E1; /* Slate-300 */
--border-strong: 1px solid #334155;  /* Slate-700 */
--border-subtle: 1px solid #F1F5F9;  /* Slate-100 */

/* Transitions */
--transition-fast: 120ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 320ms cubic-bezier(0.4, 0, 0.2, 1);

/* Z-index */
--z-dropdown: 1000;
--z-sticky: 1100;
--z-overlay: 1200;
--z-modal: 1300;
--z-toast: 1400;
```

---

## SECTION 6 — COMPONENT VISUAL STYLE

### Buttons

| Variant | Background | Text | Border | Radius / Padding | Hover | Active | Disabled |
|---|---|---|---|---|---|---|---|
| **Primary** | `#2563EB` | `#FFFFFF` | none | `--radius-md`, `12px 20px` | Background → `#1D4ED8`, `--shadow-sm` | Background → `#1E40AF`, scale(0.98) | Background → Blue 50% tint `#92B1F5`, text `#FFFFFF` at 70% opacity |
| **Secondary** | `#FFFFFF` | `#0F172A` | `1.5px solid #CBD5E1` | `--radius-md`, `12px 20px` | Border → `#2563EB`, text → `#2563EB` | Background → `#F1F5F9` | Border/text → Slate-300, no pointer events |
| **Ghost** | transparent | `#2563EB` | none | `--radius-md`, `10px 16px` | Background → Blue 10% tint `#E9EFFD` | Background → Blue 20% tint `#D3E0FB` | Text → Slate-300 |
| **Destructive** | `#FFFFFF` | `#DC2626` | `1.5px solid #DC2626` | `--radius-md`, `12px 20px` | Background → `#DC2626`, text → `#FFFFFF` | Background → `#B91C1C` | Border/text → Slate-300 |

### Cards

| Variant | Background | Border | Radius | Shadow | Padding |
|---|---|---|---|---|---|
| **Default** | `#FFFFFF` | `--border-subtle` | `--radius-lg` | `--shadow-sm` | `24px` |
| **Highlighted** (pricing/featured) | `#FFFFFF` | `2px solid #2563EB` | `--radius-lg` | `--shadow-lg` | `24px`, plus a small badge/ribbon in Primary Blue |
| **Subtle** | `#F8FAFC` | none | `--radius-md` | none | `16px` |

### Form inputs

| State | Border | Background | Text/Icon | Notes |
|---|---|---|---|---|
| Default | `1.5px solid #CBD5E1` | `#FFFFFF` | Slate-900 text, Slate-500 placeholder | `--radius-md`, `10px 14px` |
| Focus | `1.5px solid #2563EB` | `#FFFFFF` | — | Add `0 0 0 3px rgba(37,99,235,0.15)` focus ring |
| Error | `1.5px solid #DC2626` | `#FFFFFF` | Error text below in `#DC2626`, Body Small | Icon: error triangle, `#DC2626` |
| Success | `1.5px solid #16A34A` | `#FFFFFF` | Checkmark icon, `#16A34A` | Used for validated fields (e.g., GSTIN checked) |

### Badges / pills

Directly maps to license and stock states in the product:

| Badge | Background | Text | Use |
|---|---|---|---|
| Success | `#DCFCE7` | `#16A34A` | "Active" license, "In Stock" |
| Warning | `#FEF3C7` | `#D97706` | "Trial — 5 days left", "Low Stock" |
| Error | `#FEE2E2` | `#DC2626` | "Expired", "Out of Stock" |
| Neutral | `#F1F5F9` | `#334155` | "Draft", "Info" |

All badges: `--radius-full`, `4px 12px`, Label type style.

### Navigation

- **Header/navbar:** `#FFFFFF` background, `--border-subtle` bottom border, `64px` height, logo (primary lockup) left-aligned, nav links in Body Regular/Slate-700, active link underlined in `#2563EB`
- **Mobile menu:** full-screen overlay in `#FFFFFF`, `--z-overlay`, links in H4 size stacked with `--space-6` gap, close icon top-right

---

## SECTION 7 — IMAGERY AND ICON STYLE

### Photography

- **Subject matter:** real shop interiors — saree/textile racks, a shop owner at the billing counter, hands on a keyboard next to a physical bill book, festival-season shop floors. Show the software being used in context, not people in a generic office
- **Color treatment:** warm and neutral — let the natural warmth of fabric/textile shops (marigold, maroon, gold saree tones) come through rather than color-grading toward cool corporate blue
- **Avoid:** generic international stock photos (obviously non-Indian offices/people), staged "salesperson in a suit" imagery, overly dark moody tech-startup lighting, laptop-on-white-desk cliché shots with no retail context

### Icon style

| Property | Spec |
|---|---|
| Style | Outline/stroke, not filled |
| Stroke weight | 1.5–2px |
| Corners | Rounded caps and joins (approachable, matches the rounded infinity logo) |
| Library | **Lucide** — open-source, MIT-licensed, huge coverage, tree-shakeable for the React frontend, consistent 24×24 grid that matches this stroke spec out of the box |
| Sizes | 16px (inline with Caption/Label text), 20px (buttons, form fields), 24px (nav, standalone actions), 32px (empty states, feature highlights) |

### Illustration

Use sparingly — only for empty states and first-time onboarding, never as decorative filler on marketing pages. When used: simple two-color line art (Primary Blue line work on a Blue 10% tint background), flat, no gradients or 3D — avoid the generic AI-gradient-blob or mesh-gradient look that reads as templated.

---

## SECTION 8 — BRAND APPLICATION EXAMPLES

**1. Business card**
Front: primary logo lockup top-left, name + title in H4/Body Small, phone/WhatsApp/email stacked bottom-left, all on white with `1X` clear space margins. Back: solid `#0F172A` navy with the white single-color symbol centered, tagline "Professional Software. Personal Support." in Body Small white, centered below.

**2. WhatsApp Business profile**
Name: "Sarva One". Category: Business Software. About: "Billing & inventory software for retail shops. Message us anytime." Profile photo: symbol-only mark on white. Greeting message: "Namaskara! This is Sarva One support. How can we help with your billing today?"

**3. Instagram**
Profile photo: symbol-only mark on white circle crop-safe area. Bio: one line on what the product does + link to sarva1.com. Post template: consistent `#FFFFFF` or `#0F172A` background, Manrope H2/H3 headline in Primary Blue or white, small primary logo bottom-right corner on every post for recognizability.

**4. Invoice footer**
Centered or right-aligned, Caption size, Slate-500: "Powered by Sarva One — sarva1.com", with the symbol-only mark at 16px inline before the text.

**5. Email signature**
Primary logo (small, ~140px) top, name/title in Body Small bold, company line in Body Small Slate-700, phone/WhatsApp/website in Body Small with Primary Blue links, no background color — plain white for compatibility across email clients.

---

*End of Brand Kit v1.0 — all hex/RGB/HSL values and CSS tokens above are implementation-ready for sarva1.com, the product UI, and marketing collateral.*
