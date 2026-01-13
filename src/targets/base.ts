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
	private locked: boolean = false;
	private lockPromise: Promise<void> | null = null;
	private lockResolve: (() => void) | null = null;
	protected _cpl: number = 48;

	/**
	 * Get characters per line.
	 * @returns {number} characters per line
	 */
	get cpl(): number {
		return this._cpl;
	}

	/**
	 * Lock the target for exclusive use.
	 * @param {number} [timeout] timeout in milliseconds (default: 5000)
	 * @returns {Promise<void>} resolves when lock is acquired
	 * @throws {Error} if timeout occurs
	 */
	async lock(timeout: number = 5000): Promise<void> {
		if (!this.locked) {
			this.locked = true;
			this.lockPromise = new Promise<void>((resolve) => {
				this.lockResolve = resolve;
			});
			return;
		}

		// Wait for unlock with timeout
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => {
			abortController.abort();
		}, timeout);

		try {
			await Promise.race([
				this.lockPromise!,
				new Promise<void>((_, reject) => {
					abortController.signal.addEventListener('abort', () => {
						reject(new Error(`Lock timeout after ${timeout}ms`));
					});
				})
			]);
		} finally {
			clearTimeout(timeoutId);
		}

		// Now acquire the lock
		this.locked = true;
		this.lockPromise = new Promise<void>((resolve) => {
			this.lockResolve = resolve;
		});
	}

	/**
	 * Unlock the target.
	 */
	unlock(): void {
		if (this.locked && this.lockResolve) {
			this.locked = false;
			this.lockResolve();
			this.lockResolve = null;
			this.lockPromise = null;
		}
	}

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
	 * @returns {Promise<string>} commands
	 */
	async open(printer: ParsedPrinter): Promise<string> {
		this._cpl = printer.cpl;
		return '';
	}

	/**
	 * Finish printing.
	 * @returns {Promise<string>} commands
	 */
	async close(): Promise<string> {
		return '';
	}

	/**
	 * Set print area.
	 * @param {number} left left margin (unit: characters)
	 * @param {number} width print area (unit: characters)
	 * @param {number} right right margin (unit: characters)
	 * @returns {Promise<string>} commands
	 */
	async area(left: number, width: number, right: number): Promise<string> {
		return '';
	}

	/**
	 * Set line alignment.
	 * @param {number} align line alignment (0: left, 1: center, 2: right)
	 * @returns {Promise<string>} commands
	 */
	async align(align: number): Promise<string> {
		return '';
	}

	/**
	 * Set absolute print position.
	 * @param {number} position absolute position (unit: characters)
	 * @returns {Promise<string>} commands
	 */
	async absolute(position: number): Promise<string> {
		return '';
	}

	/**
	 * Set relative print position.
	 * @param {number} position relative position (unit: characters)
	 * @returns {Promise<string>} commands
	 */
	async relative(position: number): Promise<string> {
		return '';
	}

	/**
	 * Set column context for text alignment.
	 * @param {number} index column index (0-based)
	 * @param {number} start column start position (unit: characters)
	 * @param {number} width column width (unit: characters)
	 * @param {number} align text alignment within column (0: left, 1: center, 2: right)
	 * @returns {Promise<string>} commands
	 */
	async column(index: number, start: number, width: number, align: number): Promise<string> {
		return '';
	}

	/**
	 * Print horizontal rule.
	 * @param {number} width line width (unit: characters)
	 * @returns {Promise<string>} commands
	 */
	async hr(width: number): Promise<string> {
		return '';
	}

	/**
	 * Print vertical rules.
	 * @param {number[]} widths vertical line spacing
	 * @param {number} height text height (1-6)
	 * @returns {Promise<string>} commands
	 */
	async vr(widths: number[], height: number): Promise<string> {
		return '';
	}

	/**
	 * Start rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {Promise<string>} commands
	 */
	async vrstart(widths: number[]): Promise<string> {
		return '';
	}

	/**
	 * Stop rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {Promise<string>} commands
	 */
	async vrstop(widths: number[]): Promise<string> {
		return '';
	}

	/**
	 * Print vertical and horizontal rules.
	 * @param {number[]} widths1 vertical line spacing (stop)
	 * @param {number[]} widths2 vertical line spacing (start)
	 * @param {number} dl difference in left position
	 * @param {number} dr difference in right position
	 * @returns {Promise<string>} commands
	 */
	async vrhr(widths1: number[], widths2: number[], dl: number, dr: number): Promise<string> {
		return '';
	}

	/**
	 * Set line spacing and feed new line.
	 * @param {boolean} vr whether vertical ruled lines are printed
	 * @returns {Promise<string>} commands
	 */
	async vrlf(vr: boolean): Promise<string> {
		return '';
	}

	/**
	 * Cut paper.
	 * @returns {Promise<string>} commands
	 */
	async cut(): Promise<string> {
		return '';
	}

	/**
	 * Underline text.
	 * @returns {Promise<string>} commands
	 */
	async ul(): Promise<string> {
		return '';
	}

	/**
	 * Emphasize text.
	 * @returns {Promise<string>} commands
	 */
	async em(): Promise<string> {
		return '';
	}

	/**
	 * Invert text.
	 * @returns {Promise<string>} commands
	 */
	async iv(): Promise<string> {
		return '';
	}

	/**
	 * Scale up text.
	 * @param {number} wh number of special character '^' (1-7)
	 * @returns {Promise<string>} commands
	 */
	async wh(wh: number): Promise<string> {
		return '';
	}

	/**
	 * Cancel text decoration.
	 * @returns {Promise<string>} commands
	 */
	async normal(): Promise<string> {
		return '';
	}

	/**
	 * Print text.
	 * @param {string} text string to print
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} commands
	 */
	async text(text: string, encoding: Encoding): Promise<string> {
		return '';
	}

	/**
	 * Feed new line.
	 * @returns {Promise<string>} commands
	 */
	async lf(): Promise<string> {
		return '';
	}

	/**
	 * Insert commands.
	 * @param {string} command commands to insert
	 * @returns {Promise<string>} commands
	 */
	async command(command: string): Promise<string> {
		return '';
	}

	/**
	 * Print image.
	 * @param {string} image image data (base64 png format)
	 * @returns {Promise<string>} commands
	 */
	async image(image: string): Promise<string> {
		return '';
	}

	/**
	 * Print QR Code.
	 * @param {object} symbol QR Code information (data, type, cell, level)
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} commands
	 */
	async qrcode(symbol: QRCode, encoding: Encoding): Promise<string> {
		return '';
	}

	/**
	 * Print barcode.
	 * @param {object} symbol barcode information (data, type, width, height, hri)
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} commands
	 */
	async barcode(symbol: Barcode, encoding: Encoding): Promise<string> {
		return '';
	}

	calculatedWidth(): number {
		return 0;
	}

	calculatedHeight(): number {
		return 0;
	}
}

