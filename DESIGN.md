---
name: 회의 코치
description: Muted green and neutral controls for a Korean meeting workspace.
colors:
  primary: "#315e43"
  primary-foreground: "#fff"
  canvas: "#f6f7f3"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  workspace-ink: "#24352d"
  muted-ink: "#5e6d62"
  record-surface: "#e8eee8"
  field-surface: "#fafbf8"
  self-surface: "#f1f6ef"
  panel-border: "#dce3dc"
  divider: "#e6ebe6"
  input: "oklch(0.922 0 0)"
  accent: "oklch(0.97 0 0)"
  ring: "#347553"
  live: "#bd3d36"
  error-surface: "#fff5ee"
  error-ink: "#813b21"
typography:
  title:
    fontFamily: "Arial, 'Noto Sans KR', sans-serif"
    fontSize: "24px"
    fontWeight: 650
    letterSpacing: "-0.5px"
  panel-title:
    fontSize: "16px"
    fontWeight: 650
  body:
    fontFamily: "Arial, 'Noto Sans KR', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  transcript:
    fontSize: "14px"
    lineHeight: 1.9
  label:
    fontSize: "12px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  panel: "12px"
spacing:
  control-gap: "9px"
  grid-gap: "20px"
  panel-inline: "22px"
  shell-inline: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  input:
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  workspace-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.panel}"
  native-select:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "5px 28px 5px 9px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "#255138"
    height: "44px"
    padding: "12px 9px"
---

# Design System: 회의 코치

## Overview

The implemented workspace is a compact, muted green and neutral operating surface. White panels, thin dividers and restrained controls support intermittent reading during a Korean meeting. This document records the existing implementation; it does not establish a new brand metaphor.

The current `coach-*` workspace extends the inherited identity through shadcn components. Legacy `meeting-*` styles remain for older surfaces and differ in spacing, type and radii; they are not the template for new workspace panels. Source of truth: `src/app/globals.css` and `src/components/ui/`.

**Key Characteristics:**
- Muted green actions and selected states.
- Compact labels with generous transcript line height.
- Thin borders and almost imperceptible panel shadows.

## Colors

### Primary

Green identifies the primary action, active navigation and keyboard focus. The workspace locally overrides shadcn's neutral primary and ring variables; the global defaults remain neutral outside it.

### Neutral

The warm canvas surrounds white cards. Pale green surfaces distinguish recording controls and the user's utterances. Muted green-gray text supports labels and timestamps. Card foreground remains the inherited shadcn dark neutral, while the shell uses workspace ink.

Recording red and warm error colors are semantic signals used alongside text. The global stylesheet contains dark tokens, but the custom workspace palette is light-specific; a coherent dark workspace is not implemented.

## Typography

Use the existing Arial stack; Noto Sans KR is a fallback name, not a bundled font. No custom font or image asset is required. The title is an editable input; it reduces to (20px) on mobile. Panel titles use the panel-title role. Transcript and assistance prose use the transcript line height, with transcript and summary text capped at (72ch). Labels and supporting copy mostly range from (10px) to (13px); no large display typography appears in this surface.

## Layout

The workspace container caps at (1500px), with (32px) horizontal padding. The header is (72px) high. The desktop grid uses `minmax(0, 1.17fr) minmax(0, 1fr)` and the grid-gap token. Transcript and assistance panels scroll internally, capped at (480px) and (485px).

At (1000px), recording controls stack and wrap. At (760px), shell padding becomes (14px), the header becomes (61px), and the grid becomes a single panel selected by the existing conversation/help button. Summary, notes and reference material remain tabs inside conversation. Mobile scroll areas cap at (55dvh). Do not describe this implementation as three mobile top-level tabs.

## Elevation & Depth

Borders and pale fills provide most separation. Workspace cards use `0 2px 6px #20332204`; the final report has no shadow. shadcn controls retain their small default shadows and focus rings. There is no imagery, glass treatment or decorative depth system.

## Shapes

Controls inherit the shadcn radius scale from (0.625rem): small (6px), medium (8px), large (10px). Workspace panels explicitly use (12px). Native selects use small corners; editable textareas use (7px). Circular avatars and tiny self tags are distinct exceptions.

## Components

- **Button:** shadcn default, outline and ghost variants. Default is green in the workspace. Disabled controls use half opacity and suppress pointer events. Icon-bearing default buttons use (12px) horizontal padding instead of (16px).
- **Input:** shadcn bordered input; title and purpose fields intentionally remove the border and shadow. Manual transcript input is (35px) high with (12px) text.
- **Card:** shadcn structure, with workspace padding and gaps reset; headings and content supply their own inset spacing.
- **Tabs:** Radix/shadcn behavior, visually overridden to a transparent strip with a green (2px) active underline. Keep keyboard navigation and selected-state semantics.
- **Switch:** shadcn/Radix pill switch, green when checked. The final CSS removes an earlier scale transform; setting labels supply at least (28px) height and (44px) on mobile.
- **Native select:** browser select controls with a white fill, compact border and explicit labels; these are not shadcn Select components.
- **Transcript:** circular initial, speaker name, timestamp and self tag. Self rows have a pale fill. Evidence links target utterances, which receive an inset outline.

Keyboard focus uses the workspace ring color with a (2px) outline and (3px) offset in addition to inherited component rings. Reduced-motion preference removes workspace transition durations. Component previews in the sidecar reproduce visual states without replacing Radix interaction behavior.

## Do's and Don'ts

- Do reuse the existing shadcn primitives and workspace overrides.
- Do preserve visible labels, speaker identity, evidence links and keyboard focus.
- Do use thin dividers and pale fills to separate dense meeting information.
- Don't treat legacy meeting styles as current workspace tokens.
- Don't imply custom fonts, imagery or a complete dark workspace are implemented.
- Don't use color alone to identify recording, errors or the user's speaker.
