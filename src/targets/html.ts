/*
Copyright 2025 Levi Schuck
*/

import { BaseTarget } from './base.ts';
import type { Encoding, ParsedPrinter, QRCode, Barcode } from '../types.ts';
import { generate as generateBarcode, type BarcodeSymbol } from '../barcode.ts';
import { writeHtml, awaitHtmlNode, type HtmlNode, type HtmlStyle, type HtmlElement, type HtmlProps } from '@levischuck/tiny-html';
import { qrCode, EcLevel } from '@levischuck/tiny-qr';
import { toPng } from '@levischuck/tiny-qr-png';
import { decodeBase64, encodeBase64 } from '@levischuck/tiny-encodings';
import { readPngIHDR } from '@levischuck/tiny-png'

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
	charHeight: number = 24; // Default to charWidth * 2, can be overridden
	containerWidth: number = 576;
	estimatedHeight: number = 0;
	lineMargin: number = 0;
	lineAlign: number = 0;
	lineWidth: number = 48;
	lineHeight: number = 1;
	textEncoding: Encoding = 'cp437';
	feedMinimum: number = 24;
	spacing: boolean = false;
	defaultFont: string = "'Courier Prime', monospace";
	actualFontCharacterWidth: number | undefined = undefined;
	private explicitCharHeight: number | undefined = undefined;
	widthSpacingUnit: 'px' | '%' | 'ch' = 'px';

	// DOM building state
	contentNodes: HtmlNode[] = [];
	currentStyles: HtmlStyle = {};
	textScale: number = 1;

	// Line building state - receipt printers queue commands until linefeed
	currentPosition: number = 0;      // Current cursor position in characters
	lineSegments: LineSegment[] = []; // Queued text segments for current line
	pendingVrSvg: HtmlElement | null = null; // Pending vertical rules SVG for overlay with text

	// start printing:
	override async open(printer: ParsedPrinter): Promise<string> {
		await super.open(printer);
		this.charWidth = printer.charWidth;
		// Set charHeight: use explicit value if set, otherwise default to charWidth * 2
		this.charHeight = this.explicitCharHeight ?? (printer.charWidth * 2);
		// Recalculate cpl based on actual font character width if set
		if (this.actualFontCharacterWidth !== undefined && this.actualFontCharacterWidth > 0) {
			this._cpl = Math.floor(printer.cpl * printer.charWidth / this.actualFontCharacterWidth);
		}
		this.containerWidth = printer.cpl * printer.charWidth;
		this.estimatedHeight = 0;
		this.lineMargin = 0;
		this.lineAlign = 0;
		this.lineWidth = this.cpl;
		this.lineHeight = 1;
		this.textEncoding = printer.encoding;
		this.feedMinimum = Number(printer.spacing ? this.charHeight * 1.25 : this.charHeight);
		this.spacing = printer.spacing;
		this.contentNodes = [];
		this.currentStyles = {};
		this.textScale = 1;
		// Reset line building state
		this.currentPosition = 0;
		this.lineSegments = [];
		this.pendingVrSvg = null;
		return '';
	}

	setDefaultFont(font: string): string {
		this.defaultFont = font;
		return this.defaultFont;
	}

	setActualFontCharacterWidth(width: number | undefined): void {
		this.actualFontCharacterWidth = width;
	}

	setCharHeight(height: number | undefined): void {
		this.explicitCharHeight = height;
	}

	setWidthSpacingUnit(unit: 'px' | '%' | 'ch'): void {
		this.widthSpacingUnit = unit;
	}

	/**
	 * Converts a character width to the appropriate CSS unit based on widthSpacingUnit.
	 * @param chars - Width in characters
	 * @returns CSS value string (e.g., "12px", "50%", "12ch")
	 */
	private toWidthUnit(chars: number): string {
		const fontWidth = this.actualFontCharacterWidth ?? this.charWidth;

		switch (this.widthSpacingUnit) {
			case 'px':
				return `${Math.floor(chars * fontWidth)}px`;
			case '%':
				const pxValue = chars * fontWidth;
				const percent = (pxValue / this.containerWidth) * 100;
				return `${percent}%`;
			case 'ch':
			default:
				return `${chars}ch`;
		}
	}

	// finish printing (async to support Promise nodes like QR code PNGs):
	override async close(): Promise<string> {
		// Flush any remaining line content or pending VR
		if (this.lineSegments.length > 0 || this.pendingVrSvg) {
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
			overflow: 'hidden',
			display: 'flex',
			flexDirection: 'column',
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
					marginLeft: this.toWidthUnit(this.lineMargin),
					width: this.toWidthUnit(width),
					height: '0',
					display: 'flex',
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
		const v = this.charHeight * height;
		const totalWidthChars = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;

		// Build SVG path for vertical lines (in charWidth-based coordinates)
		let path = `M${u},0v${v}`;
		for (const width of widths) {
			path += `m${width * w + w},${-v}v${v}`;
		}

		// Use viewBox to map charWidth-based path coordinates to ch-based width
		// This ensures the VR lines align with text columns regardless of actual font width
		const viewBoxWidth = totalWidthChars * w;
		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: this.toWidthUnit(totalWidthChars),
				height: `${v}`,
				viewBox: `0 0 ${viewBoxWidth} ${v}`,
				preserveAspectRatio: 'none',
				style: {
					position: 'absolute',
					top: '0',
					left: this.toWidthUnit(this.lineMargin),
				},
				children: {
					type: 'path',
					props: {
						d: path,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
						'vector-effect': 'non-scaling-stroke',
					},
				} as HtmlElement,
			},
		};

		// Store for overlay with text content at lf()
		this.pendingVrSvg = svgNode;
		return '';
	}

	// start rules:
	override async vrstart(widths: number[]): Promise<string> {
		const w = this.charWidth;
		const totalWidthChars = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;
		const viewBoxWidth = totalWidthChars * w;
		const viewBoxHeight = w * 2; // Path coordinates use charWidth-based units

		const svgPath = this.buildVrStartPath(widths);

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: this.toWidthUnit(totalWidthChars),
				height: `${viewBoxHeight}`,
				viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
				preserveAspectRatio: 'none',
				style: {
					display: 'flex',
					marginLeft: this.toWidthUnit(this.lineMargin),
				},
				children: {
					type: 'path',
					props: {
						d: svgPath,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
						'vector-effect': 'non-scaling-stroke',
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
		const totalWidthChars = widths.reduce((a, wid) => a + wid, 0) + widths.length + 1;
		const viewBoxWidth = totalWidthChars * w;
		const viewBoxHeight = w * 2; // Path coordinates use charWidth-based units

		const svgPath = this.buildVrStopPath(widths);

		const svgNode: HtmlElement = {
			type: 'svg',
			props: {
				width: this.toWidthUnit(totalWidthChars),
				height: `${viewBoxHeight}`,
				viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
				preserveAspectRatio: 'none',
				style: {
					marginLeft: this.toWidthUnit(this.lineMargin),
				},
				children: {
					type: 'path',
					props: {
						d: svgPath,
						fill: 'none',
						stroke: 'black',
						'stroke-width': '2',
						'vector-effect': 'non-scaling-stroke',
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
		const totalWidthChars1 = widths1.reduce((a, wid) => a + wid, 0) + widths1.length + 1;
		const totalWidthChars2 = widths2.reduce((a, wid) => a + wid, 0) + widths2.length + 1;
		const maxWidthChars = Math.max(totalWidthChars1, totalWidthChars2);
		const viewBoxWidth = maxWidthChars * w;
		const viewBoxHeight = w * 2; // Path coordinates use charWidth-based units

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
				width: this.toWidthUnit(maxWidthChars),
				height: `${viewBoxHeight}`,
				viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
				preserveAspectRatio: 'none',
				style: {
					marginLeft: this.toWidthUnit(this.lineMargin + Math.max(-dl, 0)),
				},
				children: [
					{ type: 'path', props: { d: path1, fill: 'none', stroke: 'black', 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke' } } as HtmlElement,
					{ type: 'path', props: { d: path2, fill: 'none', stroke: 'black', 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke' } } as HtmlElement,
				],
			},
		};

		this.contentNodes.push(svgNode);
		return '';
	}

	// set line spacing and feed new line:
	override async vrlf(vr: boolean): Promise<string> {
		this.feedMinimum = Number(!vr && this.spacing ? this.charHeight * 1.25 : this.charHeight);
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
					height: `${this.charHeight}px`,
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
								display: 'flex',
							},
						},
					} as HtmlElement,
				],
			},
		};

		this.contentNodes.push(cutNode);
		this.estimatedHeight += this.charHeight;
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
		this.currentStyles.display = 'flex';
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
		const h = this.lineHeight * this.charHeight;
		const minHeight = Math.max(h, this.feedMinimum);

		// Calculate total width in characters
		const totalWidthChars = this.lineMargin + this.lineWidth;

		// Build flexbox nodes: spacers and segments with width in ch units
		const flexNodes: HtmlNode[] = [];

		if (this.lineSegments.length === 0) {
			// If there's a pending VR but no text, still output the VR
			if (this.pendingVrSvg) {
				const wrapper: HtmlElement = {
					type: 'div',
					props: {
						style: {
							position: 'relative',
							width: `${this.containerWidth}px`,
							height: `${minHeight}px`,
							display: 'flex',
						},
						children: this.pendingVrSvg,
					},
				};
				this.contentNodes.push(wrapper);
				this.pendingVrSvg = null;
				this.estimatedHeight += minHeight;
			}
			// Reset line state for next line
			this.lineHeight = 1;
			this.lineSegments = [];
			this.currentPosition = 0;
			return '';
		} else {
			// Sort segments by position to ensure correct order
			const sortedSegments = [...this.lineSegments].sort((a, b) => a.position - b.position);

			let lastEndPosition = 0;

			// Helper to quantize width to nearest character width
			const quantizeWidth = (widthChars: number): number => {
				return Math.floor(widthChars);
			};

			// Helper to calculate quantized width in the configured unit
			const quantizedWidth = (widthChars: number): string => {
				const quantized = quantizeWidth(widthChars);
				return this.toWidthUnit(quantized);
			};

			// Helper to parse width value from flexBasis string and convert back to character width
			const parseWidthChars = (basis: string): number => {
				const fontWidth = this.actualFontCharacterWidth ?? this.charWidth;

				// Try to parse px, %, or ch
				const pxMatch = basis.match(/^(\d+(?:\.\d+)?)px$/);
				if (pxMatch) {
					return parseFloat(pxMatch[1]!) / fontWidth;
				}

				const percentMatch = basis.match(/^(\d+(?:\.\d+)?)%$/);
				if (percentMatch) {
					const percent = parseFloat(percentMatch[1]!);
					const pxValue = (percent / 100) * this.containerWidth;
					return pxValue / fontWidth;
				}

				const chMatch = basis.match(/^(\d+(?:\.\d+)?)ch$/);
				if (chMatch) {
					return parseFloat(chMatch[1]!);
				}

				return 0;
			};

			for (let i = 0; i < sortedSegments.length; i++) {
				const segment = sortedSegments[i]!;
				const segmentStart = this.lineMargin + segment.position;
				const segmentWidth = segment.charWidth * segment.scale;

				// Merge spacer with previous column if there's a gap
				if (segmentStart > lastEndPosition && flexNodes.length > 0) {
					const spacerWidth = segmentStart - lastEndPosition;
					const lastNode = flexNodes[flexNodes.length - 1] as HtmlElement;

					if (lastNode && lastNode.props && lastNode.props.style && typeof lastNode.props.style === 'object' && !Array.isArray(lastNode.props.style)) {
						const style = lastNode.props.style as HtmlStyle;
						// Get current flexBasis value and add spacer width
						const currentBasis = style.flexBasis as string | undefined;
						if (currentBasis) {
							const currentWidthChars = parseWidthChars(currentBasis);
							const combinedWidthChars = currentWidthChars + spacerWidth;
							style.flexBasis = quantizedWidth(combinedWidthChars);
						} else {
							// No existing basis, just add spacer
							style.flexBasis = quantizedWidth(spacerWidth);
						}
					}
				} else if (segmentStart > lastEndPosition && flexNodes.length === 0) {
					// First element has leading spacer - create initial spacer column
					const spacerWidth = segmentStart - lastEndPosition;
					flexNodes.push({
						type: 'span',
						props: {
							style: {
								flexBasis: quantizedWidth(spacerWidth),
							},
						},
					} as HtmlElement);
				}

				// Add the text segment with quantized width in the configured unit
				const segmentWidthValue = quantizedWidth(segmentWidth);

				// Separate layout styles (for flex cell) from content styles (for text content)
				const layoutStyle: HtmlStyle = {
					flexBasis: segmentWidthValue,
					whiteSpace: 'pre',
				};

				// Content styles should only apply to the text content, not the flex cell
				const hasContentStyles = segment.styles && Object.keys(segment.styles).length > 0;
				const contentStyle = hasContentStyles ? segment.styles : undefined;

				// Create outer flex cell with layout styles
				const outerSpan: HtmlElement = {
					type: 'span',
					props: {
						style: layoutStyle,
						children: hasContentStyles ? {
							// Wrap text in inner span with content styles
							type: 'span',
							props: {
								style: contentStyle,
								children: segment.text,
							},
						} as HtmlElement : segment.text,
					},
				};

				flexNodes.push(outerSpan);

				lastEndPosition = segmentStart + segmentWidth;
			}

			// Merge final spacer with last column if needed
			if (lastEndPosition < totalWidthChars && flexNodes.length > 0) {
				const finalSpacerWidth = totalWidthChars - lastEndPosition;
				const lastNode = flexNodes[flexNodes.length - 1] as HtmlElement;

				if (lastNode && lastNode.props && lastNode.props.style && typeof lastNode.props.style === 'object' && !Array.isArray(lastNode.props.style)) {
					const style = lastNode.props.style as HtmlStyle;
					const currentBasis = style.flexBasis as string | undefined;
					if (currentBasis) {
						const currentWidthChars = parseWidthChars(currentBasis);
						const combinedWidthChars = currentWidthChars + finalSpacerWidth;
						style.flexBasis = quantizedWidth(combinedWidthChars);
					} else {
						style.flexBasis = quantizedWidth(finalSpacerWidth);
					}
				}
			}
		}

		// Create line container with flexbox row layout
		const lineNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'row',
					height: `${minHeight}px`,
					width: this.toWidthUnit(totalWidthChars),
				},
				children: flexNodes,
			},
		};

		// If we have pending VR, wrap in positioned container for overlay
		if (this.pendingVrSvg) {
			const wrapper: HtmlElement = {
				type: 'div',
				props: {
					style: {
						position: 'relative',
						width: `${this.containerWidth}px`,
						minHeight: `${minHeight}px`,
						display: 'flex',
					},
					children: [
						// VR SVG positioned absolutely behind text
						this.pendingVrSvg,
						// Text line positioned relatively on top
						{
							...lineNode,
							props: {
								...lineNode.props,
								style: {
									...(lineNode.props?.style as HtmlStyle),
									position: 'relative',
								},
							},
						} as HtmlElement,
					],
				},
			};
			this.contentNodes.push(wrapper);
			this.pendingVrSvg = null;
		} else {
			this.contentNodes.push(lineNode);
		}
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
		const justifyContent = this.lineAlign === 0 ? 'flex-start' : this.lineAlign === 1 ? 'center' : 'flex-end';

		const imageBytes = decodeBase64(image);
		const metadata = readPngIHDR(imageBytes);
		const width = metadata.width;
		const height = metadata.height;

		const imgNode: HtmlElement = {
			type: 'img',
			props: {
				src: `data:image/png;base64,${image}`,
				style: cleanStyle({
					maxWidth: this.toWidthUnit(this.lineWidth),
				}),
				width: `${width}`,
				height: `${height}`,
			},
		};

		// Wrap in container for alignment
		const containerNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					justifyContent,
					paddingLeft: this.toWidthUnit(this.lineMargin),
					width: this.toWidthUnit(this.lineWidth),
					display: 'flex',
				},
				children: imgNode,
			},
		};

		this.contentNodes.push(containerNode);
		return '';
	}

	// print QR Code (async version using PNG):
	override async qrcode(symbol: QRCode, _encoding: Encoding): Promise<string> {
		const justifyContent = this.lineAlign === 0 ? 'flex-start' : this.lineAlign === 1 ? 'center' : 'flex-end';
		// Generate QR code using tiny-qr
		const qr = qrCode({
			data: symbol.data,
			ec: symbol.level === 'l' ? EcLevel.L : symbol.level === 'm' ? EcLevel.M : symbol.level === 'q' ? EcLevel.Q : EcLevel.H,
		});

		const c = symbol.cell;
		const margin = symbol.quietZone ? 4 : 0;

		// Create a Promise that generates the PNG and returns an img element
		const { bytes, width, height } = await toPng(qr, {
			moduleSize: c,
			margin,
		});

		const base64 = encodeBase64(bytes);

		const qrHtml = {
			type: 'img',
			props: {
				src: `data:image/png;base64,${base64}`,
				width: `${width}`,
				height: `${height}`,
				style: {
					imageRendering: 'pixelated',
				},
			},
		} as HtmlElement;

		// Wrap in container for alignment
		const containerNode: HtmlElement = {
			type: 'div',
			props: {
				style: {
					justifyContent,
					paddingLeft: this.toWidthUnit(this.lineMargin),
					width: this.toWidthUnit(this.lineWidth),
					display: 'flex',
				},
				children: [qrHtml],
			},
		};

		this.contentNodes.push(containerNode);
		this.estimatedHeight += height;
		return '';
	}

	// print barcode:
	override async barcode(symbol: Barcode, _encoding: Encoding): Promise<string> {
		const bar = generateBarcode(symbol as BarcodeSymbol);
		const h = bar.height;
		const justifyContent = this.lineAlign === 0 ? 'flex-start' : this.lineAlign === 1 ? 'center' : 'flex-end';

		if (h !== undefined && 'length' in bar && bar.length !== undefined && bar.widths) {
			const width = bar.length;
			const height = h + (bar.hri ? this.charHeight + 2 : 0);

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
					children: svgChildren,
				},
			};

			// Wrap in container for alignment
			const containerNode: HtmlElement = {
				type: 'div',
				props: {
					style: {
						justifyContent,
						paddingLeft: this.toWidthUnit(this.lineMargin),
						width: this.toWidthUnit(this.lineWidth),
						display: 'flex',
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
