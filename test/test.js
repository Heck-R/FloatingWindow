function run() {
	/**/
	/** @type FloatingWindow */
	let floatingWindow = document.createElement("floating-window");
	document.documentElement.appendChild(floatingWindow);
	console.log(floatingWindow);

	floatingWindow.content.innerHTML += `
        asd<b>asds</b>asd<i>adaaa</i>aaaaaa<hr>
        <table>
        <tr><th>asd</th><th>asd</th><th>asd</th></tr>
        <tr><td>asd</td><td>asd</td><td>asd</td></tr>
        <tr><td>asd</td><td>asd</td><td>asd</td></tr>
        </table>
        <textarea>
        </textarea>
        aaaaaaaaaaa
        <a href="https://gooaikdfhsdjkfgle.com">link</a>
        <a href="https://google.com">link</a>
        <button>asd</button>aaaaaaaaaasd<br>
		<input type="button" value="asd"></input><br>
		<input type="checkbox"></input><br>
		<input type="color"></input><br>
		<input type="date"></input><br>
		<input type="datetime-local"></input><br>
		<input type="email"></input><br>
		<input type="file"></input><br>
		<input type="hidden"></input><br>
		<input type="image"></input><br>
		<input type="month"></input><br>
		<input type="number"></input><br>
		<input type="password"></input><br>
		<input type="radio"></input><br>
		<input type="range"></input><br>
		<input type="reset"></input><br>
		<input type="search"></input><br>
		<input type="submit"></input><br>
		<input type="tel"></input><br>
		<input type="text"></input><br>
		<input type="time"></input><br>
		<input type="url"></input><br>
		<input type="week"></input><br>
		<select>
			<option>option 1</option>
			<option>option 2</option>
			<option>option 3</option>
		</select><br>
		<br>
        klsjg`;

	floatingWindow.style.height = "900px";
	// };
	//floatingWindow.content.setAttribute('contenteditable', 'true')

	// document.body.appendChild(floatingWindow);
	/**/
}

run();
