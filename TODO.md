# Features

## Must

## Maybe

- Add sidebar mode (acceptable if buggy)
  - the window acts as a proper sidebar, not above the page content, but taking space from it
- Move window back to interact-able part of the window to avoid it being lost (maybe a navigation button amount, so it is possible to grab or maximize)

# Fixes

## Must

- Fix positioning and min width in current combination pushing the window (top & left resizers)
- Auto mode

## Maybe

- Iframe load stopping hack seems to be handled questionably by the web console in Firefox (cannot detect anything inside the iframe until reopening the web console)
  While this is technically not an issue, it is questionable whether it happens because the iframe load stopping is wizardry, or because the web console is buggy
- Fix top bar sizing  (currently based on the iframe size, but should be the original page size, as that is the one representing the user working environment)

# Others

## Must

- Avoid infinite string-int conversion (data properties may just not be ideal)
- Clean up
  - Handle all types properly (~ linter warnings)
  - Remove obsolete stuff
  - Reorganize a bit

## Maybe

- Make change modifiers for moving the window to be numbers instead of magic calc string parts
- Check and consider using attributeChangedCallback instead of the MutationObserver
