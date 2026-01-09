/*
Copyright 2019 Open Foodservice System Consortium

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { Encoding, ParsedPrinter, QRCode, Barcode, BaseTargetInterface } from '../types.ts';

/**
 * Base target class for ReceiptLine commands.
 */
export class BaseTarget implements BaseTargetInterface {
	/**
	 * Measure text width.
	 * @param {string} text string to measure
	 * @param {string} encoding codepage
	 * @returns {number} string width
	 */
	measureText(text: string, encoding: Encoding): number {
		let r = 0;
		const t = Array.from(text);
		switch (encoding) {
			case 'cp932':
			case 'shiftjis':
				r = t.reduce((a, c) => {
					const d = c.codePointAt(0);
					if (d === undefined) {
						return a;
					}
					return a + (d < 0x80 || d === 0xa0 || d === 0xa5 || d === 0x203e || (d > 0xff60 && d < 0xffa0) ? 1 : 2);
				}, 0);
				break;
			case 'cp936':
			case 'gb18030':
			case 'cp949':
			case 'ksc5601':
			case 'cp950':
			case 'big5':
				r = t.reduce((a, c) => {
					const d = c.codePointAt(0);
					if (d === undefined) {
						return a;
					}
					return a + (d < 0x80 || d === 0xa0 ? 1 : 2);
				}, 0);
				break;
			case 'tis620':
				const a = t.reduce((a, c) => {
					const d = c.codePointAt(0);
					if (d === undefined) {
						return a;
					}
					if (a.consonant) {
						if (d === 0xe31 || d >= 0xe34 && d <= 0xe3a || d === 0xe47) {
							if (a.vowel) {
								a.length += 2;
								a.consonant = a.vowel = a.tone = false;
							}
							else {
								a.vowel = true;
							}
						}
						else if (d >= 0xe48 && d <= 0xe4b) {
							if (a.tone) {
								a.length += 2;
								a.consonant = a.vowel = a.tone = false;
							}
							else {
								a.tone = true;
							}
						}
						else if (d === 0xe33 || d >= 0xe4c && d <= 0xe4e) {
							if (a.vowel || a.tone) {
								a.length += 2;
								a.consonant = a.vowel = a.tone = false;
							}
							else {
								a.length += d === 0xe33 ? 2 : 1;
								a.consonant = false;
							}
						}
						else if (d >= 0xe01 && d <= 0xe2e) {
							a.length++;
							a.vowel = a.tone = false;
						}
						else {
							a.length += 2;
							a.consonant = a.vowel = a.tone = false;
						}
					}
					else if (d >= 0xe01 && d <= 0xe2e) {
						a.consonant = true;
					}
					else {
						a.length++;
					}
					return a;
				}, { length: 0, consonant: false, vowel: false, tone: false });
				if (a.consonant) {
					a.length++;
					a.consonant = a.vowel = a.tone = false;
				}
				r = a.length;
				break;
			default:
				r = t.length;
				break;
		}
		return r;
	}

	/**
	 * Create character array from string (supporting Thai combining characters).
	 * @param {string} text string
	 * @param {string} encoding codepage
	 * @returns {string[]} array instance
	 */
	arrayFrom(text: string, encoding: Encoding): string[] {
		const t = Array.from(text);
		switch (encoding) {
			case 'cp932':
			case 'shiftjis':
				return t.map(c => c.replace(/\\/g, '\xa5').replace(/\u203e/g, '~').replace(/\u301c/g, '\uff5e'));
			case 'tis620':
				const a = t.reduce((a, c) => {
					const d = c.codePointAt(0);
					if (d === undefined) {
						return a;
					}
					if (a.consonant) {
						if (d === 0xe31 || d >= 0xe34 && d <= 0xe3a || d === 0xe47) {
							if (a.vowel) {
								a.result.push(a.consonant + a.vowel + a.tone, c);
								a.consonant = a.vowel = a.tone = '';
							}
							else {
								a.vowel = c;
							}
						}
						else if (d >= 0xe48 && d <= 0xe4b) {
							if (a.tone) {
								a.result.push(a.consonant + a.vowel + a.tone, c);
								a.consonant = a.vowel = a.tone = '';
							}
							else {
								a.tone = c;
							}
						}
						else if (d === 0xe33 || d >= 0xe4c && d <= 0xe4e) {
							if (a.vowel || a.tone) {
								a.result.push(a.consonant + a.vowel + a.tone, c);
								a.consonant = a.vowel = a.tone = '';
							}
							else {
								a.result.push(a.consonant + c);
								a.consonant = '';
							}
						}
						else if (d >= 0xe01 && d <= 0xe2e) {
							a.result.push(a.consonant + a.vowel + a.tone);
							a.consonant = c;
							a.vowel = a.tone = '';
						}
						else {
							a.result.push(a.consonant + a.vowel + a.tone, c);
							a.consonant = a.vowel = a.tone = '';
						}
					}
					else if (d >= 0xe01 && d <= 0xe2e) {
						a.consonant = c;
					}
					else {
						a.result.push(c);
					}
					return a;
				}, { result: [] as string[], consonant: '', vowel: '', tone: '' });
				if (a.consonant) {
					a.result.push(a.consonant + a.vowel + a.tone);
					a.consonant = a.vowel = a.tone = '';
				}
				return a.result;
			default:
				return t;
		}
	}

