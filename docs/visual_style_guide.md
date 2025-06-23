# Visual Style Guide: NFL Gladiator Arena

This document establishes the official visual identity for the gaming platform. The chosen theme, "NFL Gladiator Arena," reframes football knowledge as a form of epic combat, providing a strong, unique, and extendable brand identity.

This guide is heavily inspired by the detailed concepts laid out in `gladiator-game.md`.

## 1. Core Concept: "Knowledge is Combat"

We are transforming NFL trivia into a high-stakes, competitive battle. Every user interaction should feel powerful, strategic, and epic.

- **Metaphor**: Players are gladiators. Player connections are battle moves. Games are arena combat.
- **Tone**: Epic, competitive, powerful, prestigious.
- **Keywords**: _Glory, Honor, Battle, Victory, Arena, Legend, Strength._

## 2. Color Palette

The palette is designed to evoke the materials and atmosphere of a Roman Colosseum: stone, bronze, gold, and the crimson of a spartan cape.

- **Primary Brand Colors**:

  - `#AE8625` (Gladiator Gold) - For highlights, victory screens, and primary CTAs.
  - `#800000` (Imperial Red) - For accents, "Surrender" buttons, and error states.
  - `#414A4C` (Forged Steel) - Dark, cool gray for text and primary backgrounds.
  - `#F7F5F2` (Marble White) - Off-white for card backgrounds and light mode text.

- **Secondary Accent Colors**:

  - `#CD7F32` (Bronze)
  - `#614e1a` (Olive)

- **Positional Colors (for player badges/tags)**:

  - **QB**: `#0072B2` (Sapphire Blue)
  - **RB**: `#009E73` (Emerald Green)
  - **WR**: `#D55E00` (Burnt Orange)
  - **TE**: `#CC79A7` (Royal Amethyst)

- **Gradients**: Gradients are key to our visual identity. Use them for backgrounds and buttons to create a sense of depth and drama.
  - **Background**: `linear-gradient(135deg, #232526 0%, #414345 100%)` (Dark Stone)
  - **Primary Button**: `linear-gradient(to right, #D4AF37, #AE8625)` (Gold)

## 3. Typography

The typography pairs a bold, thematic display font with a clean, readable body font.

- **Headings (`h1`, `h2`, `h3`)**: **Cinzel** or a similar bold, serif font with a Roman feel. All caps for major titles.
- **Body Text & UI Elements**: **Roboto** or **Inter**. Clean, modern, and highly legible.

**Example:**

> # VICTORY IN THE ARENA
>
> Your gladiator has proven their worth. The path to glory was paved with the following battle moves...

## 4. Iconography

We will use sharp, iconic symbols to reinforce the gladiator theme. `lucide-react` is a good library for this.

- **Combat**: `Swords`, `Shield`
- **Victory**: `Crown`, `Award`, `Trophy`
- **Stats**: `Heart` (Health), `Zap` (Combo), `Star` (Crowd Favor)
- **Navigation**: Sharp-angled chevrons (`ChevronRight`) instead of standard arrows.

## 5. Component Library & Styling

Our components should feel substantial and tactile.

- **Buttons**:

  - Sharp, 90-degree corners (no rounding).
  - Gradient backgrounds.
  - A subtle inner shadow to create depth.
  - Icon paired with text (e.g., `[Swords Icon] BATTLE`).

- **Cards**:

  - Background: A subtle marble or stone texture image (`Marble White` with low opacity).
  - Border: A thick, inset border in `Bronze` or `Gladiator Gold`.
  - Shadow: A long, dramatic drop-shadow.

- **Badges/Tags**:

  - Shaped like a banner or the bottom of a shield.
  - Use the positional colors (QB Blue, RB Green, etc.).

- **Modals**:

  - Grand and imposing. The overlay should be a dark, semi-transparent gradient.
  - The modal itself should have a thick `Gladiator Gold` border.

- **Input Fields**:
  - Appear as if they are carved into a stone surface.
  - Use an inset shadow and remove the outer border.
  - Placeholder text should be thematic (e.g., "Search for a warrior...").

## 6. Layout & Spacing

- **Layout**: Favor centered, symmetrical layouts to create a sense of grandeur and focus. Use wide, cinematic aspect ratios for game screens where possible.
- **Spacing**: Use a consistent spacing scale (e.g., multiples of 4px or 8px) but don't be afraid to use larger spacing to give elements room to breathe and feel important.

## 7. Animation & Motion

Animation should be used to make the UI feel alive and responsive to the user's "battle moves."

- **Battle Cries**: When a user makes a successful connection, a "Battle Cry" (`VICTORY OR DEATH!`) should appear and animate briefly.
- **Health Bar**: The health bar should smoothly animate down, and flash red when a "strike" occurs.
- **Combo Meter**: The combo count should "pop" and scale up with each increase.
- **Screen Transitions**: Use dramatic transitions, like a fade-to-black or a "shield wipe," between screens.

This style guide provides a comprehensive vision for a unique and memorable user experience. By consistently applying these principles, we can build a platform that is not only fun to play but also visually stunning.
