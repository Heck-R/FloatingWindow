# Features

## Must

- Provide awaitable interface for the content being ready

## Maybe

- Add sidebar mode (acceptable if buggy)
  - the window acts as a proper sidebar, not above the page content, but taking space from it
- Move window back to interact-able part of the window to avoid it being lost (maybe a navigation button amount, so it is possible to grab or maximize)

# Fixes

## Must

- Fix grab position being on window when being restored from special style
- Fix iframe load and onload not working on chrome
- Fix positioning and min width in current combination pushing the window (top & left resizers)

## Maybe

- Auto mode
- Fix top bar sizing  (currently based on the iframe size, but should be the original page size, as that is the one representing the user working environment)

# Others

## Must

- Is "sizerSelectionBlockerOverlay" still needed with the iframe?
- Clean up
  - Handle all types properly (~ linter warnings)
  - Remove obsolete stuff
  - Reorganize a bit

## Maybe

- Make change modifiers for moving the window to be numbers instead of magic calc string parts
- Check and consider using attributeChangedCallback instead of the MutationObserver
