# Design System Specification: The Ethereal Professional

## 1. Overview & Creative North Star
**Creative North Star: The Lucid Interface**
This design system rejects the "SaaS-in-a-box" aesthetic. Instead of rigid containers and heavy strokes, we embrace an environment that feels like a precision instrument floating in a vast, digital nebula. It is "Lucid" because it is crystal clear and high-performance, yet "Ethereal" because it utilizes light, blur, and depth to create a sense of "magical" translation.

### Breaking the Template
We move beyond the standard grid through **Intentional Asymmetry**. Important data or translation outputs should not be boxed in; they should breathe. We use overlapping glass panels and "Light Leaks" (subtle primary-to-secondary gradients) to guide the eye, creating a premium editorial feel that suggests the software is thinking and evolving in real-time.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the depth of `surface` (#0e131f), moving away from flat blacks into a more sophisticated charcoal-ink.

### The "No-Line" Rule
**Lines are a failure of hierarchy.** In this system, 1px solid borders for sectioning are prohibited. Boundaries must be defined through:
1. **Tonal Shifts:** Placing a `surface-container-high` card on a `surface-container-low` background.
2. **Negative Space:** Using the Spacing Scale to let content stand on its own.
3. **Glass Edges:** Using a `0.5px` border with 15% opacity `outline-variant` only to catch "specular highlights" on glass components.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted material.
*   **Base:** `surface` (#0e131f) – The infinite foundation.
*   **Sectioning:** `surface-container-low` (#161c28) – For large background areas.
*   **Floating UI:** `surface-container-highest` (#2f3542) – For active, interactive panels.

### The "Glass & Gradient" Rule
To evoke the "magical" quality of real-time translation, use **Glassmorphism** for all floating elements (Modals, Popovers, Tooltips). 
*   **Recipe:** `surface-container` color at 60% opacity + `backdrop-filter: blur(20px)`.
*   **Signature Textures:** Apply a linear gradient from `primary` (#adc6ff) to `secondary` (#d0bcff) at 15% opacity as a subtle background "wash" for hero sections to provide soul and depth.

---

## 3. Typography
We utilize a dual-typeface system to balance authority with modern approachable elegance.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-forward" personality. Use `display-lg` for hero statements to create a bold, editorial impact.
*   **Body & Labels (Inter):** The workhorse of the system. Chosen for maximum legibility during rapid-fire translation tasks. 
*   **Hierarchy as Brand:** Use extreme scale contrast. A `display-md` headline paired with a `body-sm` label creates a sophisticated, high-end "magazine" feel that communicates professionalism and precision.

---

## 4. Elevation & Depth
We convey importance through **Tonal Layering** and light physics, not heavy drop shadows.

*   **The Layering Principle:** To lift a card, do not reach for a shadow first. Instead, move it one step up the surface-container scale (e.g., a `surface-container-low` card on a `surface-dim` background).
*   **Ambient Shadows:** For high-elevation components (Modals), use a "Nebula Shadow": `box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5)`. The shadow should feel like it's absorbing light, not just darkening the floor.
*   **The Ghost Border:** If a container requires a boundary (e.g., in a complex data grid), use `outline-variant` at **10% opacity**. It should be felt, not seen.
*   **Inner Glow:** To enhance the "magical" feel, give primary buttons a 1px inner-shadow (inset) using a lighter tint of the primary color to simulate a glowing edge.

---

## 5. Components

### Buttons
*   **Primary:** A gradient-filled container (`primary` to `primary-container`). Roundedness: `md` (0.75rem). No border. High-contrast `on-primary` text.
*   **Secondary (Glass):** `surface-container-high` at 40% opacity with a `backdrop-blur`. This allows the background "magic" to peek through.
*   **Tertiary:** Ghost style. No container. `primary` text color. Use for low-emphasis actions.

### Input Fields (The "Translation Cell")
*   **Style:** Forbid the "4-sided box." Use a `surface-container-highest` background with a slightly more pronounced bottom-edge highlight.
*   **Active State:** The bottom edge glows with a `primary` to `secondary` gradient line (2px).
*   **Focus:** Apply a subtle `primary` outer glow (4px blur, 10% opacity) to suggest the field is "powered on."

### Cards & Lists
*   **Constraint:** Zero dividers. 
*   **Separation:** Use `surface-container-low` for the list track and `surface-container-high` for the individual list items. Increase vertical padding (`1.5rem`) to create a "breathable" information flow.

### Translation "Pills" (Chips)
*   **Selection:** Use `secondary-container` with `on-secondary-container` text.
*   **Motion:** When a language is active, the chip should have a subtle "pulse" animation using a low-opacity `secondary` glow.

### New Component: The "Flux" Status Indicator
*   A custom component for "Live Translator." A small, glowing orb that transitions between `primary` (listening) and `secondary` (translating) using a blurred, organic gradient shape.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use extreme whitespace. If you think there is enough room, add 8px more.
*   **Do** use `manrope` for numbers and data visualizations to maintain the "premium" look.
*   **Do** ensure all "glass" layers have a `backdrop-filter`. Glass without blur is just a low-opacity box; it looks cheap.

### Don’t
*   **Don't** use pure white (#FFFFFF) for text. Always use `on-surface` (#dde2f3) to reduce eye strain in dark mode.
*   **Don't** use 100% opaque borders. They break the illusion of depth.
*   **Don't** use "Default" blue. Always reference the `primary` (#adc6ff) or `primary-container` (#4d8eff) tokens to ensure the vibrant-yet-professional balance is maintained.
*   **Don't** stack more than three layers of "Glass." It muddies the interface and kills performance.