	/**
	 * Start printing.
	 * @param {object} printer printer configuration
	 * @returns {string} commands
	 */
	open(printer: ParsedPrinter): string {
		return '';
	}

	/**
	 * Finish printing.
	 * @returns {string} commands
	 */
	close(): string {
		return '';
	}

	/**
	 * Set print area.
	 * @param {number} left left margin (unit: characters)
	 * @param {number} width print area (unit: characters)
	 * @param {number} right right margin (unit: characters)
	 * @returns {string} commands
	 */
	area(left: number, width: number, right: number): string {
		return '';
	}

	/**
	 * Set line alignment.
	 * @param {number} align line alignment (0: left, 1: center, 2: right)
	 * @returns {string} commands
	 */
	align(align: number): string {
		return '';
	}

	/**
	 * Set absolute print position.
	 * @param {number} position absolute position (unit: characters)
	 * @returns {string} commands
	 */
	absolute(position: number): string {
		return '';
	}

	/**
	 * Set relative print position.
	 * @param {number} position relative position (unit: characters)
	 * @returns {string} commands
	 */
	relative(position: number): string {
		return '';
	}

	/**
	 * Print horizontal rule.
	 * @param {number} width line width (unit: characters)
	 * @returns {string} commands
	 */
	hr(width: number): string {
		return '';
	}

	/**
	 * Print vertical rules.
	 * @param {number[]} widths vertical line spacing
	 * @param {number} height text height (1-6)
	 * @returns {string} commands
	 */
	vr(widths: number[], height: number): string {
		return '';
	}

	/**
	 * Start rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {string} commands
	 */
	vrstart(widths: number[]): string {
		return '';
	}

	/**
	 * Stop rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {string} commands
	 */
	vrstop(widths: number[]): string {
		return '';
	}

	/**
	 * Print vertical and horizontal rules.
	 * @param {number[]} widths1 vertical line spacing (stop)
	 * @param {number[]} widths2 vertical line spacing (start)
	 * @param {number} dl difference in left position
	 * @param {number} dr difference in right position
	 * @returns {string} commands
	 */
	vrhr(widths1: number[], widths2: number[], dl: number, dr: number): string {
		return '';
	}

	/**
	 * Set line spacing and feed new line.
	 * @param {boolean} vr whether vertical ruled lines are printed
	 * @returns {string} commands
	 */
	vrlf(vr: boolean): string {
		return '';
	}

	/**
	 * Cut paper.
	 * @returns {string} commands
	 */
	cut(): string {
		return '';
	}

	/**
	 * Underline text.
	 * @returns {string} commands
	 */
	ul(): string {
		return '';
	}

	/**
	 * Emphasize text.
	 * @returns {string} commands
	 */
	em(): string {
		return '';
	}

	/**
	 * Invert text.
	 * @returns {string} commands
	 */
	iv(): string {
		return '';
	}

	/**
	 * Scale up text.
	 * @param {number} wh number of special character '^' (1-7)
	 * @returns {string} commands
	 */
	wh(wh: number): string {
		return '';
	}

	/**
	 * Cancel text decoration.
	 * @returns {string} commands
	 */
	normal(): string {
		return '';
	}

	/**
	 * Print text.
	 * @param {string} text string to print
	 * @param {string} encoding codepage
	 * @returns {string} commands
	 */
	text(text: string, encoding: Encoding): string {
		return '';
	}

	/**
	 * Feed new line.
	 * @returns {string} commands
	 */
	lf(): string {
		return '';
	}

	/**
	 * Insert commands.
	 * @param {string} command commands to insert
	 * @returns {string} commands
	 */
	command(command: string): string {
		return '';
	}

	/**
	 * Print image.
	 * @param {string} image image data (base64 png format)
	 * @returns {string} commands
	 */
	image(image: string): string {
		return '';
	}

	/**
	 * Print QR Code.
	 * @param {object} symbol QR Code information (data, type, cell, level)
	 * @param {string} encoding codepage
	 * @returns {string} commands
	 */
	qrcode(symbol: QRCode, encoding: Encoding): string {
		return '';
	}

	/**
	 * Print barcode.
	 * @param {object} symbol barcode information (data, type, width, height, hri)
	 * @param {string} encoding codepage
	 * @returns {string} commands
	 */
	barcode(symbol: Barcode, encoding: Encoding): string {
		return '';
	}

	calculatedWidth(): number {
		return 0;
	}

	calculatedHeight(): number {
		return 0;
	}
}

