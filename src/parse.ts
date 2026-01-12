import targets from './targets/index.ts';
import { BaseTarget } from './targets/base.ts';
import { SvgTarget } from './targets/svg.ts';
import { HtmlTarget } from './targets/html.ts';
import type { Barcode, Encoding, ParsedPrinter, Printer, QRCode, BaseTargetInterface } from './types.ts';

// QR Code is a registered trademark of DENSO WAVE INCORPORATED.

type ParsedProperty = {
	align?: string;
	border?: string;
	code?: string;
	image?: string;
	option?: string;
	text?: string;
	width?: string;
	command?: string;
	comment?: string;
	[key: string]: string | undefined;
};

type ParsedColumn = {
	align: number; // -1 (left), 0 (center), 1 (center), 2 (right)
	wrap: boolean;
	border: number; // -1 (line), 0 (none), 1 (space), 2
	width: number; // -1 for auto/star, 0 for zero width, positive for fixed width
	alignment: number; // 0 (left), 1 (center), 2 (right)
	text?: string[];
	property?: ParsedProperty;
	code?: Barcode | QRCode;
	image?: string;
	command?: string;
	comment?: string;
	hr?: '-' | '=';
	vr?: '+' | '-';
	error?: string;
};

export type ParseState = {
	wrap: boolean;
	border: number; // -1 (line), 0 (none), 1 (space), 2
	width: number[]; // empty for auto, -1 for star, positive for fixed width
	align: number; // 0 (left), 1 (center), 2 (right)
	option: {
		type: 'upc' | 'ean' | 'jan' | 'code39' | 'itf' | 'codabar' | 'nw7' | 'code93' | 'code128' | 'qrcode';
		width: number;
		height: number;
		hri: boolean;
		cell: number;
		level: 'l' | 'm' | 'q' | 'h';
		quietZone: boolean;
	};
	line: 'waiting' | 'ready' | 'running' | 'horizontal';
	rules: {
		left: number;
		width: number;
		right: number;
		widths: number[];
	};
};

type WrappedTextLine = {
	data: (string | number)[];
	margin: number;
	height: number;
};

/**
 * Validate printer configuration.
 * @param printer printer configuration
 * @returns validated printer configuration
 */
export function parseOption(printer?: Partial<Printer>): ParsedPrinter {
	// validate printer configuration
	const p = Object.assign({}, printer);
	const encoding: Encoding = p.encoding && /^(cp(437|85[28]|86[0356]|1252|93[26]|949|950)|multilingual|shiftjis|gb18030|ksc5601|big5|tis620)$/.test(p.encoding) ? p.encoding : 'cp437';
	const targetKey = typeof p.target === 'string' ? p.target : undefined;
	const targetObj = typeof p.target === 'object' && p.target !== null ? p.target : undefined;
	const untypedTarget = targetObj || (targetKey && targetKey in targets ? targets[targetKey as keyof typeof targets] : targets.svg);
	// Use the target instance directly (caller can configure it or we'll use the singleton)
	let target: BaseTargetInterface;

	if (untypedTarget instanceof HtmlTarget) {
		target = untypedTarget;
	} else if (untypedTarget instanceof SvgTarget) {
		target = untypedTarget;
	} else if (untypedTarget instanceof BaseTarget) {
		target = untypedTarget;
	} else {
		target = new SvgTarget();
	}
	return {
		cpl: p.cpl || 48,
		charWidth: p.charWidth || 12,
		encoding: encoding,
		spacing: !!p.spacing,
		margin: p.margin || 0,
		marginRight: p.marginRight || 0,
		target: target
	};
}

/**
 * Parse lines.
 * @param columns line text without line breaks
 * @param state state variables
 * @returns parsed line object
 */
