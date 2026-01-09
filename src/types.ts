// Types based on receiptline module definitions
export type Encoding = 'cp437' | 'cp852' | 'cp858' | 'cp860' | 'cp863' | 'cp865' | 'cp866' | 'cp1252' | 'cp932' | 'cp936' | 'cp949' | 'cp950' | 'multilingual' | 'shiftjis' | 'gb18030' | 'ksc5601' | 'big5' | 'tis620';

export type ParsedPrinter = {
	cpl: number;
	charWidth: number;
	encoding: Encoding;
	spacing: boolean;
	margin: number;
	marginRight: number;
	target: BaseTargetInterface;
};

export interface BaseTargetInterface {
	measureText(text: string, encoding: Encoding): number;
	arrayFrom(text: string, encoding: Encoding): string[];
	open(printer: ParsedPrinter): string;
	close(): string;
	area(left: number, width: number, right: number): string;
	align(align: number): string;
	absolute(position: number): string;
	relative(position: number): string;
	hr(width: number): string;
	vr(widths: number[], height: number): string;
	vrstart(widths: number[]): string;
	vrstop(widths: number[]): string;
	vrhr(widths1: number[], widths2: number[], dl: number, dr: number): string;
	vrlf(vr: boolean): string;
	cut(): string;
	ul(): string;
	em(): string;
	iv(): string;
	wh(wh: number): string;
	normal(): string;
	text(text: string, encoding: Encoding): string;
	lf(): string;
	command(command: string): string;
	image(image: string): string;
	qrcode(symbol: QRCode, encoding: Encoding): string;
	barcode(symbol: Barcode, encoding: Encoding): string;
	calculatedWidth(): number;
	calculatedHeight(): number;
};

export type Printer = {
	cpl?: number;
	charWidth?: number;
	encoding?: Encoding;
	spacing?: boolean;
	target?: string | BaseTargetInterface;
	margin?: number;
	marginRight?: number;
	[propName: string]: any;
};

// QR Code is a registered trademark of DENSO WAVE INCORPORATED.
export type QRCode = {
	data: string;
	type: 'qrcode';
	cell: number;
	level: 'l' | 'm' | 'q' | 'h';
	quietZone?: boolean;
};

export type Barcode = {
	data: string;
	type: 'upc' | 'ean' | 'jan' | 'code39' | 'itf' | 'codabar' | 'nw7' | 'code93' | 'code128';
	width: number;
	height: number;
	hri: boolean;
	quietZone?: boolean;
};
