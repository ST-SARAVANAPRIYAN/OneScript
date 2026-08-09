const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Robust JavaScript function extractor based on brace counting
function extractFunction(code, functionName) {
	let idx = code.indexOf("function " + functionName);
	if (idx === -1) {
		idx = code.indexOf("var " + functionName + " = function");
	}
	if (idx === -1) {
		return null;
	}

	let braceCount = 0;
	let start = code.indexOf("{", idx);
	let end = start;
	for (let i = start; i < code.length; i++) {
		if (code[i] === '{') {
			braceCount++;
		} else if (code[i] === '}') {
			braceCount--;
			if (braceCount === 0) {
				end = i;
				break;
			}
		}
	}
	return code.slice(idx, end + 1);
}

// Extractor for callCommand bodies (inner functions sent to Document Builder)
function extractCallCommandBody(code, outerFunctionName) {
	const outerIdx = code.indexOf("function " + outerFunctionName);
	if (outerIdx === -1) return null;
	const callCommandIdx = code.indexOf("callCommand", outerIdx);
	if (callCommandIdx === -1) return null;
	const funcIdx = code.indexOf("function", callCommandIdx);
	if (funcIdx === -1) return null;
	const start = code.indexOf("{", funcIdx);
	let braceCount = 0;
	let end = start;
	for (let i = start; i < code.length; i++) {
		if (code[i] === '{') {
			braceCount++;
		} else if (code[i] === '}') {
			braceCount--;
			if (braceCount === 0) {
				end = i;
				break;
			}
		}
	}
	return "var runDefragmentInDocument = function() " + code.slice(start, end + 1);
}

// Load plugin code
const pluginCode = fs.readFileSync(path.join(__dirname, '../plugin/plugin.js'), 'utf8');

// Extract target functions
const applyPropertiesToElementSrc = extractFunction(pluginCode, 'applyPropertiesToElement');
const parseAndApplyTextWithTagsSrc = extractFunction(pluginCode, 'parseAndApplyTextWithTags');
const runDefragmentCommandSrc = extractCallCommandBody(pluginCode, 'runDefragmentCommand');

