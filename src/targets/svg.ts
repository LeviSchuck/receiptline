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
import { generate as generateBarcode, type BarcodeSymbol } from '../barcode.ts';
import { decodeBase64, encodeBase64 } from '@levischuck/tiny-encodings';
import { EcLevel, qrCode } from "@levischuck/tiny-qr"
import { toSvgString } from "@levischuck/tiny-qr-svg"

/**
 * SVG target class for ReceiptLine commands.
 */
export class SvgTarget extends BaseTarget {
	charWidth: number = 12;
	receiptId: string = '';
	svgWidth: number = 576;
	svgHeight: number = 0;
	svgContent: string = '';
	lineMargin: number = 0;
	lineAlign: number = 0;
	lineWidth: number = 48;
	lineHeight: number = 1;
	textElement: string = '';
	textAttributes: Record<string, string> = {};
	textPosition: number = 0;
	textScale: number = 1;
	textEncoding: Encoding = 'multilingual';
	feedMinimum: number = 24;
	// printer configuration
	spacing: boolean = false;
	defaultFont: string = 'monospace';
	fontSize: number = 12;

	// start printing:
	override async open(printer: ParsedPrinter): Promise<string> {
		await super.open(printer);
		this.receiptId = crypto.randomUUID();
		this.charWidth = printer.charWidth;
		this.svgWidth = this.cpl * printer.charWidth;
		this.svgHeight = 0;
		this.svgContent = '';
		this.lineMargin = 0;
		this.lineAlign = 0;
		this.lineWidth = this.cpl;
		this.lineHeight = 1;
		this.textElement = '';
		this.textAttributes = {};
		this.textPosition = 0;
		this.textScale = 1;
		this.textEncoding = printer.encoding;
		this.feedMinimum = Number(printer.charWidth * (printer.spacing ? 2.5 : 2));
		this.spacing = printer.spacing;
		return '';
	}

	setDefaultFont(font: string): string {
		this.defaultFont = font;
		return "'Courier Prime'";
	}

	// finish printing:
	override async close(): Promise<string> {
		const p = { font: 'monospace', size: this.charWidth * 2, style: '', lang: '' };
		switch (this.textEncoding) {
			case 'cp932':
			case 'shiftjis':
				p.font = `'BIZ UDGothic', monospace`;
				p.lang = 'ja';
				break;
			case 'cp936':
			case 'gb18030':
				p.size -= 2;
				p.lang = 'zh-Hans';
				break;
			case 'cp949':
			case 'ksc5601':
				p.size -= 2;
				p.lang = 'ko';
				break;
			case 'cp950':
			case 'big5':
				p.size -= 2;
				p.lang = 'zh-Hant';
				break;
			case 'tis620':
				p.font = `'Sarabun', monospace`;
				p.size -= 4;
				p.lang = 'th';
				break;
			default:
				p.font = `${this.defaultFont},  monospace`;
				p.size -= 2;
				break;
		}
		if (p.style.length > 0) {
			p.style = `<style type="text/css"><![CDATA[${p.style}]]></style>`;
		}
		if (p.lang.length > 0) {
			p.lang = ` xml:lang="${p.lang}"`;
		}
		this.fontSize = p.size;
		const width = this.calculatedWidth();
		const height = this.calculatedHeight();
		return `<svg width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" ` +
			`xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">${p.style}` +
			`<defs><filter id="receipt-${this.receiptId}" x="0" y="0" width="100%" height="100%"><feFlood flood-color="#000"/><feComposite in2="SourceGraphic" operator="out"/></filter></defs>` +
			`<rect width="100%" height="100%" fill="white" />` +
			`<g font-family="${p.font}" fill="#000" font-size="${p.size}" dominant-baseline="text-after-edge" text-anchor="middle"${p.lang}>${this.svgContent}</g></svg>\n`;
	}

	// set print area:
	override async area(left: number, width: number, right: number): Promise<string> {
		this.lineMargin = left;
		this.lineWidth = width;
		return '';
	}

	// set line alignment:
	override async align(align: number): Promise<string> {
		this.lineAlign = align;
		return '';
	}

	// set absolute print position:
	override async absolute(position: number): Promise<string> {
		this.textPosition = position;
		return '';
	}

	// set relative print position:
	override async relative(position: number): Promise<string> {
		this.textPosition += position;
		return '';
	}

	// print horizontal rule:
	override async hr(width: number): Promise<string> {
		const w = this.charWidth;
		const path = `<path d="M0,${w}h${w * width}" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
		return '';
	}

	// print vertical rules:
	override async vr(widths: number[], height: number): Promise<string> {
		const w = this.charWidth, u = w / 2, v = (w + w) * height;
		const path = `<path d="` + widths.reduce((a, width) => a + `m${w * width + w},${-v}v${v}`, `M${u},0v${v}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
		return '';
	}

