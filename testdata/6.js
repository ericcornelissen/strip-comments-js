const language = read(); // Get the language to respond in
const msg = `Hello ${
	language === "SE" ? "värld" : "world" // Only support Swedish and English
}`;