// Define Mock ONLYOFFICE API classes
class MockColor {
	constructor(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
	GetClassType() { return "color"; }
}

class MockTextPr {
	constructor() {
		this.fontSize = null;
		this.fontFamily = null;
		this.bold = null;
		this.italic = null;
		this.underline = null;
		this.strikeout = null;
		this.highlight = null;
		this.color = null;
	}
	GetClassType() { return "textPr"; }
	SetFontSize(sz) { this.fontSize = sz; }
	SetFontFamily(f) { this.fontFamily = f; }
	SetFontName(f) { this.fontFamily = f; }
	SetBold(b) { this.bold = b; }
	SetItalic(i) { this.italic = i; }
	SetUnderline(u) { this.underline = u; }
	SetStrikeout(s) { this.strikeout = s; }
	SetDoubleStrikeout(ds) { this.doubleStrikeout = ds; }
	SetHighlight(h) { this.highlight = h; }
	SetColor(c, g, b) {
		if (g !== undefined) this.color = new MockColor(c, g, b);
		else this.color = c;
	}
}

class MockRange {
	constructor(parent) {
		this.parent = parent;
		this.fontSize = null;
		this.fontFamily = null;
		this.bold = null;
		this.italic = null;
		this.underline = null;
		this.strikeout = null;
		this.highlight = null;
		this.color = null;
		this.characterSpacing = null;
		this.textPr = new MockTextPr();
	}
	GetClassType() { return "range"; }
	SetFontSize(sz) { this.fontSize = sz; }
	SetFontFamily(f) { this.fontFamily = f; }
	SetFontName(f) { this.fontFamily = f; }
	SetBold(b) { this.bold = b; }
	SetItalic(i) { this.italic = i; }
	SetUnderline(u) { this.underline = u; }
	SetStrikeout(s) { this.strikeout = s; }
	SetDoubleStrikeout(ds) { this.doubleStrikeout = ds; }
	SetHighlight(h) { this.highlight = h; }
	SetColor(c, g, b) {
		if (g !== undefined) this.color = new MockColor(c, g, b);
		else this.color = c;
	}
	SetSpacing(sp) { this.characterSpacing = sp; }
	GetTextPr() { return this.textPr; }
	SetTextPr(tp) { this.textPr = tp; }
}

class MockRun {
	constructor(text) {
		this.text = text;
		this.range = new MockRange(this);
	}
	GetClassType() { return "run"; }
	GetRange() { return this.range; }
	GetText() { return this.text; }
	GetTextPr() { return this.range.GetTextPr(); }
	SetTextPr(tp) { this.range.SetTextPr(tp); }
}

class MockParagraph {
	constructor(text = "") {
		this.elements = text ? [new MockRun(text)] : [];
		this.jc = null;
		this.spacingAfter = null;
		this.spacingBefore = null;
		this.spacingLine = null;
		this.shd = null;
	}
	GetClassType() { return "paragraph"; }
	GetRange() { return new MockRange(this); }
	RemoveAllElements() { this.elements = []; }
	AddText(t) {
		const r = new MockRun(t);
		this.elements.push(r);
		return r;
	}
	GetElementsCount() { return this.elements.length; }
	GetElement(idx) { return this.elements[idx]; }
	GetText() { return this.elements.map(e => e.GetText()).join(""); }
	SetJc(jc) { this.jc = jc; }
	SetSpacingAfter(sa) { this.spacingAfter = sa; }
	SetSpacingBefore(sb) { this.spacingBefore = sb; }
	SetSpacingLine(val, rule) { this.spacingLine = { val, rule }; }
	SetShd(r, g, b) {
		if (g !== undefined) this.shd = new MockColor(r, g, b);
		else this.shd = r;
	}
}

class MockDocument {
	constructor(paragraphs = []) {
		this.elements = paragraphs;
	}
	GetElementsCount() { return this.elements.length; }
	GetElement(idx) { return this.elements[idx]; }
	RemoveElement(idx) { this.elements.splice(idx, 1); }
}

// Prepare execution context
const globalContext = {
	Api: {
		CreateTextPr: () => new MockTextPr(),
		CreateColorFromRGB: (r, g, b) => new MockColor(r, g, b),
		GetDocument: () => {
			if (!globalContext.__activeDoc) {
				globalContext.__activeDoc = new MockDocument();
			}
			return globalContext.__activeDoc;
		}
	},
	JSON: JSON,
	Math: Math,
	String: String,
	console: console
};
const sandbox = vm.createContext(globalContext);

// Evaluate target functions in sandbox
vm.runInContext(applyPropertiesToElementSrc, sandbox);
vm.runInContext(parseAndApplyTextWithTagsSrc, sandbox);
vm.runInContext(runDefragmentCommandSrc, sandbox);

const applyPropertiesToElement = sandbox.applyPropertiesToElement;
const parseAndApplyTextWithTags = sandbox.parseAndApplyTextWithTags;
const runDefragmentInDocument = sandbox.runDefragmentInDocument;

// Test Suite Runner
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
	if (condition) {
		console.log(`[PASS] ${message}`);
		testsPassed++;
	} else {
		console.error(`[FAIL] ${message}`);
		testsFailed++;
	}
}

console.log("=== STARTING ONLYOFFICE API COMPATIBILITY TESTS ===\n");

// Test 1: Direct Character Formatting on Range via applyPropertiesToElement
try {
	const range = new MockRange();
	applyPropertiesToElement(range, {
		fontSize: 30, // 15pt
		fontName: "Arial",
		bold: true,
		italic: false,
		underline: true,
		highlight: "yellow",
		color: "#ff0000"
	}, "run");
	
	assert(range.fontSize === 30, "Range direct fontSize set to 30");
	assert(range.fontFamily === "Arial", "Range direct fontFamily set to Arial");
	assert(range.bold === true, "Range direct bold set to true");
	assert(range.underline === true, "Range direct underline set to true");
	assert(range.highlight === "yellow", "Range direct highlight set to yellow");
	assert(range.color instanceof MockColor && range.color.r === 255, "Range direct color parsed and created via rgb");
} catch(e) {
	console.error("[ERROR] Test 1 encountered runtime error:", e);
	testsFailed++;
}

