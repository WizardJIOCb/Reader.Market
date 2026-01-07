# Footer Center Alignment Design

## Objective

Restructure the footer layout to center-align all content with the copyright text "© 2026 reader.market" on the first line and all contact buttons displayed on a new line below.

## Current State

The footer currently uses a horizontal layout with:
- Copyright text positioned on the left side (or center on mobile)
- Contact buttons positioned on the right side (or center on mobile)
- Flex layout with `justify-between` on medium and larger screens

## Design Requirements

### Layout Structure

The footer content must be reorganized into a centered, vertical stack:

| Element | Position | Alignment |
|---------|----------|-----------|
| Copyright Text | First Line | Center |
| Contact Buttons | Second Line | Center |

### Visual Hierarchy

1. **First Line**: Display copyright text "© 2026 reader.market"
   - Center-aligned horizontally
   - Appropriate spacing below

2. **Second Line**: Display all contact buttons in a horizontal row
   - Center-aligned as a group
   - Buttons maintain their current interactive styling
   - Wrapping behavior preserved for smaller screens

### Layout Specifications

#### Container Behavior
- Overall footer container maintains full width
- All content within container is center-aligned
- Vertical stacking on all screen sizes

#### Spacing Strategy
- Adequate vertical gap between copyright line and contact buttons row
- Contact buttons maintain horizontal spacing between each other
- Footer maintains existing padding around the entire content area

#### Responsive Behavior
- Layout remains vertically stacked and center-aligned on all screen sizes
- Contact buttons wrap to multiple rows if needed on narrow screens
- All content stays centered regardless of viewport width

### Component Structure

The footer component structure should be modified as follows:

**Layout Flow**:
```
Footer Container
  └── Content Wrapper (centered, full width)
      ├── Copyright Section (center-aligned)
      │   └── Text: "© 2026 reader.market"
      └── Contact Buttons Section (center-aligned)
          └── Button Group (horizontal flex, centered, wrapping enabled)
              ├── Email Button
              ├── Phone Button
              ├── Telegram Button
              ├── WhatsApp Button
              ├── VK Button
              ├── Twitter Button
              ├── Kick Button
              └── GitHub Button
```

### Styling Adjustments

| Property | Current Behavior | New Behavior |
|----------|------------------|--------------|
| Main Container | Flex row with space-between on md+ | Flex column, center-aligned on all sizes |
| Copyright Section | Left-aligned on md+, center on mobile | Center-aligned on all sizes |
| Contact Buttons | Right-aligned on md+, center on mobile | Center-aligned on all sizes |

### Preserved Elements

The following aspects should remain unchanged:
- All contact button links and functionality
- Button styling (background, hover effects, rounded corners)
- Icon and text display behavior
- Responsive text hiding on small screens
- All external links with proper security attributes

## Technical Constraints

- Maintain existing Tailwind CSS utility classes where possible
- Preserve responsive breakpoints for button text visibility
- Keep all accessibility attributes and link behaviors
- No changes to color scheme or theme variables

## Visual Reference

**Current Layout (Desktop)**:
```
[© 2026 reader.market]                    [Email][Phone][Telegram][WhatsApp][VK][Twitter][Kick][GitHub]
```

**New Layout (All Screens)**:
```
                                © 2026 reader.market
                    [Email][Phone][Telegram][WhatsApp][VK][Twitter][Kick][GitHub]
```

## Success Criteria

- Copyright text is horizontally centered on all screen sizes
- Contact buttons are displayed on a separate line below the copyright
- All buttons are centered as a group
- Vertical spacing between copyright and buttons is visually balanced
- Responsive wrapping of buttons functions correctly
- No visual regressions in button styling or interactions- Responsive wrapping of buttons functions correctly
- No visual regressions in button styling or interactions