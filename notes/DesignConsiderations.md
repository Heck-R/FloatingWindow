
The base mechanic of being a floating window was originally done mostly with `position: fixed`, `top` and `left`.

This concept starts to crumble as the container element has capture phase event handlers, but was originally ignored as the floating window is designed more to float "above" the whole page. Sadly some mad websites (e.g.: GitHub, Azure etc.) have capturing phase event handlers on the document itself, making it very tricky to play around.

Since the content of the floating window is supposed to work exactly as one would expect an empty page, the most surefire way to achieve that is through an iframe.  \
This also solves different pages' unexpectedly different styles, when the same mini app in a floating window would be used on top of different sites.

The base idea of a floating window would be a box that can be moved around the screen, and while the original concept's implementation followed that, when using iframes, a core function "automatic sizing" cannot be solved if the iframe is the movable box itself, since the iframe does not conform to the size of the content unless heavy wizardry is applied, which is not ideal for having unknown magical content.

Thus, the only way to go is for the iframe to be an invisible overlay, which itself does not block user actions, in which the floating window can have its own environment and events, completely separated from the main page.

Since there is no good way to stretch over a random element on the page without poking that element, the floating window is not going to be functionally restricted to the container element. The overlay in which the floating window can move will always be the viewport itself.

To make the element easily usable, and because being wrapped into an iframe is just a implementation detail, the iframe is further wrapped into a generic custom element instead of being a custom iframe element.
