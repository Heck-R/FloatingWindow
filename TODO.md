# Features

## Must

## Maybe

- Add sidebar mode (acceptable if buggy)
  - the window acts as a proper sidebar, not above the page content, but taking space from it
  - hint: https://css-tricks.com/snippets/css/complete-guide-grid/
- Move window back to interact-able part of the window to avoid it being lost (maybe a navigation button amount, so it is possible to grab or maximize)
- Move content inside its own iframe
  Reasons (a.k.a. the shadow DOM is a disappointment):
  - Can't not insert default styling into the "working area" as adapted styles must come from the same document,
    but the window iframe is purposefully not loaded toa void annoying callback initialization
  - The shadow DOM lacks basic locator functions like `getElementsByClassName`, which can be worked around, but requires the content to conform,
    which goes against the goal of the window

# Fixes

## Must

- Fix positioning and min width in current combination pushing the window (top & left resizers)
- Context menu being cut off at the floating window's bottom
  Navigation bar menus should be separate iframes to fix this

## Maybe

- Firefox specific
  - Iframe load stopping hack seems to be handled questionably by the web console in Firefox (cannot detect anything inside the iframe until reopening the web console)  \
    While this is technically not an issue, it is questionable whether it happens because the iframe load stopping is wizardry, or because the web console is buggy
  - Jittering (see my [bugzilla ticket](https://bugzilla.mozilla.org/show_bug.cgi?id=1914785))
    The relevance here is that the wrong event coordinates make the floating window jitter / vibrate when overflow happens inside the iframe of the window

# Others

## Must

- Avoid infinite string-int conversion (data properties may just not be ideal)
- Re-think default content styles ()
- Clean up
  - Handle all types properly (~ linter warnings)
  - Remove obsolete stuff
  - Reorganize a bit

## Maybe

- Make change modifiers for moving the window to be numbers instead of magic calc string parts
- Check and consider using attributeChangedCallback instead of the MutationObserver
