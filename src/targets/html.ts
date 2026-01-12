/*
Copyright 2025 Levi Schuck
*/

import { BaseTarget } from './base.ts';
import type { Encoding, ParsedPrinter, QRCode, Barcode } from '../types.ts';
import { generate as generateBarcode, type BarcodeSymbol } from '../barcode.ts';
import { writeHtml, awaitHtmlNode, type HtmlNode, type HtmlStyle, type HtmlElement, type HtmlProps } from '@levischuck/tiny-html';
import { qrCode, EcLevel } from '@levischuck/tiny-qr';
import { toPng } from '@levischuck/tiny-qr-png';
import { encodeBase64 } from '@levischuck/tiny-encodings';

// Helper to filter undefined values from style objects
function cleanStyle(style: Record<string, string | undefined>): HtmlStyle {
	const result: HtmlStyle = {};
	for (const [key, value] of Object.entries(style)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Represents a text segment queued for rendering on a line.
 * Receipt printers accumulate positioning and text commands, then render on linefeed.
 */
interface LineSegment {
	position: number;     // Absolute position in characters where this segment starts
	text: string;         // The text content (already HTML escaped)
	styles: HtmlStyle;    // CSS styles for this segment
	scale: number;        // Horizontal scale factor (affects visual width)
	charWidth: number;    // Width of text in characters (for position calculation)
}

/**
 * HTML target class for ReceiptLine commands.
 * Uses CSS for natural text flow and word wrapping instead of absolute positioning.
 */
export class HtmlTarget extends BaseTarget {
	charWidth: number = 12;
	cpl: number = 48;
	containerWidth: number = 576;
	estimatedHeight: number = 0;
	lineMargin: number = 0;
	lineAlign: number = 0;
	lineWidth: number = 48;
	lineHeight: number = 1;
	textEncoding: Encoding = 'multilingual';
	feedMinimum: number = 24;
	spacing: boolean = false;
	defaultFont: string = 'monospace';

	// DOM building state
	contentNodes: HtmlNode[] = [];
	currentStyles: HtmlStyle = {};
	textScale: number = 1;

	// Line building state - receipt printers queue commands until linefeed
	currentPosition: number = 0;      // Current cursor position in characters
	lineSegments: LineSegment[] = []; // Queued text segments for current line

	// start printing:
	override async open(printer: ParsedPrinter): Promise<string> {
		this.charWidth = printer.charWidth;
		this.cpl = printer.cpl;
		this.containerWidth = printer.cpl * printer.charWidth;
		this.estimatedHeight = 0;
		this.lineMargin = 0;
		this.lineAlign = 0;
		this.lineWidth = printer.cpl;
		this.lineHeight = 1;
		this.textEncoding = printer.encoding;
		this.feedMinimum = Number(printer.charWidth * (printer.spacing ? 2.5 : 2));
		this.spacing = printer.spacing;
		this.contentNodes = [];
		this.currentStyles = {};
		this.textScale = 1;
		// Reset line building state
		this.currentPosition = 0;
		this.lineSegments = [];
		return '';
	}

	setDefaultFont(font: string): string {
		this.defaultFont = font;
		return "'Courier Prime'";
	}

	// finish printing (async to support Promise nodes like QR code PNGs):
	override async close(): Promise<string> {
		// Flush any remaining line content
		if (this.lineSegments.length > 0) {
			await this.lf();
		}

		// Build font family based on encoding
		let fontFamily = `${this.defaultFont}, monospace`;
		let lang: string | undefined;

		switch (this.textEncoding) {
			case 'cp932':
			case 'shiftjis':
				fontFamily = "'BIZ UDGothic', monospace";
				lang = 'ja';
				break;
			case 'cp936':
			case 'gb18030':
				lang = 'zh-Hans';
				break;
			case 'cp949':
			case 'ksc5601':
				lang = 'ko';
				break;
			case 'cp950':
			case 'big5':
				lang = 'zh-Hant';
				break;
			case 'tis620':
				fontFamily = "'Sarabun', monospace";
				lang = 'th';
				break;
		}

		const containerStyle: HtmlStyle = {
			fontFamily,
			fontSize: `${this.charWidth * 2 - 2}px`,
			lineHeight: '1.2',
			width: `${this.containerWidth}px`,
			backgroundColor: 'white',
			color: 'black',
			boxSizing: 'border-box',
			wordWrap: 'break-word',
			overflowWrap: 'break-word',
		};

		const containerProps: HtmlProps = {
			style: containerStyle,
			children: this.contentNodes,
		};

		if (lang) {
			containerProps.lang = lang;
		}

		const container: HtmlElement = {
			type: 'div',
			props: containerProps,
		};

		// Resolve any async nodes (QR code PNGs)
		const resolved = await awaitHtmlNode(container);
		return writeHtml(resolved);
	}

	// set print area:
	override async area(left: number, width: number, _right: number): Promise<string> {
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
		// Move cursor to absolute position in characters
		this.currentPosition = position;
		return '';
	}

	// set relative print position:
	override async relative(position: number): Promise<string> {
		// Move cursor forward by relative amount
		this.currentPosition += position;
		return '';
	}

	// print horizontal rule:
	override async hr(width: number): Promise<string> {
		const hrNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					borderTop: '2px solid black',
					marginLeft: `${this.lineMargin * this.charWidth}px`,
					width: `${width * this.charWidth}px`,
					height: '0',
				},
			},
		};
		this.contentNodes.push(hrNode);
		return '';
	}

	// print vertical rules:
	override async vr(widths: number[], height: number): Promise<string> {
		// For HTML, render vertical rules using SVG for precision
		const w = this.charWidth;
		const u = w / 2;
		const v = (w + w) * height;
		const totalWidth = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;

		// Build SVG path for vertical lines
		let path = `M${u},0v${v}`;
		let pos = w;
		for (const width of widths) {
			pos += width * w;
			path += `m${width * w + w},${-v}v${v}`;
		}

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: `${totalWidth * w}`,
				height: `${v}`,
				style: {
					display: 'block',
					marginLeft: `${this.lineMargin * w}px`,
				},
				children: {
					type: 'path',
					props: {
						d: path,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
					},
				} as HtmlElement,
			},
		};

		this.contentNodes.push(svgNode);
		return '';
	}

	// start rules:
	override async vrstart(widths: number[]): Promise<string> {
		const w = this.charWidth;
		const u = w / 2;
		const totalWidth = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;

		const svgPath = this.buildVrStartPath(widths);

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: `${totalWidth * w}`,
				height: `${w * 2}`,
				style: {
					display: 'block',
					marginLeft: `${this.lineMargin * w}px`,
				},
				children: {
					type: 'path',
					props: {
						d: svgPath,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
					},
				} as HtmlElement,
			},
		};

		this.contentNodes.push(svgNode);
		return '';
	}

	private buildVrStartPath(widths: number[]): string {
		const w = this.charWidth;
		const u = w / 2;
		let path = `M${u},${w + w}v${-u}q0,${-u},${u},${-u}`;

		for (let i = 0; i < widths.length; i++) {
			const width = widths[i] ?? 0;
			path += `h${w * width}h${u}v${w}m0,${-w}h${u}`;
		}

		// Replace last segment with curved end
		path = path.replace(/h\d+v\d+m0,-\d+h\d+$/, `q${u},0,${u},${u}v${u}`);
		return path;
	}

	// stop rules:
	override async vrstop(widths: number[]): Promise<string> {
		const w = this.charWidth;
		const totalWidth = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;

		const svgPath = this.buildVrStopPath(widths);

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: `${totalWidth * w}`,
				height: `${w * 2}`,
				style: {
					display: 'block',
					marginLeft: `${this.lineMargin * w}px`,
				},
				children: {
					type: 'path',
					props: {
						d: svgPath,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
					},
				} as HtmlElement,
			},
		};

		this.contentNodes.push(svgNode);
		return '';
	}

	private buildVrStopPath(widths: number[]): string {
		const w = this.charWidth;
		const u = w / 2;
		let path = `M${u},0v${u}q0,${u},${u},${u}`;

		for (let i = 0; i < widths.length; i++) {
			const width = widths[i] ?? 0;
			path += `h${w * width}h${u}v${-w}m0,${w}h${u}`;
		}

		// Replace last segment with curved end
		path = path.replace(/h\d+v-\d+m0,\d+h\d+$/, `q${u},0,${u},${-u}v${-u}`);
		return path;
	}

	// print vertical and horizontal rules:
	override async vrhr(widths1: number[], widths2: number[], dl: number, dr: number): Promise<string> {
		const w = this.charWidth;
		const u = w / 2;

		// Build the complex path for rule transitions
		const totalWidth1 = widths1.reduce((a, wid) => a + wid, 0) + widths1.length + 1;
		const totalWidth2 = widths2.reduce((a, wid) => a + wid, 0) + widths2.length + 1;
		const maxWidth = Math.max(totalWidth1, totalWidth2);

		// Path 1 (top)
		let path1 = `M${u},0` + (dl > 0 ? `v${u}q0,${u},${u},${u}` : `v${w}h${u}`);
		for (const width of widths1) {
			path1 += `h${w * width}h${u}v${-w}m0,${w}h${u}`;
		}
		path1 = path1.replace(/h\d+v-\d+m0,\d+h\d+$/, dr < 0 ? `q${u},0,${u},${-u}v${-u}` : `h${u}v${-w}`);

		// Path 2 (bottom)
		let path2 = `M${u},${w + w}` + (dl < 0 ? `v${-u}q0,${-u},${u},${-u}` : `v${-w}h${u}`);
		for (const width of widths2) {
			path2 += `h${w * width}h${u}v${w}m0,${-w}h${u}`;
		}
		path2 = path2.replace(/h\d+v\d+m0,-\d+h\d+$/, dr > 0 ? `q${u},0,${u},${u}v${u}` : `h${u}v${w}`);

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: `${maxWidth * w}`,
				height: `${w * 2}`,
				style: {
					display: 'block',
					marginLeft: `${(this.lineMargin + Math.max(-dl, 0)) * w}px`,
				},
				children: [
					{ type: 'path', props: { d: path1, fill: 'none', stroke: 'black', 'stroke-width': '2' } } as HtmlElement,
					{ type: 'path', props: { d: path2, fill: 'none', stroke: 'black', 'stroke-width': '2' } } as HtmlElement,
				],
			},
		};

		this.contentNodes.push(svgNode);
		return '';
	}

	// set line spacing and feed new line:
	override async vrlf(vr: boolean): Promise<string> {
		this.feedMinimum = Number(this.charWidth * (!vr && this.spacing ? 2.5 : 2));
		return await this.lf();
	}

	// cut paper:
	override async cut(): Promise<string> {
		const cutNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					display: 'flex',
					alignItems: 'center',
					height: `${this.charWidth * 2}px`,
					marginTop: '4px',
					marginBottom: '4px',
				},
				children: [
					// Scissors icon (simple representation)
					{
						type: 'span',
						props: {
							style: {
								fontSize: '16px',
								marginRight: '8px',
							},
							children: '\u2702', // Scissors unicode
						},
					} as HtmlElement,
					// Dashed line
					{
						type: 'div',
						props: {
							style: {
								flex: '1',
								borderTop: '2px dashed black',
							},
						},
					} as HtmlElement,
				],
			},
		};

		this.contentNodes.push(cutNode);
		this.estimatedHeight += this.charWidth * 2;
		return '';
	}

	// underline text:
	override async ul(): Promise<string> {
		this.currentStyles.textDecoration = 'underline';
		return '';
	}

	// emphasize text:
	override async em(): Promise<string> {
		this.currentStyles.fontWeight = 'bold';
		return '';
	}

	// invert text:
	override async iv(): Promise<string> {
		this.currentStyles.backgroundColor = 'black';
		this.currentStyles.color = 'white';
		return '';
	}

	// scale up text:
	override async wh(wh: number): Promise<string> {
		const w = wh < 2 ? wh + 1 : wh - 1;
		const h = wh < 3 ? wh : wh - 1;
		this.currentStyles.fontSize = `${h}em`;
		this.currentStyles.display = 'inline-block';
		if (w !== h) {
			this.currentStyles.transform = `scaleX(${w / h})`;
			this.currentStyles.transformOrigin = 'left';
		}
		this.lineHeight = Math.max(this.lineHeight, h);
		this.textScale = w;
		return '';
	}

	// cancel text decoration:
	override async normal(): Promise<string> {
		this.currentStyles = {};
		this.textScale = 1;
		return '';
	}

	// print text:
	override async text(text: string, encoding: Encoding): Promise<string> {
		// Escape HTML entities
		const escaped = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/ /g, '\u00A0'); // Non-breaking spaces for receipt formatting

		// Measure text width in characters (accounting for encoding)
		const textWidth = this.measureText(text, encoding);

		// Queue the segment with its position
		const segment: LineSegment = {
			position: this.currentPosition,
			text: escaped,
			styles: { ...this.currentStyles },
			scale: this.textScale,
			charWidth: textWidth,
		};
		this.lineSegments.push(segment);

		// Advance cursor by the visual width (text width * horizontal scale)
		this.currentPosition += textWidth * this.textScale;
		return '';
	}

	// feed new line:
	override async lf(): Promise<string> {
		const h = this.lineHeight * this.charWidth * 2;
		const minHeight = Math.max(h, this.feedMinimum);

		// Build positioned spans for each text segment
		const segmentNodes: HtmlNode[] = this.lineSegments.map(segment => {
			const leftPx = (this.lineMargin + segment.position) * this.charWidth;

			const spanStyle: HtmlStyle = {
				position: 'absolute',
				left: `${leftPx}px`,
				whiteSpace: 'pre',
				...segment.styles,
			};

			return {
				type: 'span',
				props: {
					style: spanStyle,
					children: segment.text,
				},
			} as HtmlElement;
		});

		// Create line container with relative positioning
		const lineNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					position: 'relative',
					minHeight: `${minHeight}px`,
					width: `${(this.lineMargin + this.lineWidth) * this.charWidth}px`,
				},
				children: segmentNodes.length > 0 ? segmentNodes : '\u00A0',
			},
		};

		this.contentNodes.push(lineNode);
		this.estimatedHeight += minHeight;

		// Reset line state for next line
		this.lineHeight = 1;
		this.lineSegments = [];
		this.currentPosition = 0;
		return '';
	}

	// insert commands:
	override async command(_command: string): Promise<string> {
		// Custom commands not supported in HTML output
		return '';
	}

	// print image:
	override async image(image: string): Promise<string> {
		// Image is provided as base64 PNG
		const textAlign = this.lineAlign === 0 ? 'left' : this.lineAlign === 1 ? 'center' : 'right';

		const imgNode: HtmlElement = {
			type: 'img',
			props: {
				src: `data:image/png;base64,${image}`,
				style: cleanStyle({
					display: 'block',
					maxWidth: `${this.lineWidth * this.charWidth}px`,
				}),
			},
		};

		// Wrap in container for alignment
		const containerNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					textAlign,
					paddingLeft: `${this.lineMargin * this.charWidth}px`,
					width: `${this.lineWidth * this.charWidth}px`,
				},
				children: imgNode,
			},
		};

		this.contentNodes.push(containerNode);
		return '';
	}

	// print QR Code (async version using PNG):
	override async qrcode(symbol: QRCode, _encoding: Encoding): Promise<string> {
		// Generate QR code using tiny-qr
		const qr = qrCode({
			data: symbol.data,
			ec: symbol.level === 'l' ? EcLevel.L : symbol.level === 'm' ? EcLevel.M : symbol.level === 'q' ? EcLevel.Q : EcLevel.H,
		});

		const c = symbol.cell;
		const margin = symbol.quietZone ? 4 : 0;

		// Create a Promise that generates the PNG and returns an img element
		const qrPromise: Promise<HtmlNode> = (async () => {
			const { bytes, width, height } = await toPng(qr, {
				moduleSize: c,
				margin,
			});

			const base64 = encodeBase64(bytes);

			return {
				type: 'img',
				props: {
					src: `data:image/png;base64,${base64}`,
					width: `${width}`,
					height: `${height}`,
					style: {
						display: 'block',
						imageRendering: 'pixelated',
					},
				},
			} as HtmlElement;
		})();

		// Wrap in container for alignment
		const textAlign = this.lineAlign === 0 ? 'left' : this.lineAlign === 1 ? 'center' : 'right';
		const containerNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					textAlign,
					paddingLeft: `${this.lineMargin * this.charWidth}px`,
					width: `${this.lineWidth * this.charWidth}px`,
				},
				children: qrPromise, // Promise will be resolved by awaitHtmlNode
			},
		};

		this.contentNodes.push(containerNode);
		const size = (qr.width + margin * 2) * c;
		this.estimatedHeight += size;
		return '';
	}

	// print barcode:
	override async barcode(symbol: Barcode, _encoding: Encoding): Promise<string> {
		const bar = generateBarcode(symbol as BarcodeSymbol);
		const h = bar.height;

		if (h !== undefined && 'length' in bar && bar.length !== undefined && bar.widths) {
			const width = bar.length;
			const height = h + (bar.hri ? this.charWidth * 2 + 2 : 0);

			// Build SVG path for barcode
			let path = '';
			bar.widths.reduce((p, w, i) => {
				if (i % 2 === 1) {
					path += `M${p},0h${w}v${h}h${-w}z`;
				}
				return p + w;
			}, 0);

			const svgChildren: HtmlNode[] = [
				{
					type: 'path',
					props: {
						d: path,
						fill: 'black',
					},
				} as HtmlElement,
			];

			// Add human-readable text if requested
			if (bar.hri && bar.text) {
				svgChildren.push({
					type: 'text',
					props: {
						x: `${width / 2}`,
						y: `${height}`,
						'text-anchor': 'middle',
						'font-family': 'monospace',
						'font-size': `${this.charWidth * 2}`,
						fill: 'black',
						children: bar.text,
					},
				} as HtmlElement);
			}

			const svgNode: HtmlElement = {
				type: 'svg',
				props: {
					width: `${width}`,
					height: `${height}`,
					viewBox: `0 0 ${width} ${height}`,
					style: {
						display: 'block',
					},
					children: svgChildren,
				},
			};

			// Wrap in container for alignment
			const textAlign = this.lineAlign === 0 ? 'left' : this.lineAlign === 1 ? 'center' : 'right';
			const containerNode: HtmlElement = {
				type: 'div',
				props: {
					style: {
						textAlign,
						paddingLeft: `${this.lineMargin * this.charWidth}px`,
						width: `${this.lineWidth * this.charWidth}px`,
					},
					children: svgNode,
				},
			};

			this.contentNodes.push(containerNode);
			this.estimatedHeight += height;
		}

		return '';
	}

	override calculatedWidth(): number {
		return this.containerWidth;
	}

	override calculatedHeight(): number {
		return this.estimatedHeight;
	}
}