// Test 2: Formatting Paragraph layout properties
try {
	const para = new MockParagraph("Hello World");
	applyPropertiesToElement(para, {
		alignment: "justify",
		spacingAfter: 120,
		spacingBefore: 240,
		lineSpacing: 1.15,
		shading: "#0000ff"
	}, "paragraph");
	
	assert(para.jc === "both", "Paragraph alignment justified to both");
	assert(para.spacingAfter === 120, "Paragraph spacingAfter set to 120");
	assert(para.spacingBefore === 240, "Paragraph spacingBefore set to 240");
	assert(para.spacingLine && para.spacingLine.val === 276, "Paragraph lineSpacing computed as 276 twips");
	assert(para.shd instanceof MockColor && para.shd.b === 255, "Paragraph shading color applied");
} catch(e) {
	console.error("[ERROR] Test 2 encountered runtime error:", e);
	testsFailed++;
}

// Test 3: HTML Tag parser parsing formatted runs (parseAndApplyTextWithTags)
try {
	const para = new MockParagraph();
	parseAndApplyTextWithTags(para, "This is <b>bold</b> and <mark color='yellow'>IEEE</mark> text.", "Arial", 22, false, false, false, false, "#000000", "none", {});
	
	assert(para.elements.length === 5, "Segmented into 5 distinct runs");
	
	const runNormal1 = para.elements[0];
	const runBold = para.elements[1];
	const runNormal2 = para.elements[2];
	const runHighlight = para.elements[3];
	
	assert(runNormal1.GetText() === "This is ", "Run 1 text matches");
	assert(runBold.GetText() === "bold" && runBold.GetRange().bold === true, "Run 2 text matches and bold set to true");
	assert(runNormal2.GetText() === " and ", "Run 3 text matches");
	assert(runHighlight.GetText() === "IEEE" && runHighlight.GetRange().highlight === "yellow", "Run 4 text matches and highlight set to yellow");
} catch(e) {
	console.error("[ERROR] Test 3 encountered runtime error:", e);
	testsFailed++;
}

// Test 4: Document layout defragmentation (runDefragmentInDocument)
try {
	// Case 4.1: CONTIGUOUS lines without sentence ending should merge
	const doc = new MockDocument([
		new MockParagraph("This line continues"),
		new MockParagraph("on the next line.")
	]);
	globalContext.__activeDoc = doc;
	
	let res = runDefragmentInDocument();
	assert(res.mergedCount === 1, "Defragmentation merged contiguous paragraph lines");
	assert(doc.GetElementsCount() === 1, "Document elements count reduced to 1");
	assert(doc.GetElement(0).GetText() === "This line continues on the next line.", "Lines merged and separated by space");

	// Case 4.2: CONTIGUOUS lines ending with sentence punctuation should NOT merge
	const doc2 = new MockDocument([
		new MockParagraph("This line ends here."),
		new MockParagraph("New sentence starts here.")
	]);
	globalContext.__activeDoc = doc2;
	
	res = runDefragmentInDocument();
	assert(res.mergedCount === 0, "Lines with sentence endings not merged");
	assert(doc2.GetElementsCount() === 2, "Document elements count unchanged");

	// Case 4.3: Contiguous line where next line is a bullet/numbered heading should NOT merge
	const doc3 = new MockDocument([
		new MockParagraph("This is some text"),
		new MockParagraph("1. Heading section")
	]);
	globalContext.__activeDoc = doc3;
	
	res = runDefragmentInDocument();
	assert(res.mergedCount === 0, "Lines followed by headings not merged");
	assert(doc3.GetElementsCount() === 2, "Document elements count unchanged for headings");

} catch(e) {
	console.error("[ERROR] Test 4 encountered runtime error:", e);
	testsFailed++;
}

