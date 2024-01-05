
# FloatingWindow

FloatingWindow is well... a floating window! What a twist!

The original purpose was to have some common nice draggable in-page window for my [TamperMonkey](https://www.tampermonkey.net/) Userscripts. While this will always be the main goal, it is actually just a custom HTML element which can be used anywhere

# Looks And Feel

![Example look](/resources/example.png)

It generally acts as one would expect with a few special characteristics.

## Positioning Mode

There are 3 modes which define how the window acts when the content changes or when the browser is resized (can be set under the "%" button)

- **Relative**: Keeps its size regardless of the content, however it repositions and resizes itself so it always occupies the same relative area in the browser window.
- **Fixed**: Keeps its size and position regardless of the content or the browser window's size. This means that it can go out of the screen if the browser is zoomed or shrunk enough.
- **Auto**: Position-wise it's the same as "Fixed", and size-wise it's up to the browser to size it, which generally means that it adapts to the content. Moving it slightly out of screen on the right can for example cause the browser to try to adjust its width a bit, so again just remember that "Auto" in this case means that it's up to the browser.

## Quick Positioning

Other than minimizing and maximizing, the "+" option allows the alignment of the window to the edges or the middle.  \
This also applies the `Relative` mode.

The only magic here is that holding the `shift` key when clicking on the positioning will keep the window's size and positioning mode.

# Usage

To create a floating window

```javascript
let floatingWindow = document.createElement('floating-window')
```

To add content, just use the window's main content property, which is just a reference for a `div`, meaning that it can be populated just like anything else

E.g.:
```javascript
floatingWindow.content.innerHTML = `
<h1>Some title<h1>
<p>Some <b>very</b> <i>meaningful</i> content</p>
<hr>
<table>
	<tr><th>Just</th><th>a</th></tr>
	<tr><td>simple</td><td>table</td></tr>
</table>
<a href="https://google.com">link</a>
<button>Button</button>
`
```

To adjust the style just use the exposed `windowStyle` and `contentStyle` properties, which are references to .

For the content, some prebuilt styles are available in the `preBuiltStyles` property. E.g.:
```javascript
floatingWindow.contentStyle.textContent = FloatingWindow.preBuiltStyles.chromeDefault + FloatingWindow.preBuiltStyles.darkModeExtension;
```

## Basic Style

For a consistent styling unrelated to the page, even the most basic styling has to be reapplied, like how a table is formatted. For this, a browser's default style is used.  \
On top of that adding some special look and feel is available with names ending in `Extension`
		
To help imagine what a base style is for, a short example can be seen below, but it'd still be somewhat annoying, or act in relatively unexpected ways.

```css
/* Table */
table	 { display: table }
thead	 { display: table-header-group }
tbody	 { display: table-row-group }
tfoot	 { display: table-footer-group }
colgroup { display: table-column-group }
col		 { display: table-column }
caption  { display: table-caption }
tr		 { display: table-row }
td, th	 { display: table-cell }

table {
	border-collapse: collapse;
}

td, th {
	padding: 0.2em 0.4em 0.2em 0.4em;
	border: solid 1px;
}

/* Scroll bar */
::-webkit-scrollbar {
	width: 15px;
}

::-webkit-scrollbar-track {
	background: #222;
}

::-webkit-scrollbar-thumb {
	background: #444;
}

::-webkit-scrollbar-thumb:hover {
	background: #555;
}

::-webkit-scrollbar-thumb:active {
	background: #666;
}

/* Styling */
b, strong { font-weight: bolder }
i, cite, em, var, address { font-style: italic }
s, strike, del { text-decoration: line-through }
center { text-align: center }

/* Linking */
:link, :visited { text-decoration: underline }
:focus { outline: thin dotted invert }

/* Magic */
/* Begin bidirectionality settings (do not change) */
BDO[DIR="ltr"]  { direction: ltr; unicode-bidi: bidi-override }
BDO[DIR="rtl"]  { direction: rtl; unicode-bidi: bidi-override }

*[DIR="ltr"]    { direction: ltr; unicode-bidi: embed }
*[DIR="rtl"]    { direction: rtl; unicode-bidi: embed }

@media print {
h1            { page-break-before: always }
h1, h2, h3,
h4, h5, h6    { page-break-after: avoid }
ul, ol, dl    { page-break-before: avoid }
}
```

## Style Extension

Custom look and feel can be done in any way, but at least a background color is recommended
