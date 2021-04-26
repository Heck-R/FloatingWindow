
/**
 * A floating window html element with the following capabilities:
 * - Can be dragged around by grabbing it by the title bar
 * - Can be resized by draggind the sides
 * - Can be minimized / Maxed
 * - Size modes can be applied
 *   - Auto: Resized based on content, and keeps position
 *   - Fixed: Preserves size and position
 *   - Viewport: Resizes and repositions in a way to always occupy the same relative place on the viewport
 * - Ignores page css
 * 
 * Content can be added to the FloatingWindow.content element
 */
class FloatingWindow extends HTMLElement {

	////////////////////////////////////////////////////////////////////////////////////////////////
	// Overrides

	connectedCallback() {
		// Observed variables
		if (this.dataset.sizeType == undefined){
            this.dataset.sizeType = 'Auto';
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
	// Static methods

	/**
	 * Convert a calc Object to a css calc() string
	 * 
	 * @param {Object} calcObj An Object representing a css calc(). E.g.: 
	 * ```{
	 *     px: 1,
	 *     vw: 2
	 * }```
	 * @returns {String} Css calc() string
	 */
	static calcObjToString(calcObj) {
		let calcString = '';

		for (let unit in calcObj) {
			calcString += `+ ${calcObj[unit]}${unit} `;
		}

		calcString = calcString
			.replaceAll("+ -", "- ")
			.replace(/^\+/, '')
			.trim();

		return `calc(${calcString})`;
	}

	/**
	 * Sums up same units of a css calc() string
	 * 
	 * @param {String} originalCalc 
	 * @returns {Object} Calc Object with sum of the units
	 */
	static simplifyStyleCalcSize(originalCalc) {
		let calcNoSpace = originalCalc.replaceAll(" ", "");
		let vwInstances = calcNoSpace.matchAll(/(-?[\d\.]+)vw/g);
		let vhInstances = calcNoSpace.matchAll(/(-?[\d\.]+)vh/g);
		let pxInstances = calcNoSpace.matchAll(/(-?[\d\.]+)px/g);

		let vwSum = 0;
		for(let vwInstance of vwInstances) {
			vwSum += Number(vwInstance[1]);
		}

		let vhSum = 0;
		for(let vhInstance of vhInstances) {
			vhSum += Number(vhInstance[1]);
		}

		let pxSum = 0;
		for(let pxInstance of pxInstances) {
			pxSum += Number(pxInstance[1]);
		}

		return {
			vw: vwSum,
			vh: vhSum,
			px: pxSum
		};
	}

	/**
	 * Converts a css calc() string to pixel
	 * 
	 * @param {String} originalCalc 
	 * @returns {Number} Size defined by the calc() string converted into pixels
	 */
	static convertStyleCalcSizeToPx(originalCalc) {
		let objectCalc = FloatingWindow.simplifyStyleCalcSize(originalCalc);

		let pxSum = 0;
		pxSum += window.innerWidth * objectCalc.vw / 100;
		pxSum += window.innerHeight * objectCalc.vh / 100;
		pxSum += objectCalc.px;

		return pxSum;
	}

	/**
	 * Converts a css calc() string to viewport
	 * 
	 * @param {String} originalCalc 
	 * @param {Number} vwPercentage How many percent of the `originalCalc` needs to be converted into viewport width
	 * @param {Number} vhPercentage How many percent of the `originalCalc` needs to be converted into viewport height
	 * @returns {Number} Size defined by  the calc() string converted into viewport
	 */
	static convertStyleCalcSizeToViewport(originalCalc, vwPercentage, vhPercentage) {
		let realVwPercentage;
		let realVhPercentage;

		if (isNaN(vwPercentage) && isNaN(vhPercentage))
			throw "Must define at least one convert percentage";

		if (!isNaN(vwPercentage) && isNaN(vhPercentage)){
			realVwPercentage = Number(vwPercentage);
			realVhPercentage = 100 - realVwPercentage;
		} else if (isNaN(vwPercentage) && !isNaN(vhPercentage)){
			realVhPercentage = Number(vhPercentage);
			realVwPercentage = 100 - realVhPercentage;
		} else {
			realVwPercentage = Number(vwPercentage);
			realVhPercentage = Number(vhPercentage);
		}

		let objectCalc = FloatingWindow.simplifyStyleCalcSize(originalCalc);

		let vwSum = objectCalc.vw + (realVwPercentage * objectCalc.px / window.innerWidth);
		let vhSum = objectCalc.vh + (realVhPercentage * objectCalc.px / window.innerHeight);

		return {
			vw: vwSum,
			vh: vhSum
		};
	}

	/**
	 * Multiply a css calc() in a way it stays handleable later on
	 * 
	 * @param {String} originalCalc 
	 * @param {Number} multiplier 
	 * @returns {Object} Calc Object with the multiplied unit values
	 */
	static multiplyStyleCalcSize(originalCalc, multiplier) {
		let objectCalc = FloatingWindow.simplifyStyleCalcSize(originalCalc);

		let vwSum = objectCalc.vw * multiplier;
		let vhSum = objectCalc.vh * multiplier;
		let pxSum = objectCalc.px * multiplier;

		return {
			vw: vwSum,
			vh: vhSum,
			px: pxSum
		};
	}

	/**
	 * Compares the represented sizes of two css calc() strings
	 * 
	 * @param {"min"|"max"} minMax Defines whether or not to check for the first parameter being greater or less then the second
	 * @param {String} calcSize1 
	 * @param {String} calcSize2 
	 * @returns {Boolean} Whether or not the first calc() is strictly greater / less (based on the `minMax` param) than the second calc()
	 */
	static calcMinMax(minMax, calcSize1, calcSize2) {
		if (!["min", "max"].includes(minMax)) {
			throw "The minMax parameter's value must be 'min' or 'max'";
		}

		let pxSize1 = FloatingWindow.convertStyleCalcSizeToPx(calcSize1);
		let pxSize2 = FloatingWindow.convertStyleCalcSizeToPx(calcSize2);

		if (pxSize1 == pxSize2)
			return false;

		let pxSize1IsMax = pxSize1 > pxSize2;
		let pxSize1IsMinMax = minMax == 'min' ? !pxSize1IsMax : pxSize1IsMax;

		return pxSize1IsMinMax;
	}

	static switchElementVisibility(element, state) {
		if (state === 'on')
			element.classList.remove('hidden');
		else if (state === 'off')
			element.classList.add('hidden');
		else
			element.classList.toggle('hidden');
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// Position & size management

	/**
	 * Handles basic window positioning values based on `this.dataset.sizeType`
	 */
	onFloatingDataChange_sizeType() {
		// Must fixate the size because of 'Auto' mode
		this.fixateImplicitSize();

		switch(this.dataset.sizeType) {
			case 'Viewport':
				this.style.top = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(this.style.top, 0, 100));
				this.style.left = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(this.style.left, 100, 0));
				this.style.width = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(this.style.width, 100, 0));
				this.style.height = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(this.style.height, 0, 100));
				break;
			case 'Fixed':
				this.style.top = FloatingWindow.convertStyleCalcSizeToPx(this.style.top) + 'px';
				this.style.left = FloatingWindow.convertStyleCalcSizeToPx(this.style.left) + 'px';
				this.style.width = FloatingWindow.convertStyleCalcSizeToPx(this.style.width) + 'px';
				this.style.height = FloatingWindow.convertStyleCalcSizeToPx(this.style.height) + 'px';
				break;
			case 'Auto':
				this.style.top = FloatingWindow.convertStyleCalcSizeToPx(this.style.top) + 'px';
				this.style.left = FloatingWindow.convertStyleCalcSizeToPx(this.style.left) + 'px';
				this.style.width = '';
				this.style.height = '';
				break;
			default:
				throw `Cannot set size type to ${sizeType}`;
		}
	}

	/**
	 * Collapses all expandable elements
	 * 
	 * @param {Element} exceptionalElementContainer Any switchable in this container is not collapsed
	 */
	setSwitchablesOff(exceptionalElementContainer) {
		let switchableElements = this.shadowRoot.querySelectorAll('.switchable');
		Array.prototype.forEach.call(switchableElements, (switchableElement) => {
			if (switchableElement.parentElement !== exceptionalElementContainer)
				FloatingWindow.switchElementVisibility(switchableElement, 'off');
		});
	}

	/**
	 * Sets the window's `this.style`'s sizes to the currect size in pixel
	 */
	fixateImplicitSize() {
		//The most precise way to get size
		let size = this.getBoundingClientRect();

		//Round up to px prematurely in order to avoid rounding errors later on
		this.style.width = size.width + 'px';
		this.style.height = size.height + 'px';
	}

	/**
	 * Sets the size to the minimum when it is set to smaller (in order to avoid resizing problems later on)
	 */
	fixLessThatMinSize() {
		let atLeastMinWidth = FloatingWindow.calcMinMax('max', this.style.width, this.style["min-width"]) ? this.style.width : this.style["min-width"];
		let atLeastMinHeight = FloatingWindow.calcMinMax('max', this.style.height, this.style["min-height"]) ? this.style.height : this.style["min-height"];

		this.style.width = `${atLeastMinWidth}px`;
		this.style.height = `${atLeastMinHeight}px`;

		this.onFloatingDataChange_sizeType();
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
			width: '',
			height: '',

			'min-width': this.minWindowWidth,
			'min-height': this.navigationBarHeight,

			top: '0',
			left: '0'
		};

		let partiallyInheritedCssText = '';
		for (let styleKey in inheritableStyleAttributes) {
			let valueToStartWith = this.style[styleKey] === '' ? inheritableStyleAttributes[styleKey] : this.style[styleKey];
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
	 * - Set used size unit to pixel
	 * - Set position and size
	 */
	applyFixedStyle(positionInViewport = {x:0, y:0}, anchorInWindowPercent = {x:0, y:0}) {
		this.applyBasicFloatingStyle();

		let size = this.getBoundingClientRect();
		let anchorCorrection = {
			x: (size.width * -anchorInWindowPercent.x/100) + 'px',
			y: (size.height * -anchorInWindowPercent.y/100) + 'px'
		};

		// Change to viewport based on position mode
		if (this.dataset.sizeType == "Viewport") {
			anchorCorrection.x = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(anchorCorrection.x, 100, 0));
			anchorCorrection.y = FloatingWindow.calcObjToString(FloatingWindow.convertStyleCalcSizeToViewport(anchorCorrection.y, 0, 100));
		}

		let position = {
			x: FloatingWindow.calcObjToString(FloatingWindow.simplifyStyleCalcSize(`(${positionInViewport.x}vw ${anchorCorrection.x}`)),
			y: FloatingWindow.calcObjToString(FloatingWindow.simplifyStyleCalcSize(`(${positionInViewport.y}vh ${anchorCorrection.y}`))
		};

		this.style.cssText += `
			top: ${position.y};
			left: ${position.x};
		`;
	}

	/**
	 * Applies basic floating style.
	 * - Set BasicFloatingStyle
	 * - Set used size unit to viewport
	 * - Set position to top left
	 * - Set size to 100% of viewport
	 */
	applyMaximizedStyle() {
		this.applyBasicFloatingStyle();

		this.dataset.sizeType = 'Viewport';

		this.style.cssText += `
			top: 0;
			left: 0;

			width: 100vw;
			height: 100vh;
		`;
	}

	/**
	 * Applies basic floating style.
	 * - Set BasicFloatingStyle
	 * - Set used size unit to pixel
	 * - Set position and size to minimum
	 */
	applyMinimizedStyle() {
		this.applyBasicFloatingStyle();

		this.dataset.sizeType = 'Fixed';

		this.style.cssText += `
			top: 0;
			left: 0;

			width: 0;
			height: 0;
		`;

		this.fixLessThatMinSize();
	}

	/**
	 * Closes dloating window by removing it from the parent element
	 */
	closeWindow() {
		this.parentElement.removeChild(this);
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// Manual movement & resize handling

	/**
	 * This function initalizes the window movement (see `moveWindow()`) from a mouse event, by setting modifiers which will later be used along with the mouse's movement to move and resize the window
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
		let modifiers = ['top', 'left', 'width', 'height'];
		for (let modifier of modifiers) {
			if (changeModifiers[modifier] == undefined)
				changeModifiers[modifier] = '0*';
		}

		if (this.dataset.sizeType == 'Auto' && (changeModifiers.width != '0*' || changeModifiers.height != '0*')) {
			this.dataset.sizeType = 'Fixed';

			// Fixate size prematurely since the observer will run after this function
			this.fixateImplicitSize();
		}

		// Store inital positioning values
		this.dataset.mouseDownX = event.clientX;
		this.dataset.mouseDownY = event.clientY;

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
		this.shadowRoot.getElementById('sizerSelectionBlockerOverlay').classList.remove('hidden');

		// Add move and release listeners
		document.body.addEventListener('mousemove', this.boundMoveWindow);
		document.body.addEventListener('mouseup', this.boundReleaseWindow);
	}

	/**
	 * Move / resize the floating window according to the inital setup (see grabWindow())
	 * 
	 * @param {MouseEvent} event Event caused by dragging the window with the mouse
	 */
	moveWindow(event) {
		// Position
		this.style.top = `calc(${this.dataset.mouseDownTop} + (${this.dataset.changeModifierTop} ${event.clientY - this.dataset.mouseDownY}px))`;
		this.style.left = `calc(${this.dataset.mouseDownLeft} + (${this.dataset.changeModifierLeft} ${event.clientX - this.dataset.mouseDownX}px))`;

		// Size
		this.style.width = `calc(${this.dataset.mouseDownWidth} + (${this.dataset.changeModifierWidth} ${event.clientX - this.dataset.mouseDownX}px))`;
		this.style.height = `calc(${this.dataset.mouseDownHeight} + (${this.dataset.changeModifierHeight} ${event.clientY - this.dataset.mouseDownY}px))`;

		if (this.dataset.changeModifierHeight == '0*' && this.dataset.changeModifierWidth == '0*')
			return;

		// Restrict minimum window size
		let heightDecreased = FloatingWindow.calcMinMax('min', this.dataset.mouseDownTop, this.style.top);
		let widthDecreased = FloatingWindow.calcMinMax('min', this.dataset.mouseDownLeft, this.style.left);

		if (!(heightDecreased || widthDecreased))
			return;

		let minSizePx = {
			width: FloatingWindow.convertStyleCalcSizeToPx(this.style["min-width"]),
			height: FloatingWindow.convertStyleCalcSizeToPx(this.style["min-height"])
		};

		let restrictedPos = {
			top: `calc(${this.dataset.mouseDownTop} + ${this.dataset.mouseDownHeight} - ${minSizePx.height}px)`,
			left: `calc(${this.dataset.mouseDownLeft} + ${this.dataset.mouseDownWidth} - ${minSizePx.width}px)`
		};

		if (this.dataset.changeModifierHeight != '0*' && heightDecreased)
			this.style.top = FloatingWindow.calcMinMax('max', this.style.height, this.style["min-height"]) ? this.style.top : restrictedPos.top;
		if (this.dataset.changeModifierWidth != '0*' && widthDecreased)
			this.style.left = FloatingWindow.calcMinMax('max', this.style.width, this.style["min-width"]) ? this.style.left : restrictedPos.left;
	}

	/**
	 * Finalizes the repositioning / resizing of the window (see moveWindow())
	 */
	releaseWindow(event) {
		// Delete inital positioning values
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
		this.shadowRoot.getElementById('sizerSelectionBlockerOverlay').classList.add('hidden');

		// Remove move and release listeners
		document.body.removeEventListener('mousemove', this.boundMoveWindow);
		document.body.removeEventListener('mouseup', this.boundReleaseWindow);

		// Change size to appropriate type
		this.onFloatingDataChange_sizeType();

		// Fix size
		this.fixLessThatMinSize();
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// General style

	/**
	 * Applies the general style on the floating window
	 */
	updateFloatingWindowStyle() {

		// Get styles
		let windowStyle = this.shadowRoot.getElementById('windowStyle');
		let contentStyle = this.shadowRoot.getElementById('contentStyle');

		windowStyle.textContent = `
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

				background-color: #000000;
				color: #ccc;

				overflow: auto;
			}
		`;
		
		contentStyle.textContent = `
			/* Generic */
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
				border-radius: 0.2em;
			}
			
			button:hover {
				background-color: #555;
			}

			button:active {
				background-color: #333;
			}

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
		`;
	}

	////////////////////////////////////////////////////////////////////////////////////////////////
	// Initalization

	constructor() {
		super();

		// Default values
		this.sizerThickness = '5px';
		this.windowBorderRadius = 'calc(4px + 0.8vh)';
		this.navigationBarHeight = 'calc(10px + 1.5vh)';
		this.minWindowWidth = FloatingWindow.calcObjToString(FloatingWindow.multiplyStyleCalcSize(this.navigationBarHeight, 9));
		this.minFixedButtonSize = FloatingWindow.calcObjToString(FloatingWindow.multiplyStyleCalcSize(this.minWindowWidth, 3/6));

		// Create dataset variable observers (initiated in connectedCallback())
		let observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type == "attributes") {
					let datasetVariableName = mutation.attributeName
						.replace(/^data-/, '')
						.replace(/([-][a-z])/g, (group) => group.toUpperCase().replace('-', ''));
					this[`onFloatingDataChange_${datasetVariableName}`]();
				}
			});
		});

		observer.observe(this, {
			attributes: true,
			attributeFilter: ["data-size-type"]
		});

		// Shadow root
		let shadowRoot = this.attachShadow({mode: 'open'});


		// Window sizer panel
		let windowSizerContainer = document.createElement('div');
		windowSizerContainer.id = 'windowSizerContainer';


		// Sizer - Accidental Selection Blocker
		let sizerSelectionBlockerOverlay = document.createElement('div');
		sizerSelectionBlockerOverlay.id = 'sizerSelectionBlockerOverlay';
		sizerSelectionBlockerOverlay.classList.add('hidden');

		// Sizer - Top
		let sizerTop = document.createElement('div');
		sizerTop.classList.add('sizer', 'sizerTop');
		sizerTop.addEventListener('mousedown', this.grabWindow.bind(this, {top: '1*', height: '-1*'}));

		// Sizer - Bottom
		let sizerBottom = document.createElement('div');
		sizerBottom.classList.add('sizer', 'sizerBottom');
		sizerBottom.addEventListener('mousedown', this.grabWindow.bind(this, {height: '1*'}));

		// Sizer - Left
		let sizerLeft = document.createElement('div');
		sizerLeft.classList.add('sizer', 'sizerLeft');
		sizerLeft.addEventListener('mousedown', this.grabWindow.bind(this, {left: '1*', width: '-1*'}));

		// Sizer - Right
		let sizerRight = document.createElement('div');
		sizerRight.classList.add('sizer', 'sizerRight');
		sizerRight.addEventListener('mousedown', this.grabWindow.bind(this, {width: '1*'}));

		// Sizer - TopLeft
		let sizerTopLeft = document.createElement('div');
		sizerTopLeft.classList.add('sizer', 'sizerCorner', 'sizerTop', 'sizerLeft');
		sizerTopLeft.addEventListener('mousedown', this.grabWindow.bind(this, {top: '1*', left: '1*', width: '-1*', height: '-1*'}));

		// Sizer - TopRight
		let sizerTopRight = document.createElement('div');
		sizerTopRight.classList.add('sizer', 'sizerCorner', 'sizerTop', 'sizerRight');
		sizerTopRight.addEventListener('mousedown', this.grabWindow.bind(this, {top: '1*', width: '1*', height: '-1*'}));

		// Sizer - BottomLeft
		let sizerBottomLeft = document.createElement('div');
		sizerBottomLeft.classList.add('sizer', 'sizerCorner', 'sizerBottom', 'sizerLeft');
		sizerBottomLeft.addEventListener('mousedown', this.grabWindow.bind(this, {left: '1*', width: '-1*', height: '1*'}));

		// Sizer - BottomRight
		let sizerBottomRight = document.createElement('div');
		sizerBottomRight.classList.add('sizer', 'sizerCorner', 'sizerBottom', 'sizerRight');
		sizerBottomRight.addEventListener('mousedown', this.grabWindow.bind(this, {width: '1*', height: '1*'}));


		// Floating window element
		let floatingWindow = document.createElement('div');
		floatingWindow.id = 'floatingWindow';


		// Styles
		let contentStyle = document.createElement('style');
		contentStyle.id = 'contentStyle';
		contentStyle.setAttribute('scoped', '');

		let windowStyle = document.createElement('style');
		windowStyle.id = 'windowStyle';
		windowStyle.setAttribute('scoped', '');


		// Navbar
		let navigationBar = document.createElement('div');
		navigationBar.id = 'navigationBar';
		navigationBar.addEventListener('mousedown', this.grabWindow.bind(this, {top: '1*', left: '1*'}));
		navigationBar.addEventListener('dblclick', this.applyMaximizedStyle.bind(this));

		this.boundMoveWindow = this.moveWindow.bind(this);
		this.boundReleaseWindow = this.releaseWindow.bind(this);


		// Size panel
		let positionPanel = document.createElement('div');
		positionPanel.id = 'positionPanel';

		let propagationStopper = (event) => {event.stopPropagation();};

		let createPositionButton = (positionButtonId = '', text = '', listenerFunction = undefined, stopPropagation = true) => {
			let positionButton = document.createElement('div');
			positionButton.id = positionButtonId;
			positionButton.classList.add('positionButton');
			positionButton.innerText = text;

			if (listenerFunction !== undefined)
				positionButton.addEventListener('click', listenerFunction);

			if (stopPropagation) {
				positionButton.addEventListener('mousedown', propagationStopper);
				positionButton.addEventListener('click', (event) => {
					this.setSwitchablesOff(event.target.parentElement);
				});
			}

			return positionButton;
		};

		let createPositionSlot = (positionId = '', text = '', listenerFunction = undefined, stopPropagation = true) => {
			let positionSlot = document.createElement('div');
			positionSlot.id = `${positionId}Slot`;
			positionSlot.classList.add('positionSlot');

			let positionButton = createPositionButton(`${positionId}Button`, text, listenerFunction, stopPropagation);
			positionSlot.appendChild(positionButton);

			return positionSlot;
		};


		// SizeType buttons
		let sizeTypeButtonPanel = document.createElement('div');
		sizeTypeButtonPanel.id = 'sizeTypeButtonPanel';
		sizeTypeButtonPanel.classList.add('switchable');
		sizeTypeButtonPanel.classList.add('hidden');

		let sizeTypes = ["Viewport", "Fixed", "Auto"];
		for(let sizeType of sizeTypes) {
			let sizeTypeButton = createPositionButton('sizeType' + sizeType, sizeType, () => {this.dataset.sizeType = sizeType;});
			sizeTypeButton.classList.add('sizeTypeButton');

			sizeTypeButtonPanel.appendChild(sizeTypeButton);
		}

		// Fixed position buttons
		let fixedButtonGrid = document.createElement('div');
		fixedButtonGrid.id = 'fixedButtonGrid';
		fixedButtonGrid.classList.add('switchable');
		fixedButtonGrid.classList.add('hidden');

		let fixedButtonTexts = [
			['┌', '┬', '┐'],
			['├', '┼', '┤'],
			['└', '┴', '┘']
		];

		for (let rowNum = 0; rowNum < 3; rowNum++) {
			for (let colNum = 0; colNum < 3; colNum++) {
				let fixedButton = createPositionButton('fixed' + rowNum + colNum, fixedButtonTexts[rowNum][colNum], this.applyFixedStyle.bind(this, {x:colNum*50, y:rowNum*50}, {x:colNum*50, y:rowNum*50}));
				fixedButton.classList.add('fixedButton');

				fixedButtonGrid.appendChild(fixedButton);
			}
		}


		// Movable slot
		let movableSlot = createPositionSlot('movable', '', undefined, false);

		// SizeType slot
		let sizeTypeSlot = createPositionSlot('sizeType', '%', FloatingWindow.switchElementVisibility.bind(this, sizeTypeButtonPanel));

		// Minimize slot
		let minimizeSlot = createPositionSlot('minimize', '_', this.applyMinimizedStyle.bind(this));

		// Fixed slot
		let fixedSlot = createPositionSlot('fixed', '+', FloatingWindow.switchElementVisibility.bind(this, fixedButtonGrid));

		// Maximize slot
		let maximizeSlot = createPositionSlot('maximize', '⛶', this.applyMaximizedStyle.bind(this));

		// Close slot
		let closeSlot = createPositionSlot('close', 'X', this.closeWindow.bind(this));


		// Content
		let content = document.createElement('div');
		content.id = 'content';


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
		this.addEventListener('mousedown', this.setSwitchablesOff.bind(this));

		// Window resize handling
		window.addEventListener('resize', () => {this.fixLessThatMinSize();});

		// Accessible parts
		this.content = content;
	}
}

// Register FloatingWindow
customElements.define('floating-window', FloatingWindow);
