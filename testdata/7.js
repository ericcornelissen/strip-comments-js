const msg = `Hello ${
	(function () {
		const r = Math.random();
		if (r < 0.25) {
			// English
			return "world";
		} else if (r < 0.50) {
			// Swedish
			return "värld";
		} else if (r < 0.75) {
			// Dutch
			return "wereld";
		} else if (r < 0.99) {
			// Spanish
			return "mundo";
		} else {
			/* 1% of the time output an easter egg */
			return "easter egg";
		}
	})()
}`;

console.log(msg);
