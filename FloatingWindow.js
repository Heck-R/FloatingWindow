//TODO: clean up
//TODO: Fix size modes
//TODO: Fix grab position being on window when being restored from special style
//TODO: Move window back to interact-able part of the window to avoid it being lost (maybe a navigation button amount, so it is possible to grab or maximize)
//TODO: Fix top bar sizing  (currently based on the iframe size, but should be the original page size, as that is the one representing the user working environment)
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
 * - Custom style
 *   - Ignores page css for consistent look
 *   - Custom styles can be applied using the 'contentStyle' property
 *   - Prebuilt styles can be found in the 'preBuiltStyles' static property
 *     - Those with "Extension" in their name should be appended to very generic styles, such as browsers' default styles
 *   - The whole window can also be styled using the 'windowStyle' property
 * - Content can be added to the element referenced by the 'content' property
 */
class FloatingWindow extends HTMLElement {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// Overrides

	connectedCallback() {
		this.style.all = "unset";
		this.style.position = "fixed";
		this.style.top = "0";
		this.style.left = "0";
		this.style.width = "50%";
		this.style.height = "50%";

		let iframe = document.createElement("iframe");
		iframe.style.all = "unset";
		iframe.style.position = "absolute";
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		this.appendChild(iframe);

		// Default values
		this.sizerThickness = "5px";
		this.windowBorderRadius = "calc(5px)";
		this.navigationBarHeight = "calc(10px + 1.5vh)";
		this.minWindowWidth = "calc(90px + 13.5vh)"; // 9 * navigationBarHeight - Why? Because that ratio looks nice
		this.minFixedButtonSize = "calc(45px + 6.75vh)"; // 3/6 * minWindowWidth - Why? Because there are 6 button slots in the nav bar and this spans 3 like this

		//TODO: Check and consider using attributeChangedCallback
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

		// // Shadow root for better separation from the page
		// let shadowRoot = this.attachShadow({ mode: "open" });

		//TODO: Fix load and onload not working on chrome
		iframe.addEventListener("load", () => {
			if (!iframe.contentDocument || !iframe.contentDocument.body) {
				throw "iframe is shit";
			}
			iframe.contentDocument.body.style.position = "absolute";
			iframe.contentDocument.body.style.width = "100%";
			iframe.contentDocument.body.style.height = "100%";
			iframe.contentDocument.body.style.zIndex = "0";
			iframe.contentDocument.body.style.margin = "0";

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
			navigationBar.addEventListener("mouseup", () => {
				delete this.dataset.allowRestoration;
			});

			this.boundMoveWindow = this.moveWindow.bind(this);
			this.boundReleaseWindow = this.releaseWindow.bind(this);

			// Size panel
			let positionPanel = document.createElement("div");
			positionPanel.id = "positionPanel";

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
			let content = document.createElement("div");
			content.id = "content";

			// Assemble
			iframe.contentDocument.head.appendChild(windowStyle);
			iframe.contentDocument.head.appendChild(contentStyle);
			iframe.contentDocument.body.appendChild(floatingWindow);
			/**/ floatingWindow.appendChild(navigationBar);
			/**/ /**/ navigationBar.appendChild(positionPanel);
			/**/ /**/ /**/ positionPanel.appendChild(movableSlot);
			/**/ /**/ /**/ positionPanel.appendChild(sizeTypeSlot);
			/**/ /**/ /**/ /**/ sizeTypeSlot.appendChild(sizeTypeButtonPanel);
			/**/ /**/ /**/ positionPanel.appendChild(minimizeSlot);
			/**/ /**/ /**/ positionPanel.appendChild(fixedSlot);
			/**/ /**/ /**/ /**/ fixedSlot.appendChild(fixedButtonGrid);
			/**/ /**/ /**/ positionPanel.appendChild(maximizeSlot);
			/**/ /**/ /**/ positionPanel.appendChild(closeSlot);
			/**/ floatingWindow.appendChild(content);
			iframe.contentDocument.body.appendChild(windowSizerContainer);
			/**/ windowSizerContainer.appendChild(sizerSelectionBlockerOverlay);
			/**/ windowSizerContainer.appendChild(sizerTop);
			/**/ windowSizerContainer.appendChild(sizerBottom);
			/**/ windowSizerContainer.appendChild(sizerLeft);
			/**/ windowSizerContainer.appendChild(sizerRight);
			/**/ windowSizerContainer.appendChild(sizerTopLeft);
			/**/ windowSizerContainer.appendChild(sizerTopRight);
			/**/ windowSizerContainer.appendChild(sizerBottomLeft);
			/**/ windowSizerContainer.appendChild(sizerBottomRight);

			// Window listeners
			this.addEventListener("mousedown", this.setSwitchablesOff.bind(this));

			// Window resize handling
			window.addEventListener("resize", () => {
				this.fixLessThanMinSize();
			});

			// Accessible parts
			this.content = content;
			this.contentStyle = contentStyle;
			this.windowStyle = windowStyle;
			this.iframe = iframe;

			// return;
			// Observed variables
			this.dataset.sizeType = "Fixed";
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

			this.initContent(content);
		});
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// initialization

	// prettier-ignore
	constructor() {
		super();
		this.initContent = () => {}
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
		let switchableElements = this.iframe.contentDocument.body.querySelectorAll(".switchable");
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

		// Fix and change size to appropriate type
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

		// Actively refreshed movement vector sum
		// The iframe is moving based on the mouse, and thus changing the underlying coordinate system in which the mouse's position is measured gets falsified
		// To avoid jittering caused by this, the offset the mouse just moved in the current event is added to the last known position instead if being calculated from the mousedown and offset only
		this.dataset.mouseMovementSumX = "0";
		this.dataset.mouseMovementSumY = "0";

		// Apply invisible overlay to block unwanted selection on the page
		//TODO: Is this still needed?
		this.iframe.contentDocument.getElementById("sizerSelectionBlockerOverlay").classList.remove("hidden");

		// Add move and release listeners
		// Adding the event to the document somehow magically triggers even when going outside of the iframe, going out to the browser toolbar or outside the browser window
		this.iframe.contentDocument.addEventListener("mousemove", this.boundMoveWindow);
		this.iframe.contentDocument.addEventListener("mouseup", this.boundReleaseWindow);
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

		if (this.dataset.sizeType != "Auto") {
			// Since in case of a "movement" only the size is adjusted, and "Auto" mode has no size to adjust, this is not applicable in that case
			// Manual handling of the window is not a special state from which restoration is desired, so the state is deleted after restored
			const restored = this.restorePosition(true, false, true);
			if (restored) {
				// When the window is restored to a previous state, the "original size" saved in grabWindow() has to be adjusted to it

				// Css calc() would be nice, but "/" only works if the divisor is not a length unit, so at least part of the calculation cannot be solved with calc()
				const windowBoundingRect = this.getBoundingClientRect();
				const restoredWindowRelativeLeft = FloatingWindow.convertStyleCalcSizeToPx(this.dataset.mouseDownLeft, "w") - parseInt(this.dataset.mouseDownX);
				const restoredWindowRelativeLeftRatio = restoredWindowRelativeLeft / FloatingWindow.convertStyleCalcSizeToPx(this.dataset.mouseDownWidth, "w");
				const windowRelativePosition = restoredWindowRelativeLeftRatio * windowBoundingRect.width;
				this.dataset.mouseDownLeft = `calc(${this.dataset.mouseDownX}px + ${windowRelativePosition}px)`;

				this.dataset.mouseDownWidth = this.style.width;
				this.dataset.mouseDownHeight = this.style.height;
			}
		}

		const mouseMovementComparedToGrabX = event.clientX - parseInt(this.dataset.mouseDownX);
		const mouseMovementComparedToGrabY = event.clientY - parseInt(this.dataset.mouseDownY);
		this.dataset.mouseMovementSumX = `${parseInt(this.dataset.mouseMovementSumX) + mouseMovementComparedToGrabX}`;
		this.dataset.mouseMovementSumY = `${parseInt(this.dataset.mouseMovementSumY) + mouseMovementComparedToGrabY}`;

		// Position
		//TODO: Fix positioning and min width in current combination pushing the window (top & left resizers)
		this.style.top = `calc(${this.dataset.mouseDownTop} + (${this.dataset.changeModifierTop} ${this.dataset.mouseMovementSumY}px))`;
		this.style.left = `calc(${this.dataset.mouseDownLeft} + (${this.dataset.changeModifierLeft} ${this.dataset.mouseMovementSumX}px))`;

		// Size
		//TODO: Make change modifiers to be numbers instead of magic calc string parts
		this.style.width = `calc(${this.dataset.mouseDownWidth} + (${this.dataset.changeModifierWidth} ${this.dataset.changeModifierLeft[0] != "0" ? this.dataset.mouseMovementSumX : mouseMovementComparedToGrabX}px))`;
		this.style.height = `calc(${this.dataset.mouseDownHeight} + (${this.dataset.changeModifierHeight} ${this.dataset.changeModifierTop[0] != "0" ? this.dataset.mouseMovementSumY : mouseMovementComparedToGrabY}px))`;
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
		this.iframe.contentDocument.getElementById("sizerSelectionBlockerOverlay").classList.add("hidden");

		// Remove move and release listeners
		this.iframe.contentDocument.removeEventListener("mousemove", this.boundMoveWindow);
		this.iframe.contentDocument.removeEventListener("mouseup", this.boundReleaseWindow);

		// Fix and change size to appropriate type
		this.fixLessThanMinSize();
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// General style

	/**
	 * Applies the general style on the floating window
	 */
	updateFloatingWindowStyle() {
		this.contentStyle.textContent = FloatingWindow.preBuiltStyles.darkModeExtension;
		this.windowStyle.textContent = `
			[contenteditable]:not(#content *) {
				outline: 0px solid transparent;
			}

			.hidden:not(#content *) {
				display: none!important;
			}

			#windowSizerContainer:not(#content *) {
				position: absolute;
				top: 0;
				left: 0;

				width: 100%;
				height: 100%;

				z-index: 0;
			}

			#floatingWindow:not(#content *) {
				margin: ${this.sizerThickness};
				position: absolute;
				width: calc(100% - 2*${this.sizerThickness});
				height: calc(100% - 2*${this.sizerThickness});

				font-size: 15px;

				border-radius: ${this.windowBorderRadius};
				
				z-index: 1;
			}

			#navigationBar:not(#content *) {
				display: block;

				width: 100%;
				height: ${this.navigationBarHeight};

				background-color: #444;

				border-radius: ${this.windowBorderRadius} ${this.windowBorderRadius} 0 0;

				user-select: none;
			}


			#positionPanel:not(#content *) {
				display: flex;

				height: 100%;
				width: 25%;
				min-width: ${this.minWindowWidth};

				float: right;
			}

			#positionPanel:not(#content *),
			#positionPanel > .positionSlot:last-child:not(#content *),
			#positionPanel > .positionSlot:last-child > .positionButton:not(#content *) {
				border-radius: 0 ${this.windowBorderRadius} 0 0;
			}

			.positionSlot:not(#content *) {
				height: 100%;
				width: 20%;
			}

			.positionButton:not(#content *) {
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

			.positionButton:hover:not(#content *) {
				filter: brightness(130%);
			}

			#movableButton:hover:not(#content *) {
				filter: unset;
				cursor: unset;
			}

			#sizeTypeButton:not(#content *),
			.sizeTypeButton:not(#content *) {
				background-color: #707;
			}

			#minimizeButton:not(#content *) {
				background-color: #777;
			}

			#fixedButton:not(#content *),
			.fixedButton:not(#content *) {
				background-color: #07b;
			}

			#maximizeButton:not(#content *) {
				background-color: #070;
			}

			#closeButton:not(#content *) {
				background-color: #a00;
			}

			.switchable:not(#content *) {
				position: absolute;

				min-width: ${this.minFixedButtonSize};
				min-height: ${this.minFixedButtonSize};
			}

			#sizeTypeButtonPanel:not(#content *) {
				display: grid;

				grid-template-columns: 1fr;
				grid-template-rows: 1fr 1fr 1fr;

			}

			#fixedButtonGrid:not(#content *) {
				display: grid;

				grid-template-columns: 1fr 1fr 1fr;
				grid-template-rows: 1fr 1fr 1fr;

			}


			#sizerSelectionBlockerOverlay:not(#content *) {
				position: fixed;

				top: 0;
				left: 0;

				width: 100vw;
				height: 100vh;
			}

			.sizer:not(#content *) {
				position: absolute;

				user-select: none;
				-moz-user-select: none;
				-webkit-user-select: none;
				-ms-user-select: none;
				user-drag: none;
				-webkit-user-drag: none;
			}

			.sizer:hover:not(#content *) {
				background-color: #000;
				opacity: 0.2;
			}

			.sizerTop:not(#content *),
			.sizerBottom:not(#content *) {
				left: 50%;
				transform: translate(-50%, 0);

				width: calc(100% - (2 * ${this.windowBorderRadius}));
				height: ${this.sizerThickness};

				cursor: ns-resize;
			}

			.sizerLeft:not(#content *),
			.sizerRight:not(#content *) {
				top: 50%;
				transform: translate(0, -50%);

				width: ${this.sizerThickness};
				height: calc(100% - (2 * ${this.windowBorderRadius}));

				cursor: ew-resize;
			}

			.sizerTop.sizerLeft:not(#content *),
			.sizerBottom.sizerRight:not(#content *) {
				cursor: nwse-resize;
			}

			.sizerTop.sizerRight:not(#content *),
			.sizerBottom.sizerLeft:not(#content *) {
				cursor: nesw-resize;
			}

			.sizerCorner:not(#content *) {
				width: calc(${this.windowBorderRadius} + ${this.sizerThickness});
				height: calc(${this.windowBorderRadius} + ${this.sizerThickness});

				top: unset;
				bottom: unset;
				left: unset;
				right: unset;

				transform: unset;
			}

			.sizerTop:not(#content *) {
				top: 0;
			}

			.sizerBottom:not(#content *) {
				bottom: 0;
			}

			.sizerLeft:not(#content *) {
				left: 0;
			}

			.sizerRight:not(#content *) {
				right: 0;
			}



			#content:not(#content *) {
				display: block;

				width: 100%;
				height: calc(100% - ${this.navigationBarHeight});

				overflow: auto;
			}
		`;
	}

	static preBuiltStyles = {
		darkModeExtension: `
			/* Generic */
			#content {
				background-color: #000000;
				color: #ccc;

				border-style: solid;
				border-color: #444;
				border-width: 0px 1px 1px 1px;
				box-sizing: border-box;
			}

			#content * {
				color: #ccc;
			}

			/* Separator */
			#content hr {
				display: block;
				border: 1px inset;
			}

			/* Button */
			#content button {
				background-color: #444;
				color: #eee !important;

				padding: 0.2em 0.4em 0.2em 0.4em;
				border: none;
				border-radius: 0.2em;
				box-shadow: inset 0 0 0 1px #777;

				cursor: pointer;
				user-select: none;
			}

			#content button:hover {
				background-color: #555;
			}

			#content button:active {
				background-color: #333;
				
				border: none;
				border-radius: 0.2em;
				box-shadow: inset 0 0 0 2px #777;
			}

			/* Linking */
			#content :any-link {
				cursor: pointer;
				text-decoration: underline;
			}

			#content a:link {
				color: LinkText!important;
			}

			#content a:visited {
				color: VisitedText!important;
			}

			#content a:hover,
			#content a:focus {
				text-decoration: none;
			}

			#content a:active {
				color: ActiveText!important
			}
		`,

		lightModeExtension: `
			/* Generic */
			#content {
				background-color: #fff;

				border-style: solid;
				border-color: #444;
				border-width: 0px 1px 1px 1px;
				box-sizing: border-box;
			}

			/* Button */
			#content button {
				cursor: pointer;
				user-select: none;
			}

			/* Linking */
			#content :any-link {
				cursor: pointer;
				text-decoration: underline;
			}

			#content a:link {
				color: LinkText!important;
			}

			#content a:visited {
				color: VisitedText!important;
			}

			#content a:hover, a:focus {
				text-decoration: none;
			}

			#content a:active {
				color: ActiveText!important
			}
		`,
	};
}

// Register FloatingWindow
customElements.define("floating-window", FloatingWindow);