// Test 5: Combined Nested Tag States (bold + italic hierarchy)
try {
	const para = new MockParagraph();
	// Tag sequence: Normal -> Bold start -> Bold-Italic start -> Bold-Italic end -> Bold end -> Normal
	parseAndApplyTextWithTags(para, "Normal <b>bold <i>bold-italic</i> bold</b> normal.", "Arial", 22, false, false, false, false, "#000000", "none", {});
	
	assert(para.elements.length === 5, "Nested formatting segmented into 5 runs");
	
	const runNormal1 = para.elements[0];
	const runBold1 = para.elements[1];
	const runBoldItalic = para.elements[2];
	const runBold2 = para.elements[3];
	const runNormal2 = para.elements[4];
	
	assert(runNormal1.GetText() === "Normal " && !runNormal1.GetRange().bold && !runNormal1.GetRange().italic, "Segment 1 is normal text");
	assert(runBold1.GetText() === "bold " && runBold1.GetRange().bold && !runBold1.GetRange().italic, "Segment 2 is bold-only text");
	assert(runBoldItalic.GetText() === "bold-italic" && runBoldItalic.GetRange().bold && runBoldItalic.GetRange().italic, "Segment 3 is nested bold-italic text");
	assert(runBold2.GetText() === " bold" && runBold2.GetRange().bold && !runBold2.GetRange().italic, "Segment 4 popped italic and restored bold-only text");
	assert(runNormal2.GetText() === " normal." && !runNormal2.GetRange().bold && !runNormal2.GetRange().italic, "Segment 5 popped all tags back to normal");
} catch(e) {
	console.error("[ERROR] Test 5 encountered runtime error:", e);
	testsFailed++;
}

// Test 6: Compound CSS Span Styles
try {
	const para = new MockParagraph();
	parseAndApplyTextWithTags(para, "Simple <span style='font-weight: bold; font-style: italic; color: #ff0000; font-size: 14pt; letter-spacing: 3pt; text-transform: uppercase;'>compound span</span> text.", "Arial", 22, false, false, false, false, "#000000", "none", {});
	
	assert(para.elements.length === 3, "Compound span style segmented into 3 runs");
	
	const runMiddle = para.elements[1];
	assert(runMiddle.GetText() === "compound span", "Span text extracted");
	assert(runMiddle.GetRange().bold === true, "Compound style applied bold");
	assert(runMiddle.GetRange().italic === true, "Compound style applied italic");
	assert(runMiddle.GetRange().color instanceof MockColor && runMiddle.GetRange().color.r === 255 && runMiddle.GetRange().color.g === 0, "Compound style applied RGB hex color red");
	assert(runMiddle.GetRange().fontSize === 28, "Compound style converted size: 14pt to 28 half-points");
	assert(runMiddle.GetRange().characterSpacing === 60, "Compound style converted spacing: 3pt to 60 units");
} catch(e) {
	console.error("[ERROR] Test 6 encountered runtime error:", e);
	testsFailed++;
}

// Test 7: Mixed Markdown and HTML
try {
	const para = new MockParagraph();
	parseAndApplyTextWithTags(para, "**Markdown Bold** and <i>HTML Italic</i>.", "Arial", 22, false, false, false, false, "#000000", "none", {});
	
	assert(para.elements.length === 4, "Mixed markdown and HTML segmented into 4 runs");
	
	const runBold = para.elements[0];
	const runItalic = para.elements[2];
	
	assert(runBold.GetText() === "Markdown Bold" && runBold.GetRange().bold === true, "Markdown bold tags parsed and styled correctly");
	assert(runItalic.GetText() === "HTML Italic" && runItalic.GetRange().italic === true, "HTML italic tags parsed and styled correctly");
} catch(e) {
	console.error("[ERROR] Test 7 encountered runtime error:", e);
	testsFailed++;
}

console.log(`\n=== TEST RUN SUMMARY ===`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
	process.exit(1);
} else {
	console.log("All ONLYOFFICE API formatting mock tests completed successfully!");
}