	// start rules:
	override async vrstart(widths: number[]): Promise<string> {
		const w = this.charWidth, u = w / 2;
		const path = `<path d="` + widths.reduce((a, width) => a + `h${w * width}h${u}v${w}m0,${-w}h${u}`, `M${u},${w + w}v${-u}q0,${-u},${u},${-u}`).replace(/h\d+v\d+m0,-\d+h\d+$/, `q${u},0,${u},${u}v${u}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
		return '';
	}

	// stop rules:
	override async vrstop(widths: number[]): Promise<string> {
		const w = this.charWidth, u = w / 2;
		const path = `<path d="` + widths.reduce((a, width) => a + `h${w * width}h${u}v${-w}m0,${w}h${u}`, `M${u},0v${u}q0,${u},${u},${u}`).replace(/h\d+v-\d+m0,\d+h\d+$/, `q${u},0,${u},${-u}v${-u}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
		return '';
	}

	// print vertical and horizontal rules:
	override async vrhr(widths1: number[], widths2: number[], dl: number, dr: number): Promise<string> {
		const w = this.charWidth, u = w / 2;
		const path1 = `<path d="` + widths1.reduce((a, width) => a + `h${w * width}h${u}v${-w}m0,${w}h${u}`, `M${u},0` + (dl > 0 ? `v${u}q0,${u},${u},${u}` : `v${w}h${u}`)).replace(/h\d+v-\d+m0,\d+h\d+$/, dr < 0 ? `q${u},0,${u},${-u}v${-u}` : `h${u}v${-w}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${(this.lineMargin + Math.max(-dl, 0)) * w},${this.svgHeight})">${path1}</g>`;
		const path2 = `<path d="` + widths2.reduce((a, width) => a + `h${w * width}h${u}v${w}m0,${-w}h${u}`, `M${u},${w + w}` + (dl < 0 ? `v${-u}q0,${-u},${u},${-u}` : `v${-w}h${u}`)).replace(/h\d+v\d+m0,-\d+h\d+$/, dr > 0 ? `q${u},0,${u},${u}v${u}` : `h${u}v${w}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
		this.svgContent += `<g transform="translate(${(this.lineMargin + Math.max(dl, 0)) * w},${this.svgHeight})">${path2}</g>`;
		return '';
	}

	// set line spacing and feed new line:
	override async vrlf(vr: boolean): Promise<string> {
		this.feedMinimum = Number(this.charWidth * (!vr && this.spacing ? 2.5 : 2));
		return await this.lf();
	}

	// cut paper:
	override async cut(): Promise<string> {
		const path = `<path d="M12,12.5l-7.5,-3a2,2,0,1,1,.5,0M12,11.5l-7.5,3a2,2,0,1,0,.5,0" fill="none" stroke="#000" stroke-width="1"/><path d="M12,12l10,-4q-1,-1,-2.5,-1l-10,4v2l10,4q1.5,0,2.5,-1z" fill="#000"/><path d="M24,12h${this.svgWidth - 24}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="2"/>`;
		this.svgContent += `<g transform="translate(0,${this.svgHeight})">${path}</g>`;
		return await this.lf();
	}

	// underline text:
	override async ul(): Promise<string> {
		this.textAttributes['text-decoration'] = 'underline';
		return '';
	}

	// emphasize text:
	override async em(): Promise<string> {
		this.textAttributes.stroke = '#000';
		return '';
	}

	// invert text:
	override async iv(): Promise<string> {
		this.textAttributes.filter = `url(#receipt-${this.receiptId})`;
		return '';
	}

	// scale up text:
	override async wh(wh: number): Promise<string> {
		const w = wh < 2 ? wh + 1 : wh - 1;
		const h = wh < 3 ? wh : wh - 1;
		this.textAttributes.transform = `scale(${w},${h})`;
		this.lineHeight = Math.max(this.lineHeight, h);
		this.textScale = w;
		return '';
	}

	// cancel text decoration:
	override async normal(): Promise<string> {
		this.textAttributes = {};
		this.textScale = 1;
		return '';
	}

	// print text:
	override async text(text: string, encoding: Encoding): Promise<string> {
		let p = this.textPosition;
		const tspan = this.arrayFrom(text, encoding).reduce((a, c) => {
			const q = this.measureText(c, encoding) * this.textScale;
			const r = Math.floor((p + q / 2) * this.charWidth / this.textScale);
			p += q;
			return a + `<tspan x="${r}">${c.replace(/[ &<>]/g, (r: string) => ({ ' ': '&#xa0;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[r] || r))}</tspan>`;
		}, '');
		const attr = Object.keys(this.textAttributes).reduce((a, key) => a + ` ${key}="${this.textAttributes[key]}"`, '');
		this.textElement += `<text${attr}>${tspan}</text>`;
		this.textPosition += this.measureText(text, encoding) * this.textScale;
		return '';
	}

	// feed new line:
	override async lf(): Promise<string> {
		const h = this.lineHeight * this.charWidth * 2;
		if (this.textElement.length > 0) {
			this.svgContent += `<g transform="translate(${this.lineMargin * this.charWidth},${this.svgHeight + h})">${this.textElement}</g>`;
		}
		this.svgHeight += Math.max(h, this.feedMinimum);
		this.lineHeight = 1;
		this.textElement = '';
		this.textPosition = 0;
		return '';
	}

	// insert commands:
	override async command(command: string): Promise<string> {
		return '';
	}

	// print image:
	override async image(image: string): Promise<string> {
		const pngBytes = decodeBase64(image);
		const dataView = new DataView(pngBytes.buffer);
		// Without knowing the actual PNG spec, I feel this is particularly brittle.
		const imgWidth = dataView.getUint32(16, false);
		const imgHeight = dataView.getUint32(20, false);
		const imgData = `<image href="data:image/png;base64,${encodeBase64(pngBytes)}" x="0" y="0" width="${imgWidth}" height="${imgHeight}"/>`;
		const margin = Math.floor(this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - imgWidth) * this.lineAlign / 2);
		this.svgContent += `<g transform="translate(${margin},${this.svgHeight})">${imgData}</g>`;
		this.svgHeight += imgHeight;
		return '';
	}

	// print QR Code:
	override async qrcode(symbol: QRCode, _encoding: Encoding): Promise<string> {
		// Use QR code library to calculate the 2D matrix
		// But don't use it for the SVG generation...
		// It assumes an upfront width and height... we need perfect pixel size based on the cell size.
		const qrcode = qrCode({
			data: symbol.data,
			ec: symbol.level == 'l' ? EcLevel.L : symbol.level == 'm' ? EcLevel.M : symbol.level == 'q' ? EcLevel.Q : EcLevel.H,
		});
		const h = qrcode.width;
		const c = symbol.cell;

		const result = await toSvgString(qrcode, {
			moduleSize: c,
			margin: symbol.quietZone ? 4 : 0,
			output: 'path'
		});
		// Extract the path string - handle both string and object responses
		const path = typeof result === 'string' ? result : (result as any).path || (result as any).svg || String(result);
		const qrWidth = h * c + (symbol.quietZone ? 8 : 0);
		const margin = Math.floor(this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - qrWidth) * this.lineAlign / 2);
		const y = Math.floor(this.svgHeight);
		this.svgContent += `<g transform="translate(${margin},${y})" shape-rendering="crispEdges">
			<path d="${path}" stroke="transparent" fill="black" shape-rendering="crispEdges" />
		</g>`;
		this.svgHeight += qrWidth;
		return '';
	}

	// print barcode:
	override async barcode(symbol: Barcode, encoding: Encoding): Promise<string> {
		const bar = generateBarcode(symbol as BarcodeSymbol);
		const h = bar.height;
		if (h !== undefined && 'length' in bar && bar.length !== undefined && bar.widths) {
			const width = bar.length;
			const height = h + (bar.hri ? this.charWidth * 2 + 2 : 0);
			// draw barcode
			let path = `<path d="`;
			bar.widths.reduce((p, w, i) => {
				if (i % 2 === 1) {
					path += `M${p},${0}h${w}v${h}h${-w}z`;
				}
				return p + w;
			}, 0);
			path += '" fill="#000"/>';
			// draw human readable interpretation
			if (bar.hri && bar.text) {
				const m = Math.floor((width - (this.measureText(bar.text, encoding) - 1) * this.charWidth) / 2);
				const tspan = this.arrayFrom(bar.text, encoding).reduce((a, c, i) => a + `<tspan x="${m + this.charWidth * i}">${c.replace(/[ &<>]/g, (r: string) => ({ ' ': '&#xa0;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[r] || r))}</tspan>`, '');
				path += `<text y="${height}">${tspan}</text>`;
			}
			const margin = Math.floor(this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - width) * this.lineAlign / 2);
			this.svgContent += `<g transform="translate(${margin},${this.svgHeight})">${path}</g>`;
			this.svgHeight += height;
		}
		return '';
	}

	override calculatedWidth(): number {
		return this.svgWidth;
	}

	override calculatedHeight(): number {
		// Account for the descenders of the text
		return this.svgHeight + this.fontSize / 2;
	}
}

