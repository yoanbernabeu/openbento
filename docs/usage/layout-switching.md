# Layout Switching

OpenBento now supports two page layouts in the builder:

- `Bento`
- `Vertical Links Layout`

The layout switcher lives in the top toolbar next to the desktop and mobile preview controls.

## What The Switcher Does

Changing layout updates the current page structure and re-renders the builder, preview page, and exported app with the selected layout.

The current implementation stores the active layout on the page profile with `pageLayout`, so the selected layout persists with the bento data.

## Supported Layouts

### Bento

The original grid-based editor and preview.

### Vertical Links Layout

A stacked, link-in-bio style layout optimized for a vertical list of blocks.

This layout includes:

- the same profile header editing features as Bento for avatar, title, subtitle, and avatar styling
- vertical drag and drop reordering
- long-press drag on cards
- a hover-only drag handle
- collection blocks for grouping several items under a foldable title

## Layout Change Reset Behavior

Changing layout is intentionally destructive for layout-specific positioning.

When the user opens the layout modal, a warning explains that switching layouts resets the current arrangement to keep the page compatible with the selected layout.

When the layout is actually changed, the builder also shows an information message confirming that the arrangement was reset.

## Vertical-Only Blocks

`Collection` is a vertical-only block type.

When switching from `Vertical Links Layout` back to a Bento layout:

- collection containers are removed
- blocks inside collections are preserved
- preserved child blocks are moved back to the root block list

This cleanup happens as part of the layout change flow so incompatible vertical-only structures do not survive in Bento mode.

## Vertical Collections

Collections are available only while the active layout is `Vertical Links Layout`.

Each collection supports:

- a title
- an `expanded by default` setting
- animated expand and collapse in builder and preview
- dropping blocks into the collection
- dragging child blocks back out to the root list

The collection header was intentionally simplified to show only the title and collapse affordance.

## Drag And Drop Model In Vertical Layout

Top-level vertical cards use reorder behavior that updates the saved block order directly.

Additional rules:

- dragging from the grip moves blocks reliably without triggering accidental edits
- long-press on a card also starts drag
- blocks can be dropped into collections
- child blocks can be dragged back out of a collection to the root level

The save flow for vertical layout bypasses Bento grid normalization so reordered cards are not reset by autosave.

## Builder, Preview, And Export Coverage

The layout system is wired consistently across:

- the main builder editor
- the preview page
- the static export templates

That means the selected layout and its collection behavior are reflected in both local editing and generated output.
