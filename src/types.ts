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
	readonly cpl: number;
	lock(timeout?: number): Promise<void>;
	unlock(): void;
	measureText(text: string, encoding: Encoding): number;
	arrayFrom(text: string, encoding: Encoding): string[];
	open(printer: ParsedPrinter): Promise<string>;
	close(): Promise<string>;
	area(left: number, width: number, right: number): Promise<string>;
	align(align: number): Promise<string>;
	absolute(position: number): Promise<string>;
	relative(position: number): Promise<string>;
	column(index: number, start: number, width: number, align: number): Promise<string>;
	hr(width: number): Promise<string>;
	vr(widths: number[], height: number): Promise<string>;
	vrstart(widths: number[]): Promise<string>;
	vrstop(widths: number[]): Promise<string>;
	vrhr(widths1: number[], widths2: number[], dl: number, dr: number): Promise<string>;
	vrlf(vr: boolean): Promise<string>;
	cut(): Promise<string>;
	ul(): Promise<string>;
	em(): Promise<string>;
	iv(): Promise<string>;
	wh(wh: number): Promise<string>;
	normal(): Promise<string>;
	text(text: string, encoding: Encoding): Promise<string>;
	lf(): Promise<string>;
	command(command: string): Promise<string>;
	image(image: string): Promise<string>;
	qrcode(symbol: QRCode, encoding: Encoding): Promise<string>;
	barcode(symbol: Barcode, encoding: Encoding): Promise<string>;
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
