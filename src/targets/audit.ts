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

import { BaseTarget } from './base.ts';
import type { Encoding, ParsedPrinter, QRCode, Barcode } from '../types.ts';

/**
 * Audit target class for ReceiptLine commands.
 * Logs all method calls instead of implementing them.
 */
export class AuditTarget extends BaseTarget {
	private logs: string[] = [];

	/**
	 * Start printing.
	 * @param {object} printer printer configuration
	 * @returns {Promise<string>} empty string
	 */
	override async open(printer: ParsedPrinter): Promise<string> {
		await super.open(printer);
		// Reset logs for a fresh audit
		this.logs = [];
		this.logs.push(`open(cpl: ${this.cpl}, charWidth: ${printer.charWidth}, encoding: ${printer.encoding}, spacing: ${printer.spacing}, margin: ${printer.margin}, marginRight: ${printer.marginRight})`);
		return '';
	}

	/**
	 * Finish printing.
	 * @returns {Promise<string>} all logs joined with newlines
	 */
	override async close(): Promise<string> {
		this.logs.push('close');
		return this.logs.join('\n');
	}

	/**
	 * Set print area.
	 * @param {number} left left margin (unit: characters)
	 * @param {number} width print area (unit: characters)
	 * @param {number} right right margin (unit: characters)
	 * @returns {Promise<string>} empty string
	 */
	override async area(left: number, width: number, right: number): Promise<string> {
		this.logs.push(`area(left: ${left}, width: ${width}, right: ${right})`);
		return '';
	}

	/**
	 * Set line alignment.
	 * @param {number} align line alignment (0: left, 1: center, 2: right)
	 * @returns {Promise<string>} empty string
	 */
	override async align(align: number): Promise<string> {
		this.logs.push(`align(${align})`);
		return '';
	}

	/**
	 * Set absolute print position.
	 * @param {number} position absolute position (unit: characters)
	 * @returns {Promise<string>} empty string
	 */
	override async absolute(position: number): Promise<string> {
		this.logs.push(`absolute(${position})`);
		return '';
	}

	/**
	 * Set relative print position.
	 * @param {number} position relative position (unit: characters)
	 * @returns {Promise<string>} empty string
	 */
	override async relative(position: number): Promise<string> {
		this.logs.push(`relative(${position})`);
		return '';
	}

	/**
	 * Print horizontal rule.
	 * @param {number} width line width (unit: characters)
	 * @returns {Promise<string>} empty string
	 */
	override async hr(width: number): Promise<string> {
		this.logs.push(`hr(${width})`);
		return '';
	}

	/**
	 * Print vertical rules.
	 * @param {number[]} widths vertical line spacing
	 * @param {number} height text height (1-6)
	 * @returns {Promise<string>} empty string
	 */
	override async vr(widths: number[], height: number): Promise<string> {
		this.logs.push(`vr(widths: [${widths.join(', ')}], height: ${height})`);
		return '';
	}

	/**
	 * Start rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {Promise<string>} empty string
	 */
	override async vrstart(widths: number[]): Promise<string> {
		this.logs.push(`vrstart([${widths.join(', ')}])`);
		return '';
	}

	/**
	 * Stop rules.
	 * @param {number[]} widths vertical line spacing
	 * @returns {Promise<string>} empty string
	 */
	override async vrstop(widths: number[]): Promise<string> {
		this.logs.push(`vrstop([${widths.join(', ')}])`);
		return '';
	}

	/**
	 * Print vertical and horizontal rules.
	 * @param {number[]} widths1 vertical line spacing (stop)
	 * @param {number[]} widths2 vertical line spacing (start)
	 * @param {number} dl difference in left position
	 * @param {number} dr difference in right position
	 * @returns {Promise<string>} empty string
	 */
	override async vrhr(widths1: number[], widths2: number[], dl: number, dr: number): Promise<string> {
		this.logs.push(`vrhr(widths1: [${widths1.join(', ')}], widths2: [${widths2.join(', ')}], dl: ${dl}, dr: ${dr})`);
		return '';
	}

	/**
	 * Set line spacing and feed new line.
	 * @param {boolean} vr whether vertical ruled lines are printed
	 * @returns {Promise<string>} empty string
	 */
	override async vrlf(vr: boolean): Promise<string> {
		this.logs.push(`vrlf(${vr})`);
		return '';
	}

	/**
	 * Cut paper.
	 * @returns {Promise<string>} empty string
	 */
	override async cut(): Promise<string> {
		this.logs.push('cut');
		return '';
	}

	/**
	 * Underline text.
	 * @returns {Promise<string>} empty string
	 */
	override async ul(): Promise<string> {
		this.logs.push('ul');
		return '';
	}

	/**
	 * Emphasize text.
	 * @returns {Promise<string>} empty string
	 */
	override async em(): Promise<string> {
		this.logs.push('em');
		return '';
	}

	/**
	 * Invert text.
	 * @returns {Promise<string>} empty string
	 */
	override async iv(): Promise<string> {
		this.logs.push('iv');
		return '';
	}

	/**
	 * Scale up text.
	 * @param {number} wh number of special character '^' (1-7)
	 * @returns {Promise<string>} empty string
	 */
	override async wh(wh: number): Promise<string> {
		this.logs.push(`wh(${wh})`);
		return '';
	}

	/**
	 * Cancel text decoration.
	 * @returns {Promise<string>} empty string
	 */
	override async normal(): Promise<string> {
		this.logs.push('normal');
		return '';
	}

	/**
	 * Print text.
	 * @param {string} text string to print
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} empty string
	 */
	override async text(text: string, encoding: Encoding): Promise<string> {
		this.logs.push(`text("${text}", encoding: ${encoding})`);
		return '';
	}

	/**
	 * Feed new line.
	 * @returns {Promise<string>} empty string
	 */
	override async lf(): Promise<string> {
		this.logs.push('lf');
		return '';
	}

	/**
	 * Insert commands.
	 * @param {string} command commands to insert
	 * @returns {Promise<string>} empty string
	 */
	override async command(command: string): Promise<string> {
		this.logs.push(`command("${command}")`);
		return '';
	}

	/**
	 * Print image.
	 * @param {string} image image data (base64 png format)
	 * @returns {Promise<string>} empty string
	 */
	override async image(image: string): Promise<string> {
		const preview = image.length > 50 ? image.substring(0, 50) + '...' : image;
		this.logs.push(`image(base64: ${preview})`);
		return '';
	}

	/**
	 * Print QR Code.
	 * @param {object} symbol QR Code information (data, type, cell, level)
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} empty string
	 */
	override async qrcode(symbol: QRCode, encoding: Encoding): Promise<string> {
		this.logs.push(`qrcode(data: "${symbol.data}", type: ${symbol.type}, cell: ${symbol.cell}, level: ${symbol.level}, encoding: ${encoding})`);
		return '';
	}

	/**
	 * Print barcode.
	 * @param {object} symbol barcode information (data, type, width, height, hri)
	 * @param {string} encoding codepage
	 * @returns {Promise<string>} empty string
	 */
	override async barcode(symbol: Barcode, encoding: Encoding): Promise<string> {
		this.logs.push(`barcode(data: "${symbol.data}", type: ${symbol.type}, width: ${symbol.width}, height: ${symbol.height}, hri: ${symbol.hri}, encoding: ${encoding})`);
		return '';
	}

	override calculatedWidth(): number {
		return 0;
	}

	override calculatedHeight(): number {
		return 0;
	}
}
