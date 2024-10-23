// This optional declaration is done to avoid getting a redeclaration error if the script is reference multiple times (e.g.: multiple user scripts)
var FloatingWindow =
	// @ts-expect-error: The entire point of this is that this may or may not exist at this point
	FloatingWindow ||
	/**
	 * A floating window html element with the following capabilities:
	 * - Can be dragged around by grabbing it by the title bar
	 * - Can be resized by dragging the sides
	 * - Can be minimized / Maximized
	 * - Size modes can be applied
	 *   - Auto: Resized based on content, and keeps position
	 *   - Fixed: Preserves size and position
	 *   - Relative: Resizes and repositions in a way to always occupy the same relative location even if the browser window is resized
	 * - Quick positioning
	 *   - The window can be aligned to the sides or corners
	 *     - The window is auto-sized when pressing shift at the time of the alignment
	 *       - The window size is restored when the window is grabbed
	 * - Customization
	 *   - Custom content
	 *     - The window is meant to be filled with custom content via the {@link #content}
	 *     - The window is aimed at mini applications, so it is safe from the outer page's logic, including events and their prevention
	 *   - Custom style
	 *     - Ignores page css for a consistent look
	 *     - Custom styles can be applied via the {@link contentStyle}
	 *     - The whole window can also be styled using the {@link windowStyle}
	 *       - This style makes the window navigation look as it does, so completely overwriting it is not recommended
	 */
	class FloatingWindow extends HTMLElement {
		/** Intended tag name */
		static tagName = "floating-window";
		static contentAutoSizeClassName = "autoSize";

		/**
		 * The gatekeeper of functionality
		 *
		 * The floating window is meant to work on any page consistently, and the only way to avoid
		 * crazy styling, event handlers and event prevention (e.g.: at document level like GitHub and Azure does)
		 *
		 * @type {HTMLIFrameElement}
		 */
		#iframe;

		/**
		 * The host of the content shadow DOM
		 *
		 * @type {HTMLDivElement}
		 */
		#contentShadowHost;

		/**
		 * The window's entry point for adding custom content
		 *
		 * By default the only content in this element is the content style
		 *
		 * Functionally only available after the window is added to the page
		 *
		 * @type {ShadowRoot}
		 */
		content;

		/**
		 * Style element for styling the custom content section
		 *
		 * It is comparable to a browser's default style, although this will apply on top of that
		 *
		 * This can be completely overwritten without unexpected consequences
		 *
		 * Prebuilt styles can be found in {@link preBuiltStyles}
		 *
		 * It is mostly intended for generic styling, but custom content can also be styled here
		 *
		 * @type {HTMLStyleElement}
		 */
		contentStyle;

		/**
		 * This style is responsible for the window's navigation elements, so completely overwriting it is discouraged,
		 * as this is technically implementation detail, and it can easily break the window
		 *
		 * @type {HTMLStyleElement}
		 */
		windowStyle;

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Overrides

		connectedCallback() {
			// Base css
			this.style.all = "unset"; // The page's css must not affect this element
			this.style.position = "fixed";
			this.style.top = "0";
			this.style.left = "0";
			this.style.width = "50%";
			this.style.height = "50%";

			// Default values
			this.sizerThickness = "5px";
			this.windowBorderRadius = "5px";

			// Create dataset variable observers (initiated in connectedCallback())
			let observer = new MutationObserver(mutations => {
				mutations.forEach(mutation => {
					if (mutation.type == "attributes" && mutation.attributeName) {
						// prettier-ignore
						let datasetVariableName = mutation.attributeName
						.replace(/^data-/, "")
						.replace(/([-][a-z])/g, group => group.toUpperCase().replace("-", ""));
						this[`onFloatingDataChange_${datasetVariableName}`]();
					}
				});
			});

			observer.observe(this, {
				attributes: true,
				attributeFilter: ["data-size-type"],
			});

			// The following observer is needed to be added when the auto size mode is active,
			// and the instance has to be kept so it can be removed when auto size mode is off
			this.autoSizeObserver = new ResizeObserver(resizedElements => {
				this.setSizeToAutoFitContent();
			});

			this.initUI();
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// initialization

		initUI() {
			this.#iframe = document.createElement("iframe");
			this.#iframe.style.all = "unset"; // The page's css must not affect this element
			this.#iframe.style.position = "absolute";
			this.#iframe.style.width = "100%";
			this.#iframe.style.height = "100%";
			this.appendChild(this.#iframe);

			if (!this.#iframe.contentWindow || !this.#iframe.contentDocument || !this.#iframe.contentDocument.body) {
				throw new Error("The iframe's content is not available, this likely means that the browser is not initializing anything before trying to load the source, which we don't have here, but the browser defaults to a blank page");
			}

			// This is just pure black magic
			// The loading of the iframe is stopped, because the iframe always has a page to load (if nothing provided then a blank one), which may happen after adding content synchronously here
			// Here, there is no need to load anything, as all the content is generated here (the iframe exists only to shield the user content from the outside event prevention)
			// At the time of writing, an iframe does initialize a blank page instantly in major browsers (although it's not documented, so relying on it is questionable)
			// => Preventing the loading to avoid the content being overwritten after filled with content and then fill it with content
			// This listener must be above the addition to the document
			// If an issue comes up later, with the iframe's state, then options include:
			// - If the document exists at least, then create the html, head and body
			// - If the document does not exist, then wait for the iframe load event, and fill the content then, and then trigger a load event on this element.
			//   As it is annoying to wait for events due to implementation details (using an iframe), making an async property could be considered
			this.#iframe.contentWindow.stop();

			this.#iframe.contentDocument.body.style.position = "absolute";
			this.#iframe.contentDocument.body.style.width = "100%";
			this.#iframe.contentDocument.body.style.height = "100%";
			this.#iframe.contentDocument.body.style.zIndex = "0";
			this.#iframe.contentDocument.body.style.margin = "0";

			// Window sizer panel
			let windowSizerContainer = document.createElement("div");
			windowSizerContainer.id = "windowSizerContainer";

			// Sizer - Top
			let sizerTop = document.createElement("div");
			sizerTop.classList.add("sizer", "sizerTop");
			sizerTop.addEventListener("mousedown", this.grabWindow.bind(this, { top: 1, height: -1 }));

			// Sizer - Bottom
			let sizerBottom = document.createElement("div");
			sizerBottom.classList.add("sizer", "sizerBottom");
			sizerBottom.addEventListener("mousedown", this.grabWindow.bind(this, { height: 1 }));

			// Sizer - Left
			let sizerLeft = document.createElement("div");
			sizerLeft.classList.add("sizer", "sizerLeft");
			sizerLeft.addEventListener("mousedown", this.grabWindow.bind(this, { left: 1, width: -1 }));

			// Sizer - Right
			let sizerRight = document.createElement("div");
			sizerRight.classList.add("sizer", "sizerRight");
			sizerRight.addEventListener("mousedown", this.grabWindow.bind(this, { width: 1 }));

			// Sizer - TopLeft
			let sizerTopLeft = document.createElement("div");
			sizerTopLeft.classList.add("sizer", "sizerCorner", "sizerTop", "sizerLeft");
			sizerTopLeft.addEventListener("mousedown", this.grabWindow.bind(this, { top: 1, left: 1, width: -1, height: -1 }));

			// Sizer - TopRight
			let sizerTopRight = document.createElement("div");
			sizerTopRight.classList.add("sizer", "sizerCorner", "sizerTop", "sizerRight");
			sizerTopRight.addEventListener("mousedown", this.grabWindow.bind(this, { top: 1, width: 1, height: -1 }));

			// Sizer - BottomLeft
			let sizerBottomLeft = document.createElement("div");
			sizerBottomLeft.classList.add("sizer", "sizerCorner", "sizerBottom", "sizerLeft");
			sizerBottomLeft.addEventListener("mousedown", this.grabWindow.bind(this, { left: 1, width: -1, height: 1 }));

			// Sizer - BottomRight
			let sizerBottomRight = document.createElement("div");
			sizerBottomRight.classList.add("sizer", "sizerCorner", "sizerBottom", "sizerRight");
			sizerBottomRight.addEventListener("mousedown", this.grabWindow.bind(this, { width: 1, height: 1 }));

			// Floating window element
			let floatingWindow = document.createElement("div");
			floatingWindow.id = "floatingWindow";

			// Styles
			// The style of the content itself. Since the window style removed all outside styling, this serves like a browser's default style
			this.contentStyle = document.createElement("style");
			this.contentStyle.id = "contentStyle";
			this.contentStyle.setAttribute("scoped", "");

			// The style of the window itself, including the navigation bar and resizers at the edges
			this.windowStyle = document.createElement("style");
			this.windowStyle.id = "windowStyle";
			this.windowStyle.setAttribute("scoped", "");

			// Navbar
			let navigationBar = document.createElement("div");
			navigationBar.id = "navigationBar";
			navigationBar.addEventListener("mousedown", event => {
				// Allow window restoration when the navigation bar is dragged
				this.dataset.allowRestoration = "true";
				this.grabWindow({ top: 1, left: 1 }, event);
			});
			navigationBar.addEventListener("dblclick", () => {
				if (this.dataset.restorablePosition) {
					// Restore if in special style
					this.dataset.allowRestoration = "true";
					this.restorePosition();
				} else {
					this.applyMaximizedStyle();
				}
			});
			// Remove restoration approval in case it was a simple click and no movement
			navigationBar.addEventListener("mouseup", () => {
				delete this.dataset.allowRestoration;
			});

			// Situational event listeners later being added and removed to lessen unnecessary load on the event loop
			// Removing event listeners can only be done using the same function reference, but passing the function directly makes it lose "this"
			// To fix this, a version of the function is kept with "this" specifically bound to the instance of this context
			this.boundMoveWindow = this.moveWindow.bind(this);
			this.boundReleaseWindow = this.releaseWindow.bind(this);

			// Size panel
			this.positionPanel = document.createElement("div");
			this.positionPanel.id = "positionPanel";

			let propagationStopper = event => {
				event.stopPropagation();
			};

			/**
			 * Creates a generic button (div) for window positioning
			 * Hides all elements marked as "switchable" in the window
			 *
			 * @param {string} positionButtonId Id of the element
			 * @param {string} text Text shown, preferably an icon-like character
			 * @param {EventListener | undefined} listenerFunction Listener for clicking
			 * @param {boolean} stopPropagation Stops the event's propagation if true
			 * @returns {Element} The position button element
			 */
			let createPositionButton = (positionButtonId = "", text = "", listenerFunction = undefined, stopPropagation = true) => {
				let positionButton = document.createElement("div");
				positionButton.id = positionButtonId;
				positionButton.classList.add("positionButton");
				positionButton.innerText = text;

				if (listenerFunction !== undefined) {
					positionButton.addEventListener("click", listenerFunction);
				}

				if (stopPropagation) {
					positionButton.addEventListener("mousedown", propagationStopper);
					positionButton.addEventListener("click", event => {
						this.setSwitchablesOff(event.target.parentElement);
					});
				}

				return positionButton;
			};

			let createPositionSlot = (positionId = "", text = "", listenerFunction = undefined, stopPropagation = true) => {
				let positionSlot = document.createElement("div");
				positionSlot.id = `${positionId}Slot`;
				positionSlot.classList.add("positionSlot");

				let positionButton = createPositionButton(`${positionId}Button`, text, listenerFunction, stopPropagation);
				positionSlot.appendChild(positionButton);

				return positionSlot;
			};

			// SizeType buttons
			let sizeTypeButtonPanel = document.createElement("div");
			sizeTypeButtonPanel.id = "sizeTypeButtonPanel";
			sizeTypeButtonPanel.classList.add("switchable");
			sizeTypeButtonPanel.classList.add("hidden");

			let sizeTypes = ["Relative", "Fixed", "Auto"];
			for (let sizeType of sizeTypes) {
				let sizeTypeButton = createPositionButton("sizeType" + sizeType, sizeType, () => {
					this.dataset.sizeType = sizeType;

					// This is considered an action which "exits" a special mode, so no restoration should happen after this
					delete this.dataset.allowRestoration;
					delete this.dataset.restorablePosition;
				});
				sizeTypeButton.classList.add("sizeTypeButton");

				sizeTypeButtonPanel.appendChild(sizeTypeButton);
			}

			// Fixed position buttons
			let fixedButtonGrid = document.createElement("div");
			fixedButtonGrid.id = "fixedButtonGrid";
			fixedButtonGrid.classList.add("switchable");
			fixedButtonGrid.classList.add("hidden");

			let fixedButtonTexts = [
				["┌", "┬", "┐"],
				["├", "┼", "┤"],
				["└", "┴", "┘"],
			];

			for (let rowNum = 0; rowNum < 3; rowNum++) {
				for (let colNum = 0; colNum < 3; colNum++) {
					/**
					 * Event handler for the specific fixed style buttons
					 *
					 * @param {MouseEvent} event
					 */
					const applySpecificFixedStyle = event => {
						if (event.shiftKey) {
							this.applyFixedStyle({ x: `calc(${colNum * 50}%)`, y: `calc(${rowNum * 50}%)` }, { x: `calc(${colNum % 2 == 0 ? 50 : 100}%)`, y: `calc(${rowNum % 2 == 0 ? 50 : 100}%)` }, { x: colNum * 50, y: rowNum * 50 });
						} else {
							this.applyFixedStyle({ x: `calc(${colNum * 50}%)`, y: `calc(${rowNum * 50}%)` }, undefined, { x: colNum * 50, y: rowNum * 50 });
						}
					};
					let fixedButton = createPositionButton("fixed" + rowNum + colNum, fixedButtonTexts[rowNum][colNum], applySpecificFixedStyle);
					fixedButton.classList.add("fixedButton");

					fixedButtonGrid.appendChild(fixedButton);
				}
			}

			// Movable slot
			let movableSlot = createPositionSlot("movable", "", undefined, false);

			// SizeType slot
			let sizeTypeSlot = createPositionSlot("sizeType", "%", FloatingWindow.switchElementVisibility.bind(this, sizeTypeButtonPanel));

			// Minimize slot
			let minimizeSlot = createPositionSlot("minimize", "_", this.applyMinimizedStyle.bind(this));

			// Fixed slot
			let fixedSlot = createPositionSlot("fixed", "+", FloatingWindow.switchElementVisibility.bind(this, fixedButtonGrid));

			// Maximize slot
			let maximizeSlot = createPositionSlot("maximize", "⛶", this.applyMaximizedStyle.bind(this));

			// Close slot
			let closeSlot = createPositionSlot("close", "X", this.closeWindow.bind(this));

			// Content
			// this.#contentShadowHost = document.createElement("div");
			this.#contentShadowHost = document.createElement("div");
			this.#contentShadowHost.id = "content";

			// Content shadow for separating window from content
			this.content = this.#contentShadowHost.attachShadow({ mode: "open" });

			// Assemble
			this.#iframe.contentDocument.head.appendChild(this.windowStyle);
			this.#iframe.contentDocument.body.appendChild(floatingWindow);
			/**/ floatingWindow.appendChild(navigationBar);
			/**/ /**/ navigationBar.appendChild(this.positionPanel);
			/**/ /**/ /**/ this.positionPanel.appendChild(movableSlot);
			/**/ /**/ /**/ this.positionPanel.appendChild(sizeTypeSlot);
			/**/ /**/ /**/ /**/ sizeTypeSlot.appendChild(sizeTypeButtonPanel);
			/**/ /**/ /**/ this.positionPanel.appendChild(minimizeSlot);
			/**/ /**/ /**/ this.positionPanel.appendChild(fixedSlot);
			/**/ /**/ /**/ /**/ fixedSlot.appendChild(fixedButtonGrid);
			/**/ /**/ /**/ this.positionPanel.appendChild(maximizeSlot);
			/**/ /**/ /**/ this.positionPanel.appendChild(closeSlot);
			/**/ floatingWindow.appendChild(this.#contentShadowHost);
			/**/ /**/ this.content.appendChild(this.contentStyle);
			this.#iframe.contentDocument.body.appendChild(windowSizerContainer);
			/**/ windowSizerContainer.appendChild(sizerTop);
			/**/ windowSizerContainer.appendChild(sizerBottom);
			/**/ windowSizerContainer.appendChild(sizerLeft);
			/**/ windowSizerContainer.appendChild(sizerRight);
			/**/ windowSizerContainer.appendChild(sizerTopLeft);
			/**/ windowSizerContainer.appendChild(sizerTopRight);
			/**/ windowSizerContainer.appendChild(sizerBottomLeft);
			/**/ windowSizerContainer.appendChild(sizerBottomRight);

			// Window listeners
			this.#iframe.contentDocument.addEventListener("mousedown", this.setSwitchablesOff.bind(this));

			// Window resize handling
			window.addEventListener("resize", () => {
				this.applyOriginPageSizeRelatedStyles();
				this.fixLessThanMinSize();
			});

			// Observed variables
			if (this.dataset.sizeType == undefined) {
				this.dataset.sizeType = "Fixed";
				// this.dataset.sizeType = "Auto";
			}

			// Minimal style
			this.style.cssText = `
			position: fixed;
			z-index: ${Number.MAX_SAFE_INTEGER};
		`;

			this.updateFloatingWindowStyle();
			this.applyOriginPageSizeRelatedStyles();
			this.applyBasicFloatingStyle();
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Calculated values

		static calculateNavigationBarHeight() {
			return `${10 + 0.015 * window.innerHeight}px`;
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Static methods

		/**
		 * Convert a calc Object to a css calc() string
		 *
		 * @param {Object} calcObj An Object representing a css calc(). E.g.: {px: 1, %: -2}
		 * @returns {string} Css calc() string e.g.: calc(1px - 2%)
		 */
		static calcObjToString(calcObj) {
			let calcString = "";

			for (let unit in calcObj) {
				calcString += `+ ${calcObj[unit]}${unit} `;
			}

			calcString = calcString.replaceAll("+ -", "- ").replace(/^\+/, "").trim();

			return `calc(${calcString})`;
		}

		/**
		 * Sums up same units of a css calc() string
		 *
		 * @param {string} originalCalc, which can include vw, vh, px and % units e.g.: calc(1px - 2%)
		 * @returns {Object} Calc Object with sum of the units, always containing all units e.g: {px: 1, %: -2}
		 */
		static simplifyStyleCalcSize(originalCalc) {
			let calcNoSpace = originalCalc.replaceAll(" ", "");
			let vwInstances = calcNoSpace.matchAll(/(-?[\d\.]+)vw/g);
			let vhInstances = calcNoSpace.matchAll(/(-?[\d\.]+)vh/g);
			let percentInstances = calcNoSpace.matchAll(/(-?[\d\.]+)%/g);
			let pxInstances = calcNoSpace.matchAll(/(-?[\d\.]+)px/g);

			let vwSum = 0;
			for (let vwInstance of vwInstances) {
				vwSum += Number(vwInstance[1]);
			}

			let vhSum = 0;
			for (let vhInstance of vhInstances) {
				vhSum += Number(vhInstance[1]);
			}

			let percentSum = 0;
			for (let percentInstance of percentInstances) {
				percentSum += Number(percentInstance[1]);
			}

			let pxSum = 0;
			for (let pxInstance of pxInstances) {
				pxSum += Number(pxInstance[1]);
			}

			return {
				vw: vwSum,
				vh: vhSum,
				"%": percentSum,
				px: pxSum,
			};
		}

		/**
		 * Converts a css calc() string to pixel
		 *
		 * @param {string} originalCalc e.g.: calc(10px - 2%)
		 * @param {"w"|"h"} dimension Which dimension should the `originalCalc` be converted into (width or height)
		 * @returns {number} Size defined by the calc() string converted into pixels e.g: 6px
		 */
		static convertStyleCalcSizeToPx(originalCalc, dimension) {
			let objectCalc = FloatingWindow.simplifyStyleCalcSize(originalCalc);

			const referenceDimensionSize = dimension == "w" ? document.documentElement.clientWidth : document.documentElement.clientHeight;

			const percentPx = (referenceDimensionSize * objectCalc["%"]) / 100;
			const vwPx = (document.documentElement.clientWidth * objectCalc["vw"]) / 100;
			const vhPx = (document.documentElement.clientHeight * objectCalc["vh"]) / 100;
			const px = objectCalc["px"];
			return percentPx + vwPx + vhPx + px;
		}

		/**
		 * Converts a css calc() string to percent
		 * Whether a width or height is the target is ambiguous by default, so this can be controlled using the percentage parameters
		 *
		 * @param {string} originalCalc
		 * @param {"w"|"h"} dimension Which dimension should the `originalCalc` be converted into (width or height)
		 * @returns {number} Percent defined by the calc() string
		 */
		static convertStyleCalcSizeToPercent(originalCalc, dimension) {
			let objectCalc = FloatingWindow.simplifyStyleCalcSize(originalCalc);

			const referenceDimensionSize = dimension == "w" ? document.documentElement.clientWidth : document.documentElement.clientHeight;

			const pxPercent = (objectCalc["px"] * 100) / referenceDimensionSize;
			const vwPercent = objectCalc["vw"];
			const vhPercent = objectCalc["vh"];
			const percent = objectCalc["%"];
			return pxPercent + vwPercent + vhPercent + percent;
		}

		/**
		 * Compares the represented sizes of two css calc() strings
		 *
		 * @param {"min"|"max"} minMax Defines whether or not to check for the first parameter being greater or less then the second
		 * @param {string} calcSize1
		 * @param {string} calcSize2
		 * @param {"w"|"h"} dimension Which dimension should the `originalCalc` be converted into (width or height)
		 * @returns {Boolean} Whether or not the first calc() is strictly greater / less (based on the `minMax` param) than the second calc()
		 */
		static calcMinMax(minMax, calcSize1, calcSize2, dimension) {
			if (!["min", "max"].includes(minMax)) {
				throw new Error("The minMax parameter's value must be 'min' or 'max'");
			}

			let pxSize1 = FloatingWindow.convertStyleCalcSizeToPx(calcSize1, dimension);
			let pxSize2 = FloatingWindow.convertStyleCalcSizeToPx(calcSize2, dimension);

			if (pxSize1 == pxSize2) {
				return false;
			}

			let pxSize1IsMax = pxSize1 > pxSize2;
			let pxSize1IsMinMax = minMax == "min" ? !pxSize1IsMax : pxSize1IsMax;

			return pxSize1IsMinMax;
		}

		/**
		 * Sets or toggles the visibility of the target element using the "hidden" class, handled by the window's css
		 *
		 * @param {Element} element
		 * @param {"on"|"off"|undefined} state Defines whether the "hidden" state should be on or off. Not defining will toggle.
		 */
		static switchElementVisibility(element, state) {
			if (state === "on") {
				element.classList.remove("hidden");
			} else if (state === "off") {
				element.classList.add("hidden");
			} else {
				element.classList.toggle("hidden");
			}
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Position & size management

		/**
		 * Handles basic window positioning values based on `this.dataset.sizeType`
		 */
		onFloatingDataChange_sizeType() {
			if (!this.autoSizeObserver) {
				throw new Error("Something was assumed to be initialized, but wasn't!");
			}

			if (this.dataset.sizeType != "Auto" && (!this.style.width || !this.style.height)) {
				// For non-Auto modes, the window must have width and height defined
				this.fixateImplicitSize();
			}

			if (this.dataset.sizeType === "Auto") {
				this.#contentShadowHost.classList.add(FloatingWindow.contentAutoSizeClassName);
				this.autoSizeObserver.observe(this.#contentShadowHost);
			} else {
				this.#contentShadowHost.classList.remove(FloatingWindow.contentAutoSizeClassName);
				this.autoSizeObserver.unobserve(this.#contentShadowHost);
			}

			switch (this.dataset.sizeType) {
				case "Relative":
					this.style.top = FloatingWindow.convertStyleCalcSizeToPercent(this.style.top, "h") + "%";
					this.style.left = FloatingWindow.convertStyleCalcSizeToPercent(this.style.left, "w") + "%";
					this.style.width = FloatingWindow.convertStyleCalcSizeToPercent(this.style.width, "w") + "%";
					this.style.height = FloatingWindow.convertStyleCalcSizeToPercent(this.style.height, "h") + "%";
					break;
				case "Fixed":
					this.style.top = FloatingWindow.convertStyleCalcSizeToPx(this.style.top, "h") + "px";
					this.style.left = FloatingWindow.convertStyleCalcSizeToPx(this.style.left, "w") + "px";
					this.style.width = FloatingWindow.convertStyleCalcSizeToPx(this.style.width, "w") + "px";
					this.style.height = FloatingWindow.convertStyleCalcSizeToPx(this.style.height, "h") + "px";
					break;
				case "Auto":
					this.style.top = FloatingWindow.convertStyleCalcSizeToPx(this.style.top, "h") + "px";
					this.style.left = FloatingWindow.convertStyleCalcSizeToPx(this.style.left, "w") + "px";
					this.setSizeToAutoFitContent();
					break;
				default:
					throw new Error(`Cannot set size type to ${this.dataset.sizeType}`);
			}
		}

		/**
		 * Set the floating window's size to fit the content at the time of the call
		 * This is necessary due to the window being wrapped into an iframe that cannot fit to its content by itself
		 */
		setSizeToAutoFitContent() {
			// Since all of the window navigation are inside the set size,
			// the additional stuff must be included in the calculation
			const contentComputedStyle = getComputedStyle(this.#contentShadowHost);
			this.style.width = `calc(\
			${this.#contentShadowHost.scrollWidth}px + \
			2 * ${this.sizerThickness} + \
			${contentComputedStyle.marginLeft} + \
			${contentComputedStyle.marginRight} + \
			${contentComputedStyle.borderLeftWidth} + \
			${contentComputedStyle.borderRightWidth} + \
			${contentComputedStyle.paddingLeft} + \
			${contentComputedStyle.paddingRight}\
		)`;
			this.style.height = `calc(\
			${this.#contentShadowHost.scrollHeight}px + \
			${FloatingWindow.calculateNavigationBarHeight()} + \
			2 * ${this.sizerThickness} + \
			${contentComputedStyle.marginTop} + \
			${contentComputedStyle.marginBottom} + \
			${contentComputedStyle.borderTopWidth} + \
			${contentComputedStyle.borderBottomWidth} + \
			${contentComputedStyle.paddingTop} + \
			${contentComputedStyle.paddingBottom}\
		)`;
		}

		/**
		 * Collapses all expandable elements
		 *
		 * @param {Element} exceptionalElementContainer Switchable in this container will not be collapsed
		 */
		setSwitchablesOff(exceptionalElementContainer) {
			let switchableElements = this.#iframe.contentDocument.body.querySelectorAll(".switchable");
			Array.prototype.forEach.call(switchableElements, switchableElement => {
				if (switchableElement.parentElement !== exceptionalElementContainer) {
					FloatingWindow.switchElementVisibility(switchableElement, "off");
				}
			});
		}

		/**
		 * Sets the window's `this.style`'s sizes to the current size in pixel
		 */
		fixateImplicitSize() {
			//The most precise way to get size
			let size = this.getBoundingClientRect();

			//Round up to px prematurely in order to avoid rounding errors later on
			this.style.width = size.width + "px";
			this.style.height = size.height + "px";
			this.style.top = size.top + "px";
			this.style.left = size.left + "px";
		}

		/**
		 * Fix and change size to appropriate type
		 *
		 * Sets the size to the minimum when it is set to smaller (in order to avoid resizing problems later on)
		 * It also implicitly reapplies the size type in order for the size to be in the appropriate unit
		 */
		fixLessThanMinSize() {
			// This makes sure that the calc() strings are simplified and thus usable below for dumb extraction of units
			this.onFloatingDataChange_sizeType();

			let atLeastMinWidth = FloatingWindow.calcMinMax("max", this.style.width, this.style["min-width"], "w") ? this.style.width : this.style["min-width"];
			let atLeastMinHeight = FloatingWindow.calcMinMax("max", this.style.height, this.style["min-height"], "h") ? this.style.height : this.style["min-height"];

			this.style.width = atLeastMinWidth;
			this.style.height = atLeastMinHeight;

			// This makes sure that the positioning is defined using the right units
			this.onFloatingDataChange_sizeType();
		}

		/**
		 * Saves the current positioning (size type, position, size)
		 * Only one save is stored
		 * This is intended to be used for restoring the state (with this.restorePosition()) after special styles (e.g.: maximized)
		 * The sheer existence of the saved state signifies that a specials style is currently applied
		 *
		 * @param {boolean} overwrite If true, save will be overwritten, otherwise the save will only happen if there is no previous save
		 */
		saveRestorablePosition(overwrite = false) {
			if (overwrite || !this.dataset.restorablePosition) {
				this.dataset.restorablePosition = JSON.stringify({
					sizeType: this.dataset.sizeType,
					top: this.style.top,
					left: this.style.left,
					width: this.style.width,
					height: this.style.height,
				});
			}
		}

		/**
		 * Restores a previously saved state (with this.saveRestorablePosition()) if there is any, and restoration is allowed through the this.dataset.allowRestoration
		 * This is intended to be used for restoring the state (with this.restorePosition()) after special styles (e.g.: maximized)
		 * The existence of a saved state implies that a special style is active, so it is implicitly deleted here
		 *
		 * @param {boolean} type If true, the size type is restored
		 * @param {boolean} position If true, the position is restored
		 * @param {boolean} size If true, the size is restored
		 *
		 * @returns {boolean} Shows whether or not a restoration took place
		 */
		restorePosition(type = true, position = true, size = true) {
			if (!this.dataset.allowRestoration || !this.dataset.restorablePosition) {
				// Restoration is only attempted on non-special styling, so the saved state is deleted even if not actually restored
				delete this.dataset.restorablePosition;
				return false;
			}
			const restoreData = JSON.parse(this.dataset.restorablePosition);
			delete this.dataset.allowRestoration;
			delete this.dataset.restorablePosition;

			if (position) {
				this.style.top = restoreData.top;
				this.style.left = restoreData.left;
			}

			if (size) {
				this.style.width = restoreData.width;
				this.style.height = restoreData.height;
			}

			// Setting the type last because it will automatically convert the units if necessary (although it should not be)
			if (type) {
				this.dataset.sizeType = restoreData.sizeType;
			}

			return true;
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Apply window styles

		/**
		 * Applies basic floating style.
		 * Removes alls styling from the outermost window except for the following,
		 * which it initializes if missing:
		 * - Position (default: top left)
		 * - Size (default: empty)
		 * - Min size (default: empty, but this is always expected to be inherited)
		 * - Set as top-most floating element
		 */
		applyBasicFloatingStyle() {
			let inheritableStyleAttributes = {
				top: "0",
				left: "0",

				width: "",
				height: "",

				"min-width": "",
				"min-height": "",
			};

			let partiallyInheritedCssText = "";
			for (let styleKey in inheritableStyleAttributes) {
				let valueToStartWith = this.style[styleKey] === "" ? inheritableStyleAttributes[styleKey] : this.style[styleKey];
				partiallyInheritedCssText += `${styleKey}: ${valueToStartWith};`;
			}

			this.style.cssText = partiallyInheritedCssText;

			this.style.cssText += `
			position: fixed;
			z-index: ${Number.MAX_SAFE_INTEGER};
		`;

			this.fixLessThanMinSize();
		}

		/**
		 * Applies fixed floating style.
		 * - Set BasicFloatingStyle
		 * - Set position and size, adjusted for the theoretical anchor
		 *   - If a size is defined while the size type is Auto, it will be changed to Relative in order for the size to be applicable
		 *
		 * @param {{x?: string, y?: string} | undefined} position New floating window position defined by css calc strings for both dimensions
		 * @param {{x?: string, y?: string} | undefined} size New floating window size defined by css calc strings for both dimensions
		 * @param {{x: number, y: number}} anchor Theoretical anchor defined by window percents for both dimensions. Only used if the corresponding position dimension is provided
		 */
		applyFixedStyle(position = undefined, size = undefined, anchor = { x: 0, y: 0 }) {
			this.saveRestorablePosition();

			this.applyBasicFloatingStyle();

			if (size) {
				if (size.x) {
					this.style.width = size.x;
				}
				if (size.y) {
					this.style.height = size.y;
				}
			}

			let currentSize = this.getBoundingClientRect();

			if (position) {
				if (position.x) {
					this.style.left = `calc(${position.x} + ${(currentSize.width * -anchor.x) / 100}px)`;
				}
				if (position.y) {
					this.style.top = `calc(${position.y} + ${(currentSize.height * -anchor.y) / 100}px)`;
				}
			}

			if (size && this.dataset.sizeType == "Auto") {
				// Auto must be changed for the defined size not to be removed
				this.dataset.sizeType = "Relative";
			} else {
				// The size type is reapplied so the positioning is converted to the appropriate units
				this.onFloatingDataChange_sizeType();
			}

			this.fixLessThanMinSize();
		}

		/**
		 * Applies maximized floating style.
		 * - Set BasicFloatingStyle
		 * - Set used size unit to Relative
		 * - Set position to top left
		 * - Set size to 100%
		 */
		applyMaximizedStyle() {
			this.applyBasicFloatingStyle();

			// prettier-ignore
			this.applyFixedStyle(
			{x: `calc(0%)`, y: `calc(0%)`},
			{x: `calc(100%)`, y: `calc(100%)`}
		);

			this.dataset.sizeType = "Relative";
		}

		/**
		 * Applies minimized floating style.
		 * - Set BasicFloatingStyle
		 * - Set used size unit to pixel
		 * - Set position and size to minimum
		 */
		applyMinimizedStyle() {
			this.applyBasicFloatingStyle();

			// prettier-ignore
			this.applyFixedStyle(
			{x: `calc(0%)`, y: `calc(0%)`},
			{x: `calc(0%)`, y: `calc(0%)`}
		);

			this.dataset.sizeType = "Fixed";
		}

		/**
		 * Most elements reside withing the an iframe, but somethings are intended to be sized based on the browser window.
		 * This is not possible with CSS as it has no knowledge of that, so this passes the info to the inner style
		 * and also sizes the outer frame based on the sizing of the inner elements
		 */
		applyOriginPageSizeRelatedStyles() {
			if (!this.windowStyle) {
				throw new Error("Something unexpected happened, the minimum window sizing values are not set");
			}
			const navigationBarHeight = FloatingWindow.calculateNavigationBarHeight();

			const variableContextElement = this.#iframe.contentDocument.querySelector(":root");
			variableContextElement.style.setProperty("--navigation-bar-height", navigationBarHeight);
			const computedStyle = getComputedStyle(variableContextElement);

			this.style.minWidth = `calc(${this.positionPanel.childElementCount} * ${computedStyle.getPropertyValue("--position-slot-width")} + 2 * ${this.sizerThickness})`;
			this.style.minHeight = `calc(${navigationBarHeight} + 2 * ${this.sizerThickness})`;

			// Avoid auto size being thinner than the navigation bar
			variableContextElement.style.setProperty("--min-window-width", this.style.minWidth);
		}

		/**
		 * Closes floating window by removing it from the parent element
		 */
		closeWindow() {
			if (this.parentElement) {
				this.parentElement.removeChild(this);
			}
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// Manual movement & resize handling

		/**
		 * This function initializes the window movement (see `moveWindow()`) from a mouse event, by setting modifiers which will later be used along with the mouse's movement to move and resize the window
		 * E.g.: Moving the mouse horizontally would affect the window to change it's width by "changeModifiers.width <horizontal mouse movement>"
		 *       In case the mouse movement is 10px and the modifier value is "2*", then the width will be changed by "2* 10px". basically the width increases / decreases with double the speed of the mouse movement
		 *       A modifier value of "0*" in this case disables width change
		 *
		 * @param {Object} changeModifiers Object containing the modifiers for later movement. Possible attributes:
		 * - top: Corresponds to the y coordinate of the window. Default: 0*
		 * - left: Corresponds to the x coordinate of the window. Default: 0*
		 * - width: Corresponds to the width of the window. Default: 0*
		 * - height: Corresponds to the height of the window. Default: 0*
		 * @param {MouseEvent} event
		 */
		grabWindow(changeModifiers, event) {
			let modifiers = ["top", "left", "width", "height"];
			for (let modifier of modifiers) {
				if (changeModifiers[modifier] == undefined) {
					changeModifiers[modifier] = 0;
				}
			}

			if (this.dataset.sizeType == "Auto" && (changeModifiers.width != 0 || changeModifiers.height != 0)) {
				// For the resize to be applicable, the type cannot be auto. Fixed is the closest appropriate one
				this.dataset.sizeType = "Fixed";

				// Fixate size prematurely since the observer will run after this function
				this.fixateImplicitSize();
			}

			// Fixate size, as only the user is supposed to change it while interacting with it, and it's easier to calculate with px
			this.fixateImplicitSize();

			// Store initial positioning values
			this.dataset.mouseDownX = event.clientX.toString();
			this.dataset.mouseDownY = event.clientY.toString();

			let size = this.getBoundingClientRect();

			this.dataset.mouseDownLeft = size.left.toString();
			this.dataset.mouseDownTop = size.top.toString();

			this.dataset.mouseDownWidth = size.width.toString();
			this.dataset.mouseDownHeight = size.height.toString();

			// Set position modifier values
			this.dataset.changeModifierTop = changeModifiers.top;
			this.dataset.changeModifierLeft = changeModifiers.left;

			this.dataset.changeModifierWidth = changeModifiers.width;
			this.dataset.changeModifierHeight = changeModifiers.height;

			// Actively refreshed movement vector sum
			// The iframe is moving based on the mouse, and thus changing the underlying coordinate system in which the mouse's position is measured gets falsified
			// To avoid jittering caused by this, the offset the mouse just moved in the current event is added to the last known position instead if being calculated from the mousedown and offset only
			this.dataset.mouseMovementSumX = "0";
			this.dataset.mouseMovementSumY = "0";

			// Add move and release listeners
			// Adding the event to the document somehow magically triggers even when going outside of the iframe, going out to the browser toolbar or outside the browser window
			this.#iframe.contentDocument.addEventListener("mousemove", this.boundMoveWindow);
			this.#iframe.contentDocument.addEventListener("mouseup", this.boundReleaseWindow);
		}

		/**
		 * Move / resize the floating window according to the initial setup (see grabWindow())
		 *
		 * @param {MouseEvent} event Event caused by dragging the window with the mouse
		 */
		moveWindow(event) {
			if (
				this.dataset.mouseDownY === undefined ||
				this.dataset.mouseDownX === undefined ||
				this.dataset.mouseDownTop === undefined ||
				this.dataset.mouseDownLeft === undefined ||
				this.dataset.mouseDownWidth === undefined ||
				this.dataset.mouseDownHeight === undefined ||
				this.dataset.mouseMovementSumX === undefined ||
				this.dataset.mouseMovementSumY === undefined ||
				this.dataset.changeModifierTop === undefined ||
				this.dataset.changeModifierLeft === undefined ||
				this.dataset.changeModifierWidth === undefined ||
				this.dataset.changeModifierHeight === undefined
			) {
				throw new Error("The movement related preset value was undefined, but that should not have been possible as it's supposed to be initialized when the window is grabbed");
			}

			const mouseMovementComparedToGrabX = event.clientX - parseInt(this.dataset.mouseDownX);
			const mouseMovementComparedToGrabY = event.clientY - parseInt(this.dataset.mouseDownY);

			if (this.dataset.sizeType != "Auto") {
				// Since in case of a "movement" only the size is adjusted, and "Auto" mode has no size to adjust, this is not applicable in that case
				// Manual handling of the window is not a special state from which restoration is desired, so the state is deleted after restored
				const restored = this.restorePosition(true, false, true);
				if (restored) {
					// When the window is restored to a previous state, the "original size" saved in grabWindow() has to be adjusted to it

					// Css calc() would be nice, but "/" only works if the divisor is not a length unit, so at least part of the calculation cannot be solved with calc()
					const windowBoundingRect = this.getBoundingClientRect();
					const originalWindowRelativeLeft = parseInt(this.dataset.mouseDownX);
					const originalWindowRelativeLeftRatio = originalWindowRelativeLeft / parseInt(this.dataset.mouseDownWidth);
					const restoredWindowRelativeLeft = originalWindowRelativeLeftRatio * windowBoundingRect.width;
					const leftAdjustment = originalWindowRelativeLeft - restoredWindowRelativeLeft;
					const adjustedLeft = parseInt(this.dataset.mouseDownLeft) + leftAdjustment;

					this.dataset.mouseDownLeft = adjustedLeft.toString();
					this.dataset.mouseDownX = (parseInt(this.dataset.mouseDownX) - leftAdjustment).toString();

					this.dataset.mouseDownWidth = windowBoundingRect.width.toString();
					this.dataset.mouseDownHeight = windowBoundingRect.height.toString();
				}
			}

			this.dataset.mouseMovementSumX = `${parseInt(this.dataset.mouseMovementSumX) + mouseMovementComparedToGrabX}`;
			this.dataset.mouseMovementSumY = `${parseInt(this.dataset.mouseMovementSumY) + mouseMovementComparedToGrabY}`;

			// Position
			this.style.top = `${parseInt(this.dataset.mouseDownTop) + parseInt(this.dataset.changeModifierTop) * parseInt(this.dataset.mouseMovementSumY)}px`;
			this.style.left = `${parseInt(this.dataset.mouseDownLeft) + parseInt(this.dataset.changeModifierLeft) * parseInt(this.dataset.mouseMovementSumX)}px`;

			// Size
			this.style.width = `${parseInt(this.dataset.mouseDownWidth) + parseInt(this.dataset.changeModifierWidth) * (this.dataset.changeModifierLeft != "0" ? parseInt(this.dataset.mouseMovementSumX) : mouseMovementComparedToGrabX)}px`;
			this.style.height = `${parseInt(this.dataset.mouseDownHeight) + parseInt(this.dataset.changeModifierHeight) * (this.dataset.changeModifierTop != "0" ? parseInt(this.dataset.mouseMovementSumY) : mouseMovementComparedToGrabY)}px`;
		}

		/**
		 * Finalizes the repositioning / resizing of the window (see moveWindow())
		 */
		releaseWindow(event) {
			// Delete initial positioning values
			delete this.dataset.mouseDownX;
			delete this.dataset.mouseDownY;

			delete this.dataset.mouseDownLeft;
			delete this.dataset.mouseDownTop;

			delete this.dataset.mouseDownWidth;
			delete this.dataset.mouseDownHeight;

			// Set position modifier values
			delete this.dataset.changeModifierLeft;
			delete this.dataset.changeModifierTop;

			delete this.dataset.changeModifierWidth;
			delete this.dataset.changeModifierHeight;

			// Remove move and release listeners
			this.#iframe.contentDocument.removeEventListener("mousemove", this.boundMoveWindow);
			this.#iframe.contentDocument.removeEventListener("mouseup", this.boundReleaseWindow);

			this.fixLessThanMinSize();
		}

		////////////////////////////////////////////////////////////////////////////////////////////////
		// General style

		/**
		 * Applies the general style on the floating window
		 */
		updateFloatingWindowStyle() {
			if (!this.positionPanel) {
				throw new Error("Some elements are not initialized when expected");
			}
			this.contentStyle.textContent = FloatingWindow.preBuiltStyles.darkMode;
			this.windowStyle.textContent = `
				:root {
					/* These are updated when the window is resized. The initial sizes below never take effect */
					--navigation-bar-height: 10px;
					--min-window-width: 10px;

					--position-slot-width: calc(1.5 * var(--navigation-bar-height));
				}

				[contenteditable] {
					outline: 0px solid transparent;
				}

				.hidden {
					display: none!important;
				}

				#windowSizerContainer {
					position: absolute;
					top: 0;
					left: 0;

					width: 100%;
					height: 100%;

					z-index: 0;
				}

				#floatingWindow {
					margin: ${this.sizerThickness};
					position: absolute;
					width: calc(100% - 2*${this.sizerThickness});
					height: calc(100% - 2*${this.sizerThickness});

					font-size: 15px;

					border-radius: ${this.windowBorderRadius};
					
					z-index: 1;
				}

				#navigationBar {
					display: block;

					width: 100%;
					height: var(--navigation-bar-height);

					background-color: #444;

					border-radius: ${this.windowBorderRadius} ${this.windowBorderRadius} 0 0;

					user-select: none;
				}


				#positionPanel {
					display: flex;

					height: 100%;

					float: right;
				}

				#positionPanel,
				#positionPanel > .positionSlot:last-child,
				#positionPanel > .positionSlot:last-child > .positionButton {
					border-radius: 0 ${this.windowBorderRadius} 0 0;
				}

				.positionSlot {
					height: 100%;
					width: var(--position-slot-width);
				}

				.positionButton {
					display: flex;

					height: 100%;
					width: 100%;

					align-items: center;
					justify-content: center;

					font-size: calc(0.8 * var(--navigation-bar-height));
					font-weight: bold;

					cursor: pointer;

					color: white;
				}

				.positionButton:hover {
					filter: brightness(130%);
				}

				#movableButton:hover {
					filter: unset;
					cursor: unset;
				}

				#sizeTypeButton,
				.sizeTypeButton {
					background-color: #707;
				}

				#minimizeButton {
					background-color: #777;
				}

				#fixedButton,
				.fixedButton {
					background-color: #07b;
				}

				#maximizeButton {
					background-color: #070;
				}

				#closeButton {
					background-color: #a00;
				}

				.switchable {
					position: absolute;
				}

				#sizeTypeButtonPanel {
					width: calc(3 * var(--position-slot-width));
					height: calc(3 * var(--position-slot-width));

					display: grid;

					grid-template-columns: 1fr;
					grid-template-rows: 1fr 1fr 1fr;
				}

				#fixedButtonGrid {
					width: calc(3 * var(--position-slot-width));
					height: calc(3 * var(--position-slot-width));

					display: grid;

					grid-template-columns: 1fr 1fr 1fr;
					grid-template-rows: 1fr 1fr 1fr;
				}

				.sizer {
					position: absolute;

					user-select: none;
					-moz-user-select: none;
					-webkit-user-select: none;
					-ms-user-select: none;
					user-drag: none;
					-webkit-user-drag: none;
				}

				.sizer:hover {
					background-color: #000;
					opacity: 0.2;
				}

				.sizerTop,
				.sizerBottom {
					left: 50%;
					transform: translate(-50%, 0);

					width: calc(100% - (2 * ${this.windowBorderRadius}));
					height: ${this.sizerThickness};

					cursor: ns-resize;
				}

				.sizerLeft,
				.sizerRight {
					top: 50%;
					transform: translate(0, -50%);

					width: ${this.sizerThickness};
					height: calc(100% - (2 * ${this.windowBorderRadius}));

					cursor: ew-resize;
				}

				.sizerTop.sizerLeft,
				.sizerBottom.sizerRight {
					cursor: nwse-resize;
				}

				.sizerTop.sizerRight,
				.sizerBottom.sizerLeft {
					cursor: nesw-resize;
				}

				.sizerCorner {
					width: calc(${this.windowBorderRadius} + ${this.sizerThickness});
					height: calc(${this.windowBorderRadius} + ${this.sizerThickness});

					top: unset;
					bottom: unset;
					left: unset;
					right: unset;

					transform: unset;
				}

				.sizerTop {
					top: 0;
				}

				.sizerBottom {
					bottom: 0;
				}

				.sizerLeft {
					left: 0;
				}

				.sizerRight {
					right: 0;
				}



				#content {
					display: block;

					width: 100%;
					height: calc(100% - var(--navigation-bar-height));

					overflow: auto;
				}

				#content.${FloatingWindow.contentAutoSizeClassName} {
					min-width: var(--min-window-width);
					width: fit-content;
					height: fit-content;
				}
			`;
		}

		static preBuiltStyles = {
			darkMode: `
				/* Generic */
				:host {
					background-color: #000000;
					color: #ccc;

					border-style: solid;
					border-color: #444;
					border-width: 0px 1px 1px 1px;
					box-sizing: border-box;
				}

				* {
					color: #ccc;
				}

				/* Separator */
				hr {
					display: block;
					border: 1px inset;
				}

				/* Button */
				button {
					background-color: #444;
					color: #eee !important;

					padding: 0.2em 0.4em 0.2em 0.4em;
					border: none;
					border-radius: 0.2em;
					box-shadow: inset 0 0 0 1px #777;

					cursor: pointer;
					user-select: none;
				}

				button:hover {
					background-color: #555;
				}

				button:active {
					background-color: #333;
					
					border: none;
					border-radius: 0.2em;
					box-shadow: inset 0 0 0 2px #777;
				}

				/* Textarea */
				textarea {
					background-color: #222;
				}

				/* Linking */
				:any-link {
					cursor: pointer;
					text-decoration: underline;
				}

				a:link {
					color: LinkText!important;
				}

				a:visited {
					color: VisitedText!important;
				}

				a:hover,
				a:focus {
					text-decoration: none;
				}

				a:active {
					color: ActiveText!important
				}
			`,

			lightMode: `
				/* Generic */
				:host {
					background-color: #fff;

					border-style: solid;
					border-color: #444;
					border-width: 0px 1px 1px 1px;
					box-sizing: border-box;
				}

				/* Button */
				button {
					cursor: pointer;
					user-select: none;
				}

				/* Linking */
				:any-link {
					cursor: pointer;
					text-decoration: underline;
				}

				a:link {
					color: LinkText!important;
				}

				a:visited {
					color: VisitedText!important;
				}

				a:hover, a:focus {
					text-decoration: none;
				}

				a:active {
					color: ActiveText!important
				}
			`,
		};
	};

// Register FloatingWindow
if (!customElements.get(FloatingWindow.tagName)) {
	customElements.define(FloatingWindow.tagName, FloatingWindow);
} else {
	console.debug(`"${FloatingWindow.tagName}" is already defined`);
}
