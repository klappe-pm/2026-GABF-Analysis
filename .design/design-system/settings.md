---
Seed color: "#2D6A4F"
Primary color: "#2D6A4F"
Color style: tonal spot
Surface tint: none
Page background: white
Contrast: standard
Heading font: Public Sans
Body font: Public Sans
Label font: Archivo Narrow
Corner shape: medium
Gold medal color: "#B8860B"
Silver medal color: "#8A9199"
Bronze medal color: "#BF7B4A"
Page width: full
Compact margin: 16
Wide margin: 24
Navigation on wide screens: drawer
---

# Design settings

These settings shape every page. The site reads them each time a page loads, so a change here shows on the next reload.

- Seed color: the one color the whole Material color scheme is generated from. Write it in quotes, for example "#2D6A4F". On its own, Material keeps the seed's hue but redraws the primary color at its own lightness, so the primary on the page can differ from the seed.
- Primary color: the exact color of main actions, links, focus, and selection, in quotes. The primary containers and the text on them are drawn from this color's own hue, so they stay its relatives.
- Color style: how Material builds the scheme from the seed: tonal spot, neutral, vibrant, expressive, fidelity, or content.
- Surface tint: none keeps backgrounds, cards, and bars white and neutral gray, with the seed's color only on accents (main actions, focus, selection, charts); seed tints every surface with the seed's hue.
- Page background: white puts every page on pure white (#FFFFFF); scheme uses Material's own near white surface. Cards, the app bar, and the navigation keep their light gray containers either way.
- Contrast: standard, medium, or high contrast between text and its background.
- Heading font: the face for display, headline, and title text. Public Sans is the only choice, because headings carry figures.
- Body font: the face for body text and every figure. Public Sans is the only choice.
- Label font: the face for short labels such as field labels and table headers: Archivo Narrow or Public Sans. Labels that hold figures always use Public Sans.
- Corner shape: how round corners are across the site: square, small, medium (Material's standard), or large.
- Gold medal color, Silver medal color, Bronze medal color: the metal fills of medal marks and medal bars, in quotes. Each needs 3 to 1 against the white page and must keep the medal's initial readable on it, so the brand build refuses a metal that is too light or too deep.
- Page width: how wide content may grow on large screens. full (or fill) uses the whole window; wide stops at 1600 pixels; standard stops at 1280 pixels; a width such as 90rem stops there. Long paragraphs always keep a readable line length, and tables and charts use the full width either way.
- Compact margin: the side margin on phones (windows under 600 pixels wide), in pixels. Material's standard is 16.
- Wide margin: the side margin on every wider window, in pixels. Material's standard is 24.
- Navigation on wide screens: on windows 1200 pixels and wider, drawer keeps a navigation drawer open beside the page; rail keeps the narrower navigation rail used on medium windows. Phones always use tabs.
- Chart series colors come from the Series colors list in the chart card's spec, which names five Material color roles; the site, the single file dashboard, the explorer, and the chart gallery all use those five.
- Every page, the README banners, and the social card take their colors from this file; the site build regenerates them, so a change here reaches every one of them.
- Type sizes: to change one Material type role, add a line such as Body large size: 17 (a whole number of pixels). The roles are display, headline, title, body, and label, each large, medium, or small.
