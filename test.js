/**/
let floatingWindow = document.createElement("floating-window");
console.log(floatingWindow);
document.body.appendChild(floatingWindow);

floatingWindow.initContent = content => {
	// console.log("asd");
	// content.innerHTML = `
	floatingWindow.content.innerHTML = `
    asd<b>asds</b>asd<i>adaaa</i>aaaaaa<hr>
    <table>
    <tr><th>asd</th><th>asd</th><th>asd</th></tr>
    <tr><td>asd</td><td>asd</td><td>asd</td></tr>
    <tr><td>asd</td><td>asd</td><td>asd</td></tr>
    </table>
    <textarea>
    </textarea>
    aaaaaaaaaaa
    <a href="https://google.com">link</a>
    <button>asd</button>aaaaaaaaaasd<br>
    klsjg`;

	floatingWindow.style.height = "300px";
};
//floatingWindow.content.setAttribute('contenteditable', 'true')

// document.body.appendChild(floatingWindow);
/**/
