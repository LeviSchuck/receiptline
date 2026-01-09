export type BarcodeSymbolType = 'upc' | 'ean' | 'jan' | 'code39' | 'itf' | 'codabar' | 'nw7' | 'code93' | 'code128';

export type BarcodeCode128Symbol = {
	type: 'code128',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeCode93Symbol = {
	type: 'code93',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeCodabarSymbol = {
	type: 'codabar' | 'nw7',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeItfSymbol = {
	type: 'itf',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeCode39Symbol = {
	type: 'code39',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeUpcSymbol = {
	type: 'upc',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeEanSymbol = {
	type: 'ean' | 'jan',
	data: string,
	hri: boolean,
	width: number,
	height: number,
	quietZone: boolean,
};

export type BarcodeSymbol =
	| BarcodeCode128Symbol
	| BarcodeCode93Symbol
	| BarcodeCodabarSymbol
	| BarcodeItfSymbol
	| BarcodeCode39Symbol
	| BarcodeUpcSymbol
	| BarcodeEanSymbol;

export type BarcodeResult = {
	hri?: boolean,
	text?: string,
	widths?: number[],
	length?: number,
	height?: number,
};
// CODE128 patterns:
const c128 = {
	element: '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(','),
	starta: 103, startb: 104, startc: 105, atob: 100, atoc: 99, btoa: 101, btoc: 99, ctoa: 101, ctob: 100, shift: 98, stop: 106
};
// process CODE128 code set A:
function code128a(x: number, s: string, d: number[]): void {
	if (x !== c128.shift) {
		d.push(x);
	}
	s = s.replace(/^((?!\d{4,})[\x00-_])+/, m => (m.split('').forEach(c => d.push((c.charCodeAt(0) + 64) % 96)), ''));
	s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push((m.charCodeAt(0) + 64) % 96), ''));
	const t = s.slice(1);
	const p = t.search(/[^ -_]/);
	if (/^\d{4,}/.test(s)) {
		code128c(c128.atoc, s, d);
	}
	else if (p >= 0 && t.charCodeAt(p) < 32) {
		d.push(c128.shift, s.charCodeAt(0) - 32);
		code128a(c128.shift, t, d);
	}
	else if (s.length > 0) {
		code128b(c128.atob, s, d);
	}
	else {
		// end
	}
}
// process CODE128 code set B:
function code128b(x: number, s: string, d: number[]): void {
	if (x !== c128.shift) {
		d.push(x);
	}
	s = s.replace(/^((?!\d{4,})[ -\x7f])+/, m => (m.split('').forEach(c => d.push(c.charCodeAt(0) - 32)), ''));
	s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push(m.charCodeAt(0) - 32), ''));
	const t = s.slice(1);
	const p = t.search(/[^ -_]/);
	if (/^\d{4,}/.test(s)) {
		code128c(c128.btoc, s, d);
	}
	else if (p >= 0 && t.charCodeAt(p) > 95) {
		d.push(c128.shift, s.charCodeAt(0) + 64);
		code128b(c128.shift, t, d);
	}
	else if (s.length > 0) {
		code128a(c128.btoa, s, d);
	}
	else {
		// end
	}
}
// process CODE128 code set C:
function code128c(x: number, s: string, d: number[]): void {
	if (x !== c128.shift) {
		d.push(x);
	}
	s = s.replace(/^\d{4,}/g, m => m.replace(/\d{2}/g, c => (d.push(Number(c)), '')));
	const p = s.search(/[^ -_]/);
	if (p >= 0 && s.charCodeAt(p) < 32) {
		code128a(c128.ctoa, s, d);
	}
	else if (s.length > 0) {
		code128b(c128.ctob, s, d);
	}
	else {
		// end
	}
}
// generate CODE128 data (minimize symbol width):
function code128(symbol: BarcodeCode128Symbol): BarcodeResult {
	const r: BarcodeResult = {};
	let s = symbol.data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
	if (s.length > 0) {
		// generate HRI
		r.hri = symbol.hri;
		r.text = s.replace(/[\x00- \x7f]/g, ' ');
		// minimize symbol width
		const d: number[] = [];
		const p = s.search(/[^ -_]/);
		if (/^\d{2}$/.test(s)) {
			d.push(c128.startc, Number(s));
		}
		else if (/^\d{4,}/.test(s)) {
			code128c(c128.startc, s, d);
		}
		else if (p >= 0 && s.charCodeAt(p) < 32) {
			code128a(c128.starta, s, d);
		}
		else if (s.length > 0) {
			code128b(c128.startb, s, d);
		}
		else {
			// end
		}
		// calculate check digit and append stop character
		d.push(d.reduce((a, c, i) => a + c * i) % 103, c128.stop);
		// generate bars and spaces
		const q = symbol.quietZone ? 'a' : '0';
		const m = d.reduce((a, c) => a + c128.element[c], q) + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
		r.length = symbol.width * (d.length * 11 + (symbol.quietZone ? 22 : 2));
		r.height = symbol.height;
	}
	return r;
}
// CODE93 patterns:
const c93 = {
	escape: 'cU,dA,dB,dC,dD,dE,dF,dG,dH,dI,dJ,dK,dL,dM,dN,dO,dP,dQ,dR,dS,dT,dU,dV,dW,dX,dY,dZ,cA,cB,cC,cD,cE, ,sA,sB,sC,$,%,sF,sG,sH,sI,sJ,+,sL,-,.,/,0,1,2,3,4,5,6,7,8,9,sZ,cF,cG,cH,cI,cJ,cV,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,cK,cL,cM,cN,cO,cW,pA,pB,pC,pD,pE,pF,pG,pH,pI,pJ,pK,pL,pM,pN,pO,pP,pQ,pR,pS,pT,pU,pV,pW,pX,pY,pZ,cP,cQ,cR,cS,cT'.split(','),
	code: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%dcsp'.split('').reduce((a: Record<string, number>, c, i) => (a[c] = i, a), {} as Record<string, number>),
	element: '131112,111213,111312,111411,121113,121212,121311,111114,131211,141111,211113,211212,211311,221112,221211,231111,112113,112212,112311,122112,132111,111123,111222,111321,121122,131121,212112,212211,211122,211221,221121,222111,112122,112221,122121,123111,121131,311112,311211,321111,112131,113121,211131,121221,312111,311121,122211,111141,1111411'.split(','),
	start: 47, stop: 48
};
// generate CODE93 data:
function code93(symbol: BarcodeCode93Symbol): BarcodeResult {
	const r: BarcodeResult = {};
	let s = symbol.data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
	if (s.length > 0) {
		// generate HRI
		r.hri = symbol.hri;
		r.text = s.replace(/[\x00- \x7f]/g, ' ');
		// calculate check digit
		const d = s.split('').reduce((a, c) => a + c93.escape[c.charCodeAt(0)], '').split('').map(c => c93.code[c]!);
		d.push(d.reduceRight((a, c, i) => a + c * ((d.length - 1 - i) % 20 + 1)) % 47);
		d.push(d.reduceRight((a, c, i) => a + c * ((d.length - 1 - i) % 15 + 1)) % 47);
		// append start character and stop character
		d.unshift(c93.start);
		d.push(c93.stop);
		// generate bars and spaces
		const q = symbol.quietZone ? 'a' : '0';
		const m = d.reduce((a, c) => a + c93.element[c], q) + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
		r.length = symbol.width * (d.length * 9 + (symbol.quietZone ? 21 : 1));
		r.height = symbol.height;
	}
	return r;
}
// Codabar(NW-7) patterns:
const nw7: Record<string, string> = {
	'0': '2222255', '1': '2222552', '2': '2225225', '3': '5522222', '4': '2252252',
	'5': '5222252', '6': '2522225', '7': '2522522', '8': '2552222', '9': '5225222',
	'-': '2225522', '$': '2255222', ':': '5222525', '/': '5252225', '.': '5252522',
	'+': '2252525', 'A': '2255252', 'B': '2525225', 'C': '2225255', 'D': '2225552'
};
// generate Codabar(NW-7) data:
function codabar(symbol: BarcodeCodabarSymbol): BarcodeResult {
	const r: BarcodeResult = {};
	let s = symbol.data.replace(/((?!^[A-D][0-9\-$:/.+]+[A-D]$).)*/i, '');
	if (s.length > 0) {
		// generate HRI
		r.hri = symbol.hri;
		r.text = s;
		// generate bars and spaces
		const q = symbol.quietZone ? 'a' : '0';
		const m = s.toUpperCase().split('').reduce((a, c) => a + nw7[c] + '2', q).slice(0, -1) + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
		const w = [25, 39, 50, 3, 5, 6];
		r.length = s.length * w[symbol.width - 2]! - (s.match(/[\d\-$]/g) || []).length * w[symbol.width + 1]! + symbol.width * (symbol.quietZone ? 19 : -1);
		r.height = symbol.height;
	}
	return r;
}
// Interleaved 2 of 5 patterns:
const i25 = {
	element: '22552,52225,25225,55222,22525,52522,25522,22255,52252,25252'.split(','),
	start: '2222', stop: '522'
};
// generate Interleaved 2 of 5 data:
function itf(symbol: BarcodeItfSymbol): BarcodeResult {
	const r: BarcodeResult = {};
	let s = symbol.data.replace(/((?!^(\d{2})+$).)*/, '');
	if (s.length > 0) {
		// generate HRI
		r.hri = symbol.hri;
		r.text = s;
		// generate bars and spaces
		const d = s.split('').map(c => Number(c));
		const q = symbol.quietZone ? 'a' : '0';
		let m = q + i25.start;
		let i = 0;
		while (i < d.length) {
			const b = i25.element![d[i++]!];
			const s = i25.element![d[i++]!];
			m += b!.split('').reduce((a, c, j) => a + c + s![j]!, '');
		}
		m += i25.stop + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
		const w = [16, 25, 32, 17, 26, 34];
		r.length = s.length * w![symbol.width - 2]! + w![symbol.width + 1]! + symbol.width * (symbol.quietZone ? 20 : 0);
		r.height = symbol.height;
	}
	return r;
}
// CODE39 patterns:
const c39: Record<string, string> = {
	'0': '222552522', '1': '522522225', '2': '225522225', '3': '525522222', '4': '222552225',
	'5': '522552222', '6': '225552222', '7': '222522525', '8': '522522522', '9': '225522522',
	'A': '522225225', 'B': '225225225', 'C': '525225222', 'D': '222255225', 'E': '522255222',
	'F': '225255222', 'G': '222225525', 'H': '522225522', 'I': '225225522', 'J': '222255522',
	'K': '522222255', 'L': '225222255', 'M': '525222252', 'N': '222252255', 'O': '522252252',
	'P': '225252252', 'Q': '222222555', 'R': '522222552', 'S': '225222552', 'T': '222252552',
	'U': '552222225', 'V': '255222225', 'W': '555222222', 'X': '252252225', 'Y': '552252222',
	'Z': '255252222', '-': '252222525', '.': '552222522', ' ': '255222522', '$': '252525222',
	'/': '252522252', '+': '252225252', '%': '222525252', '*': '252252522'
};
// generate CODE39 data:
function code39(symbol: BarcodeCode39Symbol): BarcodeResult {
	const r: BarcodeResult = {};
	let s = symbol.data.replace(/((?!^\*?[0-9A-Z\-. $/+%]+\*?$).)*/, '');
	if (s.length > 0) {
		// append start character and stop character
		s = s.replace(/^\*?([^*]+)\*?$/, '*$1*');
		// generate HRI
		r.hri = symbol.hri;
		r.text = s;
		// generate bars and spaces
		const q = symbol.quietZone ? 'a' : '0';
		const m = s.split('').reduce((a, c) => a + c39[c] + '2', q).slice(0, -1) + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
		const w = [29, 45, 58];
		r.length = s.length * w![symbol.width - 2]! + symbol.width * (symbol.quietZone ? 19 : -1);
		r.height = symbol.height;
	}
	return r;
}
// UPC/EAN/JAN patterns:
const ean: Record<string, string[]> = {
	a: '3211,2221,2122,1411,1132,1231,1114,1312,1213,3112'.split(','),
	b: '1123,1222,2212,1141,2311,1321,4111,2131,3121,2113'.split(','),
	c: '3211,2221,2122,1411,1132,1231,1114,1312,1213,3112'.split(','),
	g: '111,11111,111111,11,112'.split(','),
	p: 'aaaaaa,aababb,aabbab,aabbba,abaabb,abbaab,abbbaa,ababab,ababba,abbaba'.split(','),
	e: 'bbbaaa,bbabaa,bbaaba,bbaaab,babbaa,baabba,baaabb,bababa,babaab,baabab'.split(',')
};
// convert UPC-E to UPC-A:
function upcetoa(e: number[]): number[] {
	const a = e.slice(0, 3);
	switch (e[6]) {
		case 0: case 1: case 2:
			a.push(e[6]!, 0, 0, 0, 0, e[3]!, e[4]!, e[5]!);
			break;
		case 3:
			a.push(e[3]!, 0, 0, 0, 0, 0, e[4]!, e[5]!);
			break;
		case 4:
			a.push(e[3]!, e[4]!, 0, 0, 0, 0, 0, e[5]!);
			break;
		default:
			a.push(e[3]!, e[4]!, e[5]!, 0, 0, 0, 0, e[6]!);
			break;
	}
	a.push(e[7]!);
	return a;
}
// generate EAN-13(JAN-13) data:
function ean13(symbol: BarcodeEanSymbol | BarcodeUpcSymbol): BarcodeResult {
	const r: BarcodeResult = {};
	const d = symbol.data.replace(/((?!^\d{12,13}$).)*/, '').split('').map(c => Number(c));
	if (d.length > 0) {
		// calculate check digit
		d[12] = 0;
		d[12] = (10 - d.reduce((a, c, i) => a + c * ((i % 2) * 2 + 1)) % 10) % 10;
		// generate HRI
		r.hri = symbol.hri;
		r.text = d.join('');
		// generate bars and spaces
		let m = (symbol.quietZone ? 'b' : '0') + ean.g![0];
		for (let i = 1; i < 7; i++) m += ean![ean.p![d[0]!]![i - 1]!]![d[i]!];
		m += ean.g![1];
		for (let i = 7; i < 13; i++) m += ean.c![d[i]!];
		m += ean.g![0] + (symbol.quietZone ? '7' : '0');
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
		r.length = symbol.width * (symbol.quietZone ? 113 : 95);
		r.height = symbol.height;
	}
	return r;
}
// generate EAN-8(JAN-8) data:
function ean8(symbol: BarcodeEanSymbol): BarcodeResult {
	const r: BarcodeResult = {};
	const d = symbol.data.replace(/((?!^\d{7,8}$).)*/, '').split('').map(c => Number(c));
	if (d.length > 0) {
		// calculate check digit
		d[7] = 0;
		d[7] = (10 - d.reduce((a, c, i) => a + c * (3 - (i % 2) * 2), 0) % 10) % 10;
		// generate HRI
		r.hri = symbol.hri;
		r.text = d.join('');
		// generate bars and spaces
		const q = symbol.quietZone ? '7' : '0';
		let m = q + ean.g![0];
		for (let i = 0; i < 4; i++) m += ean.a![d[i] ?? 0];
		m += ean.g![1];
		for (let i = 4; i < 8; i++) m += ean.c![d![i] ?? 0];
		m += ean.g![0] + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
		r.length = symbol.width * (symbol.quietZone ? 81 : 67);
		r.height = symbol.height;
	}
	return r;
}
// generate UPC-A data:
function upca(symbol: BarcodeUpcSymbol): BarcodeResult {
	const s: BarcodeEanSymbol = {
		type: 'ean',
		data: '0' + symbol.data,
		hri: symbol.hri,
		width: symbol.width,
		height: symbol.height,
		quietZone: symbol.quietZone,
	};
	const r = ean13(s);
	if (r.text) {
		r.text = r.text.slice(1);
	}
	return r;
}
// generate UPC-E data:
function upce(symbol: BarcodeUpcSymbol): BarcodeResult {
	const r: BarcodeResult = {};
	const d = symbol.data.replace(/((?!^0\d{6,7}$).)*/, '').split('').map(c => Number(c));
	if (d.length > 0) {
		// calculate check digit
		d[7] = 0;
		d[7] = (10 - upcetoa(d).reduce((a, c, i) => a + c * (3 - (i % 2) * 2), 0) % 10) % 10;
		// generate HRI
		r.hri = symbol.hri;
		r.text = d.join('');
		// generate bars and spaces
		const q = symbol.quietZone ? '7' : '0';
		let m = q + ean.g![0];
		for (let i = 1; i < 7; i++) m += ean[ean.e![d[7] ?? 0]![i - 1]!]![d[i] ?? 0];
		m += ean.g![2] + q;
		r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
		r.length = symbol.width * (symbol.quietZone ? 65 : 51);
		r.height = symbol.height;
	}
	return r;
}


/**
 * Generate barcode.
 * @param symbol barcode information (data, type, width, height, hri, quietZone)
 * @returns barcode form
 */
export function generate(symbol: BarcodeSymbol): BarcodeResult {
	let r: BarcodeResult = {};
	switch (symbol.type) {
		case 'upc':
			r = symbol.data.length < 9 ? upce(symbol) : upca(symbol);
			break;
		case 'ean':
		case 'jan':
			r = symbol.data.length < 9 ? ean8(symbol) : ean13(symbol);
			break;
		case 'code39':
			r = code39(symbol);
			break;
		case 'itf':
			r = itf(symbol);
			break;
		case 'codabar':
		case 'nw7':
			r = codabar(symbol);
			break;
		case 'code93':
			r = code93(symbol);
			break;
		case 'code128':
			r = code128(symbol);
			break;
		default:
			break;
	}
	return r;
}