export function parseLine(columns: string, state: ParseState): ParsedColumn[] {
	// extract columns
	const line: ParsedColumn[] = columns
		// trim whitespace
		.replace(/^[\t ]+|[\t ]+$/g, '')
		// convert escape characters ('\\', '\{', '\|', '\}') to hexadecimal escape characters
		.replace(/\\[\\{|}]/g, match => '\\x' + match.charCodeAt(1).toString(16))
		// append a space if the first column does not start with '|' and is right-aligned
		.replace(/^[^|]*[^\t |]\|/, ' $&')
		// append a space if the last column does not end with '|' and is left-aligned
		.replace(/\|[^\t |][^|]*$/, '$& ')
		// remove '|' at the beginning of the first column
		.replace(/^\|(.*)$/, '$1')
		// remove '|' at the end of the last column
		.replace(/^(.*)\|$/, '$1')
		// separate text with '|'
		.split('|')
		// parse columns
		.map((column, index, array) => {
			// parsed column object
			let result: ParsedColumn = {
				align: 1,
				wrap: state.wrap,
				border: state.border,
				width: 0,
				alignment: state.align
			};
			// trim whitespace
			const element = column.replace(/^[\t ]+|[\t ]+$/g, '');
			// determin alignment from whitespaces around column text
			result.align = 1 + Number(/^[\t ]/.test(column)) - Number(/[\t ]$/.test(column));
			// parse properties
			if (/^\{[^{}]*\}$/.test(element)) {
				// extract members
				result.property = element
					// trim property delimiters
					.slice(1, -1)
					// convert escape character ('\;') to hexadecimal escape characters
					.replace(/\\;/g, '\\x3b')
					// separate property with ';'
					.split(';')
					// parse members
					.reduce((obj: ParsedProperty, member: string) => {
						// abbreviations
						const abbr: Record<string, string> = { a: 'align', b: 'border', c: 'code', i: 'image', o: 'option', t: 'text', w: 'width', x: 'command', _: 'comment' };
						// parse key-value pair
						if (!/^[\t ]*$/.test(member)) {
							const replaced = member.replace(/^[\t ]*([A-Za-z_]\w*)[\t ]*:[\t ]*([^\t ].*?)[\t ]*$/,
								(match: string, key: string, value: string): string => {
									const expandedKey = key.replace(/^[abciotwx_]$/, m => abbr[m] || m);
									obj[expandedKey] = parseEscape(value.replace(/\\n/g, '\n'));
									return match;
								});
							if (replaced === member) {
								// invalid members
								result.error = element;
							}
						}
						return obj;
					}, {} as ParsedProperty);
				// if the column is single
				if (array.length === 1) {
					// parse text property
					if ('text' in result.property && result.property.text) {
						const c = result.property.text.toLowerCase();
						state.wrap = !/^nowrap$/.test(c);
					}
					// parse border property
					if ('border' in result.property && result.property.border) {
						const c = result.property.border.toLowerCase();
						const border: Record<string, number> = { 'line': -1, 'space': 1, 'none': 0 };
						const previous = state.border;
						state.border = /^(line|space|none)$/.test(c) ? (border[c] ?? 1) : /^\d+$/.test(c) && Number(c) <= 2 ? Number(c) : 1;
						// start rules
						if (previous >= 0 && state.border < 0) {
							result.vr = '+';
						}
						// stop rules
						if (previous < 0 && state.border >= 0) {
							result.vr = '-';
						}
					}
					// parse width property
					if ('width' in result.property && result.property.width) {
						const width = result.property.width.toLowerCase().split(/[\t ]+|,/);
						state.width = width.find(c => /^auto$/.test(c)) ? [] : width.map(c => /^\*$/.test(c) ? -1 : /^\d+$/.test(c) ? Number(c) : 0);
					}
					// parse align property
					if ('align' in result.property && result.property.align) {
						const c = result.property.align.toLowerCase();
						const align: Record<string, number> = { 'left': 0, 'center': 1, 'right': 2 };
						state.align = /^(left|center|right)$/.test(c) ? (align[c] ?? 1) : 1;
					}
					// parse option property
					if ('option' in result.property && result.property.option) {
						const option = result.property.option.toLowerCase().split(/[\t ]+|,/);
						state.option = {
							type: (option.find(c => /^(upc|ean|jan|code39|itf|codabar|nw7|code93|code128|qrcode)$/.test(c)) || 'code128') as ParseState['option']['type'],
							width: Number(option.find(c => /^\d+$/.test(c) && Number(c) >= 2 && Number(c) <= 4) || '2'),
							height: Number(option.find(c => /^\d+$/.test(c) && Number(c) >= 24 && Number(c) <= 240) || '72'),
							hri: !!option.find(c => /^hri$/.test(c)),
							cell: Number(option.find(c => /^\d+$/.test(c) && Number(c) >= 3 && Number(c) <= 8) || '3'),
							level: (option.find(c => /^[lmqh]$/.test(c)) || 'l') as 'l' | 'm' | 'q' | 'h',
							quietZone: false
						};
					}
					// parse code property
					if ('code' in result.property && result.property.code) {
						if (state.option.type === 'qrcode') {
							result.code = Object.assign({ data: result.property.code, type: 'qrcode' as const }, state.option) as QRCode;
						} else {
							result.code = Object.assign({ data: result.property.code, type: state.option.type }, state.option) as Barcode;
						}
					}
					// parse image property
					if ('image' in result.property && result.property.image) {
						const c = result.property.image.replace(/=.*|[^A-Za-z0-9+/]/g, '');
						switch (c.length % 4) {
							case 1:
								result.image = c.slice(0, -1);
								break;
							case 2:
								result.image = c + '==';
								break;
							case 3:
								result.image = c + '=';
								break;
							default:
								result.image = c;
								break;
						}
					}
					// parse command property
					if ('command' in result.property && result.property.command) {
						result.command = result.property.command;
					}
					// parse comment property
					if ('comment' in result.property && result.property.comment) {
						result.comment = result.property.comment;
					}
				}
			}
			// remove invalid property delimiter
			else if (/[{}]/.test(element)) {
				result.error = element;
			}
			// parse horizontal rule of special character in text
			else if (array.length === 1 && /^-+$|^=+$/.test(element)) {
				const hrChar = element.slice(-1);
				result.hr = (hrChar === '-' || hrChar === '=') ? hrChar : undefined;
			}
			// parse text
			else {
				result.text = element
					// remove control codes and hexadecimal control codes
					.replace(/[\x00-\x1f\x7f]|\\x[01][\dA-Fa-f]|\\x7[Ff]/g, '')
					// convert escape characters ('\-', '\=', '\_', '\"', \`', '\^', '\~') to hexadecimal escape characters
					.replace(/\\[-=_"`^~]/g, match => '\\x' + match.charCodeAt(1).toString(16))
					// convert escape character ('\n') to LF
					.replace(/\\n/g, '\n')
					// convert escape character ('~') to space
					.replace(/~/g, ' ')
					// separate text with '_', '"', '`', '^'(1 or more), '\n'
					.split(/([_"`\n]|\^+)/)
					// convert escape characters to normal characters
					.map(text => parseEscape(text));
			}
			// set current text wrapping
			result.wrap = state.wrap;
			// set current column border
			result.border = state.border;
			// set current column width
			if (state.width.length === 0) {
				// set '*' for all columns when the width property is 'auto'
				result.width = -1;
			}
			else if ('text' in result) {
				// text: set column width
				result.width = index < state.width.length ? state.width[index] ?? 0 : 0;
			}
			else if (state.width.find(c => c < 0)) {
				// image, code, command: when the width property includes '*', set '*'
				result.width = -1;
			}
			else {
				// image, code, command: when the width property does not include '*', set the sum of column width and border width
				const w = state.width.filter(c => c > 0);
				result.width = w.length > 0 ? w.reduce((a, c) => a + c, result.border < 0 ? w.length + 1 : (w.length - 1) * result.border) : 0;
			}
			// set line alignment
			result.alignment = state.align;
			return result;
		});
	// if the line is text and the width property is not 'auto'
	if (line.every(el => 'text' in el) && state.width.length > 0) {
		// if the line has fewer columns
		while (line.length < state.width.length) {
			// fill empty columns
			line.push({ align: 1, text: [''], wrap: state.wrap, border: state.border, width: state.width[line.length] ?? 0, alignment: state.align });
		}
	}
	return line;
}

/**
 * Parse escape characters.
 * @param chars string containing escape characters
 * @returns unescaped string
 */
function parseEscape(chars: string): string {
	return chars
		// remove invalid escape sequences
		.replace(/\\$|\\x(.?$|[^\dA-Fa-f].|.[^\dA-Fa-f])/g, '')
		// ignore invalid escape characters
		.replace(/\\[^x]/g, '')
		// convert hexadecimal escape characters to normal characters
		.replace(/\\x([\dA-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Wrap text.
 * @param column parsed column object
 * @param printer printer configuration
 * @returns wrapped text, text position, and text height
 */
function wrapText(column: ParsedColumn & { text: string[] }, printer: ParsedPrinter): WrappedTextLine[] {
	const result: WrappedTextLine[] = [];
	// remaining spaces
	let space: number = column.width;
	// text height
	let height: number = 1;
	// text data
	let res: (string | number)[] = [];
	// text decoration flags
	let ul: boolean = false;
	let em: boolean = false;
	let iv: boolean = false;
	let wh: number = 0;
	// process text and text decoration
	column.text.forEach((text: string, i: number) => {
		// process text
		if (i % 2 === 0) {
			// if text is not empty
			let t: string[] = printer.target.arrayFrom(text, printer.encoding);
			while (t.length > 0) {
				// measure character width
				let w: number = 0;
				let j: number = 0;
				while (j < t.length) {
					// Future improvement: somehow load the font glyphs and determine an accurate measurement
					w = printer.target.measureText(t[j] ?? '', printer.encoding) * (wh < 2 ? wh + 1 : wh - 1);
					// output before protruding
					if (w > space) {
						break;
					}
					space -= w;
					w = 0;
					j++;
				}
				// if characters fit
				if (j > 0) {
					// append text decoration information
					res.push((ul ? '1' : '0') + (em ? '1' : '0') + (iv ? '1' : '0') + wh);
					// append text
					res.push(t.slice(0, j).join(''));
					// update text height
					height = Math.max(height, wh < 3 ? wh : wh - 1);
					// remaining text
					t = t.slice(j);
				}
				// if character is too big
				if (w > column.width) {
					// do not output
					t = t.slice(1);
					continue;
				}
				// if there is no spece left
				if (w > space || space === 0) {
					// wrap text automatically
					result.push({ data: res, margin: space * column.align / 2, height: height });
					space = column.width;
					res = [];
					height = 1;
				}
			}
		}
		// process text decoration
		else {
			// update text decoration flags
			switch (text) {
				case '\n':
					// wrap text manually
					result.push({ data: res, margin: space * column.align / 2, height: height });
					space = column.width;
					res = [];
					height = 1;
					break;
				case '_':
					ul = !ul;
					break;
				case '"':
					em = !em;
					break;
				case '`':
					iv = !iv;
					break;
				default:
					const d = Math.min(text.length, 7);
					wh = wh === d ? 0 : d;
					break;
			}
		}
	});
	// output last text
	if (res.length > 0) {
		result.push({ data: res, margin: space * column.align / 2, height: height });
	}
	return result;
}


/**
 * Generate commands from line objects.
 * @param line parsed line object
 * @param printer printer configuration
 * @param state state variables
 * @returns printer command fragment or SVG image fragment
 */
export async function createLine(line: ParsedColumn[], printer: ParsedPrinter, state: ParseState): Promise<string> {
	const result: string[] = [];
	// text or property
	const text: boolean = line.every(el => 'text' in el);
	// the first column
	const column: ParsedColumn = line[0] ?? { align: 1, text: [''], wrap: true, border: 0, width: 0, alignment: 1 };
	// remove zero width columns
	let columns: ParsedColumn[] = line.filter(el => el.width !== 0);
	// remove overflowing columns
	if (text) {
		columns = columns.slice(0, Math.floor(column.border < 0 ? (printer.cpl - 1) / 2 : (printer.cpl + column.border) / (column.border + 1)));
	}
	// fixed columns
	const f: ParsedColumn[] = columns.filter(el => el.width > 0);
	// variable columns
	const g: ParsedColumn[] = columns.filter(el => el.width < 0);
	// reserved width
	let u: number = f.reduce((a, el) => a + el.width, 0);
	// free width
	let v: number = printer.cpl - u;
	// subtract border width from free width
	if (text && columns.length > 0) {
		v -= column.border < 0 ? columns.length + 1 : (columns.length - 1) * column.border;
	}
	// number of variable columns
	const n: number = g.length;
	// reduce the width of fixed columns when reserved width is too many
	while (n > v) {
		const maxWidthCol = f.reduce((a, el) => a.width > el.width ? a : el);
		maxWidthCol.width--;
		v++;
	}
	// allocate free width among variable columns
	if (n > 0) {
		g.forEach((el, i) => el.width = Math.floor((v + i) / n));
		v = 0;
	}
	// print area
	const left: number = Math.floor(v * column.alignment / 2);
	const width: number = printer.cpl - v;
	const right: number = v - left;
	// process text
	if (text) {
		// wrap text
		const cols: WrappedTextLine[][] = columns.map(column => wrapText(column as ParsedColumn & { text: string[] }, printer));
		// vertical line spacing
		const widths: number[] = columns.map(column => column.width);
		// rules
		switch (state.line) {
			case 'ready':
				// append commands to start rules
				result.push(
					await printer.target.normal() +
					await printer.target.area(left, width, right) +
					await printer.target.align(0) +
					await printer.target.vrstart(widths) +
					await printer.target.vrlf(true)
				);
				state.line = 'running';
				break;
			case 'horizontal':
				// append commands to print horizontal rule
				const m: number = left - state.rules.left;
				const w: number = width - state.rules.width;
				const l: number = Math.min(left, state.rules.left);
				const r: number = Math.min(right, state.rules.right);
				result.push(
					await printer.target.normal() +
					await printer.target.area(l, printer.cpl - l - r, r) +
					await printer.target.align(0) +
					await printer.target.vrhr(state.rules.widths, widths, m, m + w) +
					await printer.target.lf()
				);
				state.line = 'running';
				break;
			default:
				break;
		}
		// save parameters to stop rules
		state.rules = { left: left, width: width, right: right, widths: widths };
		// maximum number of wraps
		const row: number = column.wrap ? cols.reduce((a, col) => Math.max(a, col.length), 1) : 1;
		// sort text
		for (let j = 0; j < row; j++) {
			// append commands to set print area and line alignment
			let res: string =
				await printer.target.normal() +
				await printer.target.area(left, width, right) +
				await printer.target.align(0);
			// print position
			let p: number = 0;
			// process vertical rules
			if (state.line === 'running') {
				// maximum height
				const height: number = cols.reduce((a, col) => j < col.length ? Math.max(a, col[j]?.height ?? 1) : a, 1);
				// append commands to print vertical rules
				res +=
					await printer.target.normal() +
					await printer.target.absolute(p++) +
					await printer.target.vr(widths, height);
			}
			// process each column
			for (let i = 0; i < cols.length; i++) {
				const col = cols[i];
				if (!col) continue;
				// append commands to set print position of first column
				res += await printer.target.absolute(p);
				// if wrapped text is not empty
				if (j < col.length) {
					// append commands to align text
					res += await printer.target.relative(col[j]?.margin ?? 0);
					// process text
					const data: (string | number)[] = col[j]?.data ?? [];
					for (let k = 0; k < data.length; k += 2) {
						// append commands to decorate text
						const ul: number = Number(String(data[k])[0]);
						const em: number = Number(String(data[k])[1]);
						const iv: number = Number(String(data[k])[2]);
						const wh: number = Number(String(data[k])[3]);
						res += await printer.target.normal();
						if (ul) {
							res += await printer.target.ul();
						}
						if (em) {
							res += await printer.target.em();
						}
						if (iv) {
							res += await printer.target.iv();
						}
						if (wh) {
							res += await printer.target.wh(wh);
						}
						// append commands to print text
						res += await printer.target.text(String(data[k + 1]), printer.encoding);
					}
				}
				// if wrapped text is empty
				else {
					res += await printer.target.normal() + await printer.target.text(' ', printer.encoding);
				}
				// append commands to set print position of next column
				p += (columns[i]?.width ?? 0) + Math.abs(column.border);
			}
			// append commands to feed new line
			res += await printer.target.lf();
			result.push(res);
		}
	}
	// process horizontal rule or paper cut
	if ('hr' in column) {
		// process paper cut
		if (column.hr === '=') {
			switch (state.line) {
				case 'running':
				case 'horizontal':
					// append commands to stop rules
					result.push(
						await printer.target.normal() +
						await printer.target.area(state.rules.left, state.rules.width, state.rules.right) +
						await printer.target.align(0) +
						await printer.target.vrstop(state.rules.widths) +
						await printer.target.vrlf(false)
					);
					// append commands to cut paper
					result.push(await printer.target.cut());
					// set state to start rules
					state.line = 'ready';
					break;
				default:
					// append commands to cut paper
					result.push(await printer.target.cut());
					break;
			}
		}
		// process horizontal rule
		else {
			switch (state.line) {
				case 'waiting':
					// append commands to print horizontal rule
					result.push(
						await printer.target.normal() +
						await printer.target.area(left, width, right) +
						await printer.target.align(0) +
						await printer.target.hr(width) +
						await printer.target.lf()
					);
					break;
				case 'running':
					// set state to print horizontal rule
					state.line = 'horizontal';
					break;
				default:
					break;
			}
		}
	}
	// process rules
	if ('vr' in column) {
		// start rules
		if (column.vr === '+') {
			state.line = 'ready';
		}
		// stop rules
		else {
			switch (state.line) {
				case 'ready':
					// set state to cancel rules
					state.line = 'waiting';
					break;
				case 'running':
				case 'horizontal':
					// append commands to stop rules
					result.push(
						await printer.target.normal() +
						await printer.target.area(state.rules.left, state.rules.width, state.rules.right) +
						await printer.target.align(0) +
						await printer.target.vrstop(state.rules.widths) +
						await printer.target.vrlf(false)
					);
					state.line = 'waiting';
					break;
				default:
					break;
			}
		}
	}
	// process image
	if ('image' in column && column.image) {
		// append commands to print image
		result.push(
			await printer.target.normal() +
			await printer.target.area(left, width, right) +
			await printer.target.align(column.align) +
			await printer.target.image(column.image)
		);
	}
	// process barcode or 2D code
	if ('code' in column && column.code) {
		// process 2D code
		if (column.code.type === 'qrcode') {
			// append commands to print 2D code
			result.push(
				await printer.target.normal() +
				await printer.target.area(left, width, right) +
				await printer.target.align(column.align) +
				await printer.target.qrcode(column.code, printer.encoding)
			);
		}
		// process barcode
		else {
			// append commands to print barcode
			result.push(
				await printer.target.normal() +
				await printer.target.area(left, width, right) +
				await printer.target.align(column.align) +
				await printer.target.barcode(column.code, printer.encoding)
			);
		}
	}
	// process command
	if ('command' in column && column.command) {
		// append commands to insert commands
		result.push(
			await printer.target.normal() +
			await printer.target.area(left, width, right) +
			await printer.target.align(column.align) +
			await printer.target.command(column.command)
		);
	}
	return result.join('');
}

