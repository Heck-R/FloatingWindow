/**
 * A floating window html element with the following capabilities:
 * - Can be dragged around by grabbing it by the title bar
 * - Can be resized by dragging the sides
 * - Can be minimized / Maxed
 * - Size modes can be applied
 *   - Auto: Resized based on content, and keeps position
 *   - Fixed: Preserves size and position
 *   - Relative: Resizes and repositions in a way to always occupy the same relative location
 * - Ignores page css
 *
 * Content can be added to the FloatingWindow.content element
 */
class FloatingWindow extends HTMLElement {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// Overrides

	connectedCallback() {
		// Observed variables
		if (this.dataset.sizeType == undefined) {
			this.dataset.sizeType = "Auto";
		}

		// Minimal style
		this.style.cssText = `
			position: fixed;
			z-index: ${Number.MAX_SAFE_INTEGER};
		`;

		this.updateFloatingWindowStyle();
		this.applyBasicFloatingStyle();
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// initialization

	// prettier-ignore
	constructor() {
		super();

		// Default values
		this.sizerThickness = "5px";
		this.windowBorderRadius = "calc(5px)";
		this.navigationBarHeight = "calc(10px + 1.5vh)";
		this.minWindowWidth = "calc(90px + 13.5vh)"; // 9 * navigationBarHeight - Why? Because that ratio looks nice
		this.minFixedButtonSize = "calc(45px + 6.75vh)"; // 3/6 * minWindowWidth - Why? Because there are 6 button slots in the nav bar and this spans 3 like this

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

		// Shadow root for better separation from the page
		let shadowRoot = this.attachShadow({ mode: "open" });

		// Window sizer panel
		let windowSizerContainer = document.createElement("div");
		windowSizerContainer.id = "windowSizerContainer";

		// Sizer - Accidental Selection Blocker
		let sizerSelectionBlockerOverlay = document.createElement("div");
		sizerSelectionBlockerOverlay.id = "sizerSelectionBlockerOverlay";
		sizerSelectionBlockerOverlay.classList.add("hidden");

		// Sizer - Top
		let sizerTop = document.createElement("div");
		sizerTop.classList.add("sizer", "sizerTop");
		sizerTop.addEventListener("mousedown", this.grabWindow.bind(this, { top: "1*", height: "-1*" }));

		// Sizer - Bottom
		let sizerBottom = document.createElement("div");
		sizerBottom.classList.add("sizer", "sizerBottom");
		sizerBottom.addEventListener("mousedown", this.grabWindow.bind(this, { height: "1*" }));

		// Sizer - Left
		let sizerLeft = document.createElement("div");
		sizerLeft.classList.add("sizer", "sizerLeft");
		sizerLeft.addEventListener("mousedown", this.grabWindow.bind(this, { left: "1*", width: "-1*" }));

		// Sizer - Right
		let sizerRight = document.createElement("div");
		sizerRight.classList.add("sizer", "sizerRight");
		sizerRight.addEventListener("mousedown", this.grabWindow.bind(this, { width: "1*" }));

		// Sizer - TopLeft
		let sizerTopLeft = document.createElement("div");
		sizerTopLeft.classList.add("sizer", "sizerCorner", "sizerTop", "sizerLeft");
		sizerTopLeft.addEventListener("mousedown", this.grabWindow.bind(this, { top: "1*", left: "1*", width: "-1*", height: "-1*" }));

		// Sizer - TopRight
		let sizerTopRight = document.createElement("div");
		sizerTopRight.classList.add("sizer", "sizerCorner", "sizerTop", "sizerRight");
		sizerTopRight.addEventListener("mousedown", this.grabWindow.bind(this, { top: "1*", width: "1*", height: "-1*" }));

		// Sizer - BottomLeft
		let sizerBottomLeft = document.createElement("div");
		sizerBottomLeft.classList.add("sizer", "sizerCorner", "sizerBottom", "sizerLeft");
		sizerBottomLeft.addEventListener("mousedown", this.grabWindow.bind(this, { left: "1*", width: "-1*", height: "1*" }));

		// Sizer - BottomRight
		let sizerBottomRight = document.createElement("div");
		sizerBottomRight.classList.add("sizer", "sizerCorner", "sizerBottom", "sizerRight");
		sizerBottomRight.addEventListener("mousedown", this.grabWindow.bind(this, { width: "1*", height: "1*" }));

		// Floating window element
		let floatingWindow = document.createElement("div");
		floatingWindow.id = "floatingWindow";

		// Styles
		// The style of the content itself. Since the window style removed all outside styling, this serves like a browser's default style
		let contentStyle = document.createElement("style");
		contentStyle.id = "contentStyle";
		contentStyle.setAttribute("scoped", "");

		// The style of the window itself, including the navigation bar and resizers at the edges
		// For a consistent look across all browsers and pages, it starts by removing all styling
		let windowStyle = document.createElement("style");
		windowStyle.id = "windowStyle";
		windowStyle.setAttribute("scoped", "");

		// Navbar
		let navigationBar = document.createElement("div");
		navigationBar.id = "navigationBar";
		navigationBar.addEventListener("mousedown", event => {
			// Allow window restoration when the navigation bar is dragged
			this.dataset.allowRestoration = "true";
			this.grabWindow({ top: "1*", left: "1*" }, event);
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
		navigationBar.addEventListener("mouseup", () => {delete this.dataset.allowRestoration;});

		this.boundMoveWindow = this.moveWindow.bind(this);
		this.boundReleaseWindow = this.releaseWindow.bind(this);

		// Size panel
		let positionPanel = document.createElement("div");
		positionPanel.id = "positionPanel";

		let propagationStopper = event => {event.stopPropagation();};

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
				const applySpecificFixedStyle = (event) => {
					if (event.shiftKey) {
						this.applyFixedStyle(
							{x: `calc(${colNum * 50}%)`, y: `calc(${rowNum * 50}%)`},
							undefined,
							{ x: colNum * 50, y: rowNum * 50 }
						);
					} else {
						this.applyFixedStyle(
							{x: `calc(${colNum * 50}%)`, y: `calc(${rowNum * 50}%)`},
							{x: `calc(${colNum % 2 == 0 ? 50 : 100}%)`, y: `calc(${rowNum % 2 == 0 ? 50 : 100}%)`},
							{ x: colNum * 50, y: rowNum * 50 }
						);
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
		let content = document.createElement("div");
		content.id = "content";

		// Assemble
		shadowRoot.appendChild(windowStyle);
		shadowRoot.appendChild(contentStyle);
		shadowRoot.appendChild(floatingWindow);
			floatingWindow.appendChild(navigationBar);
				navigationBar.appendChild(positionPanel);
					positionPanel.appendChild(movableSlot);
					positionPanel.appendChild(sizeTypeSlot);
						sizeTypeSlot.appendChild(sizeTypeButtonPanel);
					positionPanel.appendChild(minimizeSlot);
					positionPanel.appendChild(fixedSlot);
						fixedSlot.appendChild(fixedButtonGrid);
					positionPanel.appendChild(maximizeSlot);
					positionPanel.appendChild(closeSlot);
			floatingWindow.appendChild(content);
		shadowRoot.appendChild(windowSizerContainer);
			windowSizerContainer.appendChild(sizerSelectionBlockerOverlay);
			windowSizerContainer.appendChild(sizerTop);
			windowSizerContainer.appendChild(sizerBottom);
			windowSizerContainer.appendChild(sizerLeft);
			windowSizerContainer.appendChild(sizerRight);
			windowSizerContainer.appendChild(sizerTopLeft);
			windowSizerContainer.appendChild(sizerTopRight);
			windowSizerContainer.appendChild(sizerBottomLeft);
			windowSizerContainer.appendChild(sizerBottomRight);

		// Window listeners
		this.addEventListener("mousedown", this.setSwitchablesOff.bind(this));

		// Window resize handling
		window.addEventListener("resize", () => {this.fixLessThatMinSize();});

		// Accessible parts
		this.content = content;
		this.contentStyle = contentStyle;
		this.windowStyle = windowStyle;
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

		const percentPx = referenceDimensionSize * objectCalc["%"] / 100;
		const vwPx = document.documentElement.clientWidth * objectCalc["vw"] / 100;
		const vhPx = document.documentElement.clientHeight * objectCalc["vh"] / 100;
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
		
		const pxPercent = objectCalc["px"] * 100 / referenceDimensionSize;
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
			throw "The minMax parameter's value must be 'min' or 'max'";
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
		if (this.dataset.sizeType != "Auto" && (!this.style.width || !this.style.height)) {
			// For non-Auto modes, the window must have width and height defined
			this.fixateImplicitSize();
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
				this.style.width = "";
				this.style.height = "";
				break;
			default:
				throw `Cannot set size type to ${this.dataset.sizeType}`;
		}
	}

	/**
	 * Collapses all expandable elements
	 *
	 * @param {Element} exceptionalElementContainer Switchable in this container will not be collapsed
	 */
	setSwitchablesOff(exceptionalElementContainer) {
		let switchableElements = this.shadowRoot.querySelectorAll(".switchable");
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
	}

	/**
	 * Sets the size to the minimum when it is set to smaller (in order to avoid resizing problems later on)
	 * It also implicitly reapplies the size type in order for the size to be in the appropriate unit
	 */
	fixLessThatMinSize() {
		// This makes sure that the calc() strings are simplified and thus usable below for dumb extraction of units
		this.onFloatingDataChange_sizeType();

		let atLeastMinWidth = FloatingWindow.calcMinMax("max", this.style.width, this.style["min-width"], "w") ? this.style.width : this.style["min-width"];
		let atLeastMinHeight = FloatingWindow.calcMinMax("max", this.style.height, this.style["min-height"], "h") ? this.style.height : this.style["min-height"];

		this.style.width = `${atLeastMinWidth}px`;
		this.style.height = `${atLeastMinHeight}px`;

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
	 * - Set min size
	 * - Unset size
	 * - Set position to top left
	 * - Set as top-most floating element
	 */
	applyBasicFloatingStyle() {
		let inheritableStyleAttributes = {
			width: "",
			height: "",

			"min-width": this.minWindowWidth,
			"min-height": this.navigationBarHeight,

			top: "0",
			left: "0",
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

		this.fixLessThatMinSize();
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

		// Fix and change size to appropriate type
		this.fixLessThatMinSize();
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
				changeModifiers[modifier] = "0*";
			}
		}

		if (this.dataset.sizeType == "Auto" && (changeModifiers.width != "0*" || changeModifiers.height != "0*")) {
			// For the resize to be applicable, the type cannot be auto. Fixed is the closest appropriate one
			this.dataset.sizeType = "Fixed";

			// Fixate size prematurely since the observer will run after this function
			this.fixateImplicitSize();
		}

		// Store initial positioning values
		this.dataset.mouseDownX = event.clientX.toString();
		this.dataset.mouseDownY = event.clientY.toString();

		this.dataset.mouseDownLeft = this.style.left;
		this.dataset.mouseDownTop = this.style.top;

		this.dataset.mouseDownWidth = this.style.width;
		this.dataset.mouseDownHeight = this.style.height;

		// Set position modifier values
		this.dataset.changeModifierTop = changeModifiers.top;
		this.dataset.changeModifierLeft = changeModifiers.left;

		this.dataset.changeModifierWidth = changeModifiers.width;
		this.dataset.changeModifierHeight = changeModifiers.height;

		// Apply invisible overlay to block unwanted selection on the page
		this.shadowRoot.getElementById("sizerSelectionBlockerOverlay").classList.remove("hidden");

		// Add move and release listeners
		document.body.addEventListener("mousemove", this.boundMoveWindow);
		document.body.addEventListener("mouseup", this.boundReleaseWindow);
	}

	/**
	 * Move / resize the floating window according to the initial setup (see grabWindow())
	 *
	 * @param {MouseEvent} event Event caused by dragging the window with the mouse
	 */
	moveWindow(event) {
		if (this.dataset.mouseDownY === undefined || this.dataset.mouseDownX === undefined || this.dataset.mouseDownTop === undefined || this.dataset.mouseDownLeft === undefined || this.dataset.mouseDownWidth === undefined || this.dataset.mouseDownHeight === undefined) {
			return;
		}

		// Manual handling of the window is not a special state from which restoration is desired, so the state is deleted after restored
		const restored = this.restorePosition(true, false, true);
		if (restored) {
			// When the window is restored to a previous state, the "original position" saved in grabWindow() has to be adjusted to it

			// Css calc() would be nice, but "/" only works if the divisor is not a length unit, so at least part of the calculation cannot be solved with calc()
			const windowBoundingRect = this.getBoundingClientRect();
			const restoredWindowRelativeLeft = FloatingWindow.convertStyleCalcSizeToPx(this.dataset.mouseDownLeft, "w") - parseInt(this.dataset.mouseDownX);
			const restoredWindowRelativeLeftRatio = restoredWindowRelativeLeft / FloatingWindow.convertStyleCalcSizeToPx(this.dataset.mouseDownWidth, "w");
			const windowRelativePosition = restoredWindowRelativeLeftRatio * windowBoundingRect.width;
			this.dataset.mouseDownLeft = `calc(${this.dataset.mouseDownX}px + ${windowRelativePosition}px)`;

			this.dataset.mouseDownWidth = this.style.width;
			this.dataset.mouseDownHeight = this.style.height;
		}

		// Position
		this.style.top = `calc(${this.dataset.mouseDownTop} + (${this.dataset.changeModifierTop} ${event.clientY - parseInt(this.dataset.mouseDownY)}px))`;
		this.style.left = `calc(${this.dataset.mouseDownLeft} + (${this.dataset.changeModifierLeft} ${event.clientX - parseInt(this.dataset.mouseDownX)}px))`;

		// Size
		this.style.width = `calc(${this.dataset.mouseDownWidth} + (${this.dataset.changeModifierWidth} ${event.clientX - parseInt(this.dataset.mouseDownX)}px))`;
		this.style.height = `calc(${this.dataset.mouseDownHeight} + (${this.dataset.changeModifierHeight} ${event.clientY - parseInt(this.dataset.mouseDownY)}px))`;
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

		// Remove invisible overlay to block unwanted selection on the page
		this.shadowRoot.getElementById("sizerSelectionBlockerOverlay").classList.add("hidden");

		// Remove move and release listeners
		document.body.removeEventListener("mousemove", this.boundMoveWindow);
		document.body.removeEventListener("mouseup", this.boundReleaseWindow);

		// Fix and change size to appropriate type
		this.fixLessThatMinSize();
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// General style

	/**
	 * Applies the general style on the floating window
	 */
	updateFloatingWindowStyle() {
		this.contentStyle.textContent = FloatingWindow.chromeDefault + FloatingWindow.darkModeExtension;
		this.windowStyle.textContent = `
			* {
				all: initial;
			}

			[contenteditable] {
				outline: 0px solid transparent;
			}

			style {
				display: none;
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

				z-index: -1;
			}

			#floatingWindow {
				width: 100%;
				height: 100%;

				font-size: 15px;

				border-radius: ${this.windowBorderRadius};
			}

			#navigationBar {
				display: block;

				width: 100%;
				height: ${this.navigationBarHeight};

				background-color: #444;

				border-radius: ${this.windowBorderRadius} ${this.windowBorderRadius} 0 0;

				user-select: none;
			}


			#positionPanel {
				display: flex;

				height: 100%;
				width: 25%;
				min-width: ${this.minWindowWidth};

				float: right;
			}

			#positionPanel, #positionPanel > .positionSlot:last-child, #positionPanel > .positionSlot:last-child > .positionButton {
				border-radius: 0 ${this.windowBorderRadius} 0 0;
			}

			.positionSlot {
				height: 100%;
				width: 20%;
			}

			.positionButton {
				display: flex;

				height: 100%;
				width: 100%;

				align-items: center;
				justify-content: center;

				font-size: calc(10px + 1vh);
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

			#sizeTypeButton, .sizeTypeButton {
				background-color: #707;
			}

			#minimizeButton {
				background-color: #777;
			}

			#fixedButton, .fixedButton {
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

				min-width: ${this.minFixedButtonSize};
				min-height: ${this.minFixedButtonSize};
			}

			#sizeTypeButtonPanel {
				display: grid;

				grid-template-columns: 1fr;
				grid-template-rows: 1fr 1fr 1fr;

			}

			#fixedButtonGrid {
				display: grid;

				grid-template-columns: 1fr 1fr 1fr;
				grid-template-rows: 1fr 1fr 1fr;

			}


			#sizerSelectionBlockerOverlay {
				position: fixed;

				top: 0;
				left: 0;

				width: 100vw;
				height: 100vh;
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

			.sizerTop, .sizerBottom {
				left: 50%;
				transform: translate(-50%, 0);

				width: calc(100% - (2 * ${this.windowBorderRadius}));
				height: ${this.sizerThickness};

				cursor: ns-resize;
			}

			.sizerLeft, .sizerRight {
				top: 50%;
				transform: translate(0, -50%);

				width: ${this.sizerThickness};
				height: calc(100% - (2 * ${this.windowBorderRadius}));

				cursor: ew-resize;
			}

			.sizerTop.sizerLeft, .sizerBottom.sizerRight {
				cursor: nwse-resize;
			}

			.sizerTop.sizerRight, .sizerBottom.sizerLeft {
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
				top: -${this.sizerThickness};
			}

			.sizerBottom {
				bottom: -${this.sizerThickness};
			}

			.sizerLeft {
				left: -${this.sizerThickness};
			}

			.sizerRight {
				right: -${this.sizerThickness};
			}



			#content {
				display: block;

				width: 100%;
				height: calc(100% - ${this.navigationBarHeight});

				overflow: auto;
			}
		`;
	}

	static darkModeExtension = `
		/* Generic */
		#content {
			background-color: #000000;
			color: #ccc;
		}

		#content * {
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
			box-shadow: inset 0 0 0 2px #777;

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

		/* Linking */
		:link, :visited {
			text-decoration: underline
		}

		a:link {
			color: skyblue!important;
		}

		a:visited {
			color: violet!important;
		}

		a:hover, a:focus {
			color: aqua!important;
		}

		a:active {
			color: cadetblue!important
		}
	`;

	static lightModeExtension = `
		/* Generic */
		#content {
			background-color: #fff;
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
	`;
	
	// The chrome default css
	static chromeDefault = `
/*
	* The default style sheet used to render HTML.
	*
	* Copyright (C) 2000 Lars Knoll (knoll@kde.org)
	* Copyright (C) 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011 Apple Inc. All rights reserved.
	*
	* This library is free software; you can redistribute it and/or
	* modify it under the terms of the GNU Library General Public
	* License as published by the Free Software Foundation; either
	* version 2 of the License, or (at your option) any later version.
	*
	* This library is distributed in the hope that it will be useful,
	* but WITHOUT ANY WARRANTY; without even the implied warranty of
	* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
	* Library General Public License for more details.
	*
	* You should have received a copy of the GNU Library General Public License
	* along with this library; see the file COPYING.LIB.  If not, write to
	* the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
	* Boston, MA 02110-1301, USA.
	*
	*/
@namespace "http://www.w3.org/1999/xhtml";
html {
	display: block
}
/* children of the <head> element all have display:none */
head {
	display: none
}
meta {
	display: none
}
title {
	display: none
}
link {
	display: none
}
style {
	display: none
}
script {
	display: none
}
/* generic block-level elements */
body {
	display: block;
	margin: 8px
}
body:-webkit-full-page-media {
	background-color: rgb(0, 0, 0)
}
p {
	display: block;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1__qem;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
}
div {
	display: block
}
layer {
	display: block
}
article, aside, footer, header, hgroup, main, nav, section {
	display: block
}
marquee {
	display: inline-block;
}
address {
	display: block
}
blockquote {
	display: block;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 40px;
	-webkit-margin-end: 40px;
}
figcaption {
	display: block
}
figure {
	display: block;
	-webkit-margin-before: 1em;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 40px;
	-webkit-margin-end: 40px;
}
q {
	display: inline
}
q:before {
	content: open-quote;
}
q:after {
	content: close-quote;
}
center {
	display: block;
	/* special centering to be able to emulate the html4/netscape behaviour */
	text-align: -webkit-center
}
hr {
	display: block;
	-webkit-margin-before: 0.5em;
	-webkit-margin-after: 0.5em;
	-webkit-margin-start: auto;
	-webkit-margin-end: auto;
	border-style: inset;
	border-width: 1px
}
map {
	display: inline
}
video {
	object-fit: contain;
}
/* heading elements */
h1 {
	display: block;
	font-size: 2em;
	-webkit-margin-before: 0.67__qem;
	-webkit-margin-after: 0.67em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
:-webkit-any(article,aside,nav,section) h1 {
	font-size: 1.5em;
	-webkit-margin-before: 0.83__qem;
	-webkit-margin-after: 0.83em;
}
:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
	font-size: 1.17em;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
}
:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
	font-size: 1.00em;
	-webkit-margin-before: 1.33__qem;
	-webkit-margin-after: 1.33em;
}
:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
	font-size: .83em;
	-webkit-margin-before: 1.67__qem;
	-webkit-margin-after: 1.67em;
}
:-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) :-webkit-any(article,aside,nav,section) h1 {
	font-size: .67em;
	-webkit-margin-before: 2.33__qem;
	-webkit-margin-after: 2.33em;
}
h2 {
	display: block;
	font-size: 1.5em;
	-webkit-margin-before: 0.83__qem;
	-webkit-margin-after: 0.83em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
h3 {
	display: block;
	font-size: 1.17em;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
h4 {
	display: block;
	-webkit-margin-before: 1.33__qem;
	-webkit-margin-after: 1.33em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
h5 {
	display: block;
	font-size: .83em;
	-webkit-margin-before: 1.67__qem;
	-webkit-margin-after: 1.67em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
h6 {
	display: block;
	font-size: .67em;
	-webkit-margin-before: 2.33__qem;
	-webkit-margin-after: 2.33em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	font-weight: bold
}
/* tables */
table {
	display: table;
	border-collapse: separate;
	border-spacing: 2px;
	border-color: gray
}
thead {
	display: table-header-group;
	vertical-align: middle;
	border-color: inherit
}
tbody {
	display: table-row-group;
	vertical-align: middle;
	border-color: inherit
}
tfoot {
	display: table-footer-group;
	vertical-align: middle;
	border-color: inherit
}
/* for tables without table section elements (can happen with XHTML or dynamically created tables) */
table > tr {
	vertical-align: middle;
}
col {
	display: table-column
}
colgroup {
	display: table-column-group
}
tr {
	display: table-row;
	vertical-align: inherit;
	border-color: inherit
}
td, th {
	display: table-cell;
	vertical-align: inherit
}
th {
	font-weight: bold
}
caption {
	display: table-caption;
	text-align: -webkit-center
}
/* lists */
ul, menu, dir {
	display: block;
	list-style-type: disc;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	-webkit-padding-start: 40px
}
ol {
	display: block;
	list-style-type: decimal;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
	-webkit-padding-start: 40px
}
li {
	display: list-item;
	text-align: -webkit-match-parent;
}
ul ul, ol ul {
	list-style-type: circle
}
ol ol ul, ol ul ul, ul ol ul, ul ul ul {
	list-style-type: square
}
dd {
	display: block;
	-webkit-margin-start: 40px
}
dl {
	display: block;
	-webkit-margin-before: 1__qem;
	-webkit-margin-after: 1em;
	-webkit-margin-start: 0;
	-webkit-margin-end: 0;
}
dt {
	display: block
}
ol ul, ul ol, ul ul, ol ol {
	-webkit-margin-before: 0;
	-webkit-margin-after: 0
}
/* form elements */
form {
	display: block;
	margin-top: 0__qem;
}
label {
	cursor: default;
}
legend {
	display: block;
	-webkit-padding-start: 2px;
	-webkit-padding-end: 2px;
	border: none
}
fieldset {
	display: block;
	-webkit-margin-start: 2px;
	-webkit-margin-end: 2px;
	-webkit-padding-before: 0.35em;
	-webkit-padding-start: 0.75em;
	-webkit-padding-end: 0.75em;
	-webkit-padding-after: 0.625em;
	border: 2px groove ThreeDFace;
	min-width: -webkit-min-content;
}
button {
	-webkit-appearance: button;
}
/* Form controls don't go vertical. */
input, textarea, keygen, select, button, meter, progress {
	-webkit-writing-mode: horizontal-tb !important;
}
input, textarea, keygen, select, button {
	margin: 0__qem;
	font: -webkit-small-control;
	text-rendering: auto; /* FIXME: Remove when tabs work with optimizeLegibility. */
	color: initial;
	letter-spacing: normal;
	word-spacing: normal;
	line-height: normal;
	text-transform: none;
	text-indent: 0;
	text-shadow: none;
	display: inline-block;
	text-align: start;
}
input[type="hidden" i] {
	display: none
}
input {
	-webkit-appearance: textfield;
	padding: 1px;
	background-color: white;
	border: 2px inset;
	-webkit-rtl-ordering: logical;
	-webkit-user-select: text;
	cursor: auto;
}
input[type="search" i] {
	-webkit-appearance: searchfield;
	box-sizing: border-box;
}
input::-webkit-textfield-decoration-container {
	display: flex;
	align-items: center;
	-webkit-user-modify: read-only !important;
	content: none !important;
}
input[type="search" i]::-webkit-textfield-decoration-container {
	direction: ltr;
}
input::-webkit-clear-button {
	-webkit-appearance: searchfield-cancel-button;
	display: inline-block;
	flex: none;
	-webkit-user-modify: read-only !important;
	-webkit-margin-start: 2px;
	opacity: 0;
	pointer-events: none;
}
input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-clear-button {
	opacity: 1;
	pointer-events: auto;
}
input[type="search" i]::-webkit-search-cancel-button {
	-webkit-appearance: searchfield-cancel-button;
	display: block;
	flex: none;
	-webkit-user-modify: read-only !important;
	-webkit-margin-start: 1px;
	opacity: 0;
	pointer-events: none;
}
input[type="search" i]:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-search-cancel-button {
	opacity: 1;
	pointer-events: auto;
}
input[type="search" i]::-webkit-search-decoration {
	-webkit-appearance: searchfield-decoration;
	display: block;
	flex: none;
	-webkit-user-modify: read-only !important;
	-webkit-align-self: flex-start;
	margin: auto 0;
}
input[type="search" i]::-webkit-search-results-decoration {
	-webkit-appearance: searchfield-results-decoration;
	display: block;
	flex: none;
	-webkit-user-modify: read-only !important;
	-webkit-align-self: flex-start;
	margin: auto 0;
}
input::-webkit-inner-spin-button {
	-webkit-appearance: inner-spin-button;
	display: inline-block;
	cursor: default;
	flex: none;
	align-self: stretch;
	-webkit-user-select: none;
	-webkit-user-modify: read-only !important;
	opacity: 0;
	pointer-events: none;
}
input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-inner-spin-button {
	opacity: 1;
	pointer-events: auto;
}
keygen, select {
	border-radius: 5px;
}
keygen::-webkit-keygen-select {
	margin: 0px;
}
textarea {
	-webkit-appearance: textarea;
	background-color: white;
	border: 1px solid;
	-webkit-rtl-ordering: logical;
	-webkit-user-select: text;
	flex-direction: column;
	resize: auto;
	cursor: auto;
	padding: 2px;
	white-space: pre-wrap;
	word-wrap: break-word;
}
::-webkit-input-placeholder {
	-webkit-text-security: none;
	color: darkGray;
	pointer-events: none !important;
}
input::-webkit-input-placeholder {
	white-space: pre;
	word-wrap: normal;
	overflow: hidden;
	-webkit-user-modify: read-only !important;
}
input[type="password" i] {
	-webkit-text-security: disc !important;
}
input[type="hidden" i], input[type="image" i], input[type="file" i] {
	-webkit-appearance: initial;
	padding: initial;
	background-color: initial;
	border: initial;
}
input[type="file" i] {
	align-items: baseline;
	color: inherit;
	text-align: start !important;
}
input:-webkit-autofill, textarea:-webkit-autofill, select:-webkit-autofill {
	background-color: #FAFFBD !important;
	background-image:none !important;
	color: #000000 !important;
}
input[type="radio" i], input[type="checkbox" i] {
	margin: 3px 0.5ex;
	padding: initial;
	background-color: initial;
	border: initial;
}
input[type="button" i], input[type="submit" i], input[type="reset" i] {
	-webkit-appearance: push-button;
	-webkit-user-select: none;
	white-space: pre
}
input[type="file" i]::-webkit-file-upload-button {
	-webkit-appearance: push-button;
	-webkit-user-modify: read-only !important;
	white-space: nowrap;
	margin: 0;
	font-size: inherit;
}
input[type="button" i], input[type="submit" i], input[type="reset" i], input[type="file" i]::-webkit-file-upload-button, button {
	align-items: flex-start;
	text-align: center;
	cursor: default;
	color: ButtonText;
	padding: 2px 6px 3px 6px;
	border: 2px outset ButtonFace;
	background-color: ButtonFace;
	box-sizing: border-box
}
input[type="range" i] {
	-webkit-appearance: slider-horizontal;
	padding: initial;
	border: initial;
	margin: 2px;
	color: #909090;
}
input[type="range" i]::-webkit-slider-container, input[type="range" i]::-webkit-media-slider-container {
	flex: 1;
	min-width: 0;
	box-sizing: border-box;
	-webkit-user-modify: read-only !important;
	display: flex;
}
input[type="range" i]::-webkit-slider-runnable-track {
	flex: 1;
	min-width: 0;
	-webkit-align-self: center;
	box-sizing: border-box;
	-webkit-user-modify: read-only !important;
	display: block;
}
input[type="range" i]::-webkit-slider-thumb, input[type="range" i]::-webkit-media-slider-thumb {
	-webkit-appearance: sliderthumb-horizontal;
	box-sizing: border-box;
	-webkit-user-modify: read-only !important;
	display: block;
}
input[type="button" i]:disabled, input[type="submit" i]:disabled, input[type="reset" i]:disabled,
input[type="file" i]:disabled::-webkit-file-upload-button, button:disabled,
select:disabled, keygen:disabled, optgroup:disabled, option:disabled,
select[disabled]>option {
	color: GrayText
}
input[type="button" i]:active, input[type="submit" i]:active, input[type="reset" i]:active, input[type="file" i]:active::-webkit-file-upload-button, button:active {
	border-style: inset
}
input[type="button" i]:active:disabled, input[type="submit" i]:active:disabled, input[type="reset" i]:active:disabled, input[type="file" i]:active:disabled::-webkit-file-upload-button, button:active:disabled {
	border-style: outset
}
option:-internal-spatial-navigation-focus {
	outline: black dashed 1px;
	outline-offset: -1px;
}
datalist {
	display: none
}
area {
	display: inline;
	cursor: pointer;
}
param {
	display: none
}
input[type="checkbox" i] {
	-webkit-appearance: checkbox;
	box-sizing: border-box;
}
input[type="radio" i] {
	-webkit-appearance: radio;
	box-sizing: border-box;
}
input[type="color" i] {
	-webkit-appearance: square-button;
	width: 44px;
	height: 23px;
	background-color: ButtonFace;
	/* Same as native_theme_base. */
	border: 1px #a9a9a9 solid;
	padding: 1px 2px;
}
input[type="color" i]::-webkit-color-swatch-wrapper {
	display:flex;
	padding: 4px 2px;
	box-sizing: border-box;
	-webkit-user-modify: read-only !important;
	width: 100%;
	height: 100%
}
input[type="color" i]::-webkit-color-swatch {
	background-color: #000000;
	border: 1px solid #777777;
	flex: 1;
	min-width: 0;
	-webkit-user-modify: read-only !important;
}
input[type="color" i][list] {
	-webkit-appearance: menulist;
	width: 88px;
	height: 23px
}
input[type="color" i][list]::-webkit-color-swatch-wrapper {
	padding-left: 8px;
	padding-right: 24px;
}
input[type="color" i][list]::-webkit-color-swatch {
	border-color: #000000;
}
input::-webkit-calendar-picker-indicator {
	display: inline-block;
	width: 0.66em;
	height: 0.66em;
	padding: 0.17em 0.34em;
	-webkit-user-modify: read-only !important;
	opacity: 0;
	pointer-events: none;
}
input::-webkit-calendar-picker-indicator:hover {
	background-color: #eee;
}
input:enabled:read-write:-webkit-any(:focus,:hover)::-webkit-calendar-picker-indicator,
input::-webkit-calendar-picker-indicator:focus {
	opacity: 1;
	pointer-events: auto;
}
input[type="date" i]:disabled::-webkit-clear-button,
input[type="date" i]:disabled::-webkit-inner-spin-button,
input[type="datetime-local" i]:disabled::-webkit-clear-button,
input[type="datetime-local" i]:disabled::-webkit-inner-spin-button,
input[type="month" i]:disabled::-webkit-clear-button,
input[type="month" i]:disabled::-webkit-inner-spin-button,
input[type="week" i]:disabled::-webkit-clear-button,
input[type="week" i]:disabled::-webkit-inner-spin-button,
input:disabled::-webkit-calendar-picker-indicator,
input[type="date" i][readonly]::-webkit-clear-button,
input[type="date" i][readonly]::-webkit-inner-spin-button,
input[type="datetime-local" i][readonly]::-webkit-clear-button,
input[type="datetime-local" i][readonly]::-webkit-inner-spin-button,
input[type="month" i][readonly]::-webkit-clear-button,
input[type="month" i][readonly]::-webkit-inner-spin-button,
input[type="week" i][readonly]::-webkit-clear-button,
input[type="week" i][readonly]::-webkit-inner-spin-button,
input[readonly]::-webkit-calendar-picker-indicator {
	visibility: hidden;
}
select {
	-webkit-appearance: menulist;
	box-sizing: border-box;
	align-items: center;
	border: 1px solid;
	white-space: pre;
	-webkit-rtl-ordering: logical;
	color: black;
	background-color: white;
	cursor: default;
}
select:not(:-internal-list-box) {
	overflow: visible !important;
}
select:-internal-list-box {
	-webkit-appearance: listbox;
	align-items: flex-start;
	border: 1px inset gray;
	border-radius: initial;
	overflow-x: hidden;
	overflow-y: scroll;
	vertical-align: text-bottom;
	-webkit-user-select: none;
	white-space: nowrap;
}
optgroup {
	font-weight: bolder;
	display: block;
}
option {
	font-weight: normal;
	display: block;
	padding: 0 2px 1px 2px;
	white-space: pre;
	min-height: 1.2em;
}
select:-internal-list-box optgroup option:before {
	content: "\u00a0\u00a0\u00a0\u00a0";;
}
select:-internal-list-box option,
select:-internal-list-box optgroup {
	line-height: initial !important;
}
select:-internal-list-box:focus option:checked {
	background-color: -internal-active-list-box-selection !important;
	color: -internal-active-list-box-selection-text !important;
}
select:-internal-list-box option:checked {
	background-color: -internal-inactive-list-box-selection !important;
	color: -internal-inactive-list-box-selection-text !important;
}
select:-internal-list-box:disabled option:checked,
select:-internal-list-box option:checked:disabled {
	color: gray !important;
}
select:-internal-list-box hr {
	border-style: none;
}
output {
	display: inline;
}
/* meter */
meter {
	-webkit-appearance: meter;
	box-sizing: border-box;
	display: inline-block;
	height: 1em;
	width: 5em;
	vertical-align: -0.2em;
}
meter::-webkit-meter-inner-element {
	-webkit-appearance: inherit;
	box-sizing: inherit;
	-webkit-user-modify: read-only !important;
	height: 100%;
	width: 100%;
}
meter::-webkit-meter-bar {
	background: linear-gradient(to bottom, #ddd, #eee 20%, #ccc 45%, #ccc 55%, #ddd);
	height: 100%;
	width: 100%;
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
meter::-webkit-meter-optimum-value {
	background: linear-gradient(to bottom, #ad7, #cea 20%, #7a3 45%, #7a3 55%, #ad7);
	height: 100%;
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
meter::-webkit-meter-suboptimum-value {
	background: linear-gradient(to bottom, #fe7, #ffc 20%, #db3 45%, #db3 55%, #fe7);
	height: 100%;
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
meter::-webkit-meter-even-less-good-value {
	background: linear-gradient(to bottom, #f77, #fcc 20%, #d44 45%, #d44 55%, #f77);
	height: 100%;
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
/* progress */
progress {
	-webkit-appearance: progress-bar;
	box-sizing: border-box;
	display: inline-block;
	height: 1em;
	width: 10em;
	vertical-align: -0.2em;
}
progress::-webkit-progress-inner-element {
	-webkit-appearance: inherit;
	box-sizing: inherit;
	-webkit-user-modify: read-only;
	height: 100%;
	width: 100%;
}
progress::-webkit-progress-bar {
	background-color: gray;
	height: 100%;
	width: 100%;
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
progress::-webkit-progress-value {
	background-color: green;
	height: 100%;
	width: 50%; /* should be removed later */
	-webkit-user-modify: read-only !important;
	box-sizing: border-box;
}
/* inline elements */
u, ins {
	text-decoration: underline
}
strong, b {
	font-weight: bold
}
i, cite, em, var, address, dfn {
	font-style: italic
}
tt, code, kbd, samp {
	font-family: monospace
}
pre, xmp, plaintext, listing {
	display: block;
	font-family: monospace;
	white-space: pre;
	margin: 1__qem 0
}
mark {
	background-color: yellow;
	color: black
}
big {
	font-size: larger
}
small {
	font-size: smaller
}
s, strike, del {
	text-decoration: line-through
}
sub {
	vertical-align: sub;
	font-size: smaller
}
sup {
	vertical-align: super;
	font-size: smaller
}
nobr {
	white-space: nowrap
}
/* states */
:focus {
	outline: auto 5px -webkit-focus-ring-color
}
/* Read-only text fields do not show a focus ring but do still receive focus */
html:focus, body:focus, input[readonly]:focus {
	outline: none
}
embed:focus, iframe:focus, object:focus {
	outline: none
}

input:focus, textarea:focus, keygen:focus, select:focus {
	outline-offset: -2px
}
input[type="button" i]:focus,
input[type="checkbox" i]:focus,
input[type="file" i]:focus,
input[type="hidden" i]:focus,
input[type="image" i]:focus,
input[type="radio" i]:focus,
input[type="reset" i]:focus,
input[type="search" i]:focus,
input[type="submit" i]:focus,
input[type="file" i]:focus::-webkit-file-upload-button {
	outline-offset: 0
}

a:-webkit-any-link {
	color: -webkit-link;
	text-decoration: underline;
	cursor: auto;
}
a:-webkit-any-link:active {
	color: -webkit-activelink
}
/* HTML5 ruby elements */
ruby, rt {
	text-indent: 0; /* blocks used for ruby rendering should not trigger this */
}
rt {
	line-height: normal;
	-webkit-text-emphasis: none;
}
ruby > rt {
	display: block;
	font-size: 50%;
	text-align: start;
}
ruby > rp {
	display: none;
}
/* other elements */
noframes {
	display: none
}
frameset, frame {
	display: block
}
frameset {
	border-color: inherit
}
iframe {
	border: 2px inset
}
details {
	display: block
}
summary {
	display: block
}
summary::-webkit-details-marker {
	display: inline-block;
	width: 0.66em;
	height: 0.66em;
	-webkit-margin-end: 0.4em;
}
template {
	display: none
}
bdi, output {
	unicode-bidi: -webkit-isolate;
}
bdo {
	unicode-bidi: bidi-override;
}
textarea[dir=auto i] {
	unicode-bidi: -webkit-plaintext;
}
dialog:not([open]) {
	display: none
}
dialog {
	position: absolute;
	left: 0;
	right: 0;
	width: -webkit-fit-content;
	height: -webkit-fit-content;
	margin: auto;
	border: solid;
	padding: 1em;
	background: white;
	color: black
}
dialog::backdrop {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	background: rgba(0,0,0,0.1)
}
/* page */
@page {
	/* FIXME: Define the right default values for page properties. */
	size: auto;
	margin: auto;
	padding: 0px;
	border-width: 0px;
}
/* Disable multicol in printing, since it's not implemented properly. See crbug.com/99358 */
@media print {
	* { -webkit-columns: auto !important; }
}
/* noscript is handled internally, as it depends on settings. */

		`;
}

// Register FloatingWindow
customElements.define("floating-window", FloatingWindow);
