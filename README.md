# ReceiptLine

Markdown for receipts. Printable digital receipts. &#x1f9fe;
Generate receipt printer commands, SVG images, and HTML documents.

ReceiptLine is the receipt description language that expresses the output image of small roll paper.
It supports printing paper receipts using a receipt printer and displaying electronic receipts on a POS system or smartphone.
It can be described simply with receipt markdown text data that does not depend on the paper width.

# Installation

```bash
$ npm install @levischuck/receiptline
```

# Usage

`receiptline.transform()` method transforms ReceiptLine document to printer commands, SVG images, or HTML documents.

```javascript
import { transform, SvgTarget, HtmlTarget } from "@levischuck/receiptline";

const body = `Example Receipt
(Merchant Copy)
---

{w: * 4 8}
{b:line}
||Product | Qty| Price
|--
||Pad Thai | 1| 14.99
||Spring Roll | 1| 4.99
|--
{w:* 8}
|| Subtotal| 19.98
|| Tax (6%)| 1.20
|| Convenience Fee| 0.99
|| Total| 22.17
---

{b:space}
{w:auto}
Please Sign:



---

{c:https://levischuck.com;o:qrcode,6}

Please Take our Survey`;

// SVG Target
const svgTarget = new SvgTarget();
svgTarget.setDefaultFont("'Atkinson Hyperlegible Mono'");
const {content: svg, width, height} = await transform(body, {
  cpl: charactersPerLine,
  charWidth: charWidth,
  target: svgTarget,
});

// HTML Target
const htmlTarget = new HtmlTarget();
htmlTarget.setDefaultFont("'Google Sans Code', monospace");
htmlTarget.setActualFontCharacterWidth(13.2); // Actual measured width of your font
htmlTarget.setCharHeight(24); // Character height in pixels
const {content: html, width: htmlWidth, height: htmlHeight} = await transform(body, {
  cpl: charactersPerLine,
  charWidth: charWidth,
  target: htmlTarget,
});
c
// Do something interesting with the SVG or HTML afterwards
```

## Method

`transform(doc[, options])`

### Parameters

- `doc`
  - a string of ReceiptLine document
- `options`
  - an object of printer configuration

### Return value

- `content`: SVG Image (for SvgTarget) or HTML string (for HtmlTarget)
- `width`: Width of the generated content in pixels
- `height`: Height of the generated content in pixels

## Printer configuration

- `cpl`
  - characters per line (default: `48`)
- `charWidth`
  - dot width of each character (default: `12`).
- `spacing`
  - `false`: no line spacing (default)
  - `true`: line spacing
- `margin` (for printer)
  - print margin (left) (range: `0` - `24`, default: `0`)
- `marginRight` (for printer)
  - print margin (right) (range: `0` - `24`, default: `0`)
- `target` What implementation to use (SvgTarget for SVG output, HtmlTarget for HTML output, instantiate your own to set additional configuration like font)
- `encoding`
  - `multilingual` (default), others exist if you need to look. They mostly adjust line spacing and default fonts.

`cpl * charWidth` will be the output width, which by default is 576 dots.

## HTML Target Configuration

The HTML target provides additional configuration options to account for differences with web fonts and the defaults this library expects for a thermal printer.

- `setDefaultFont(font: string)` - Sets the CSS font-family for the receipt (default: "'Courier Prime', monospace")
- `setActualFontCharacterWidth(width: number | undefined)` - Sets the actual measured character width of your font in pixels. It'll keep the text from going off the side when correctly set.
- `setCharHeight(height: number | undefined)` - Explicitly sets the character height in pixels. If not set, defaults to `charWidth * 2` (usually 12 * 2)

When using the HTML target, you may need to measure your font's actual character width for optimal layout. This is especially important when using web fonts that don't fit the 12 dot wide, 24 dot tall convention.

```javascript
const htmlTarget = new HtmlTarget();
htmlTarget.setDefaultFont("'Google Sans Code', monospace");
htmlTarget.setActualFontCharacterWidth(13.2);
htmlTarget.setCharHeight(24.7);
```

# Examples
### example/data/\*

The documents (receipt markdown text) are the same as the examples in the OFSC ReceiptLine Specification.

# Grammar

## Structure

The receipt is made of a table, which separates each column with a pipe `|`.

|Line|Content|Description|
|---|---|---|
|_column_<br><code>&#x7c;</code> _column_ <code>&#x7c;</code><br><code>&#x7c;</code> _column_<br>_column_ <code>&#x7c;</code>|Text<br>Property|Single column|
|_column_ <code>&#x7c;</code> _column_ <br><code>&#x7c;</code> _column_ <code>&#x7c;</code> _column_ <code>&#x7c;</code><br><code>&#x7c;</code> _column_ <code>&#x7c;</code> _column_<br>_column_ <code>&#x7c;</code> _column_ <code>&#x7c;</code>|Text|Double column|
|_column_ <code>&#x7c;</code> _..._ <code>&#x7c;</code> _column_<br><code>&#x7c;</code> _column_ <code>&#x7c;</code> _..._ <code>&#x7c;</code> _column_ <code>&#x7c;</code><br><code>&#x7c;</code> _column_ <code>&#x7c;</code> _..._ <code>&#x7c;</code> _column_<br>_column_ <code>&#x7c;</code> _..._ <code>&#x7c;</code> _column_ <code>&#x7c;</code>|Text|Multiple columns|

## Alignment

The column is attracted to the pipe `|` like a magnet.
<code>&#x2423;</code> means one or more whitespaces.

|Column|Description|
|---|---|
|_column_<br><code>&#x7c;</code>_column_<code>&#x7c;</code><br><code>&#x7c;&#x2423;</code>_column_<code>&#x2423;&#x7c;</code>|Center|
|<code>&#x7c;</code>_column_<br><code>&#x7c;</code>_column_<code>&#x2423;&#x7c;</code><br>_column_<code>&#x2423;&#x7c;</code>|Left|
|_column_<code>&#x7c;</code><br><code>&#x7c;&#x2423;</code>_column_<code>&#x7c;</code><br><code>&#x7c;&#x2423;</code>_column_|Right|

## Text

The text is valid for any column.

```
Asparagus | 0.99
Broccoli | 1.99
Carrot | 2.99
---
^TOTAL | ^5.97
```

Characters are printed in a monospace font (12 x 24 px).
Wide characters are twice as wide as Latin characters (24 x 24 px).
Control characters are ignored.

## Special characters in text

Special characters are assigned to characters that are rarely used in the receipt.

|Special character|Description|
|---|---|
|`\`|Character escape|
|<code>&#x7c;</code>|Column delimiter|
|`{`|Property delimiter (Start)|
|`}`|Property delimiter (End)|
|`-` (1 or more, exclusive)|Horizontal rule|
|`=` (1 or more, exclusive)|Paper cut|
|`~`|Space|
|`_`|Underline|
|`"`|Emphasis|
|`` ` ``|Invert|
|`^`|Double width|
|`^^`|Double height|
|`^^^`|2x size|
|`^^^^`|3x size|
|`^^^^^`|4x size|
|`^^^^^^`|5x size|
|`^^^^^^^` (7 or more)|6x size|

## Escape sequences in text

Escape special characters.

|Escape sequence|Description|
|---|---|
|`\\`|&#x5c;|
|<code>&#x5c;&#x7c;</code>|&#x7c;|
|`\{`|&#x7b;|
|`\}`|&#x7d;|
|`\-`|&#x2d; (Cancel horizontal rule)|
|`\=`|&#x3d; (Cancel paper cut)|
|`\~`|&#x7e;|
|`\_`|&#x5f;|
|`\"`|&#x5f;|
|``\` ``|&#x60;|
|`\^`|&#x5e;|
|`\n`|Wrap text manually|
|`\x`_nn_|Hexadecimal character code|
|`\`_char_ (Others)|Ignore|

## Properties

The property is valid for lines with a single column.

```
{ width: * 10; comment: the column width is specified in characters }
```

|Key|Abbreviation|Value|Case-sensitive|Default|Saved|Description|
|---|---|---|---|---|---|---|
|`image`|`i`|_base64 png format_|✓|-|-|Image<br>(Recommended: monochrome, critical chunks only)|
|`code`|`c`|_textdata_|✓|-|-|Barcode / 2D code|
|`option`|`o`|_see below_|-|`code128 2 72 nohri 3 l`|✓|Barcode / 2D code options<br>(Options are separated by commas or one or more whitespaces)|
|`align`|`a`|`left`<br>`center`<br>`right`|-|`center`|✓|Line alignment<br>(Valid when line width &lt; CPL)|
|`width`|`w`|`auto`<br>`*`<br>`0` -|-|`auto`<br>(`*` for all columns)|✓|Column widths (chars)<br>(Widths are separated by commas or one or more whitespaces)|
|`border`|`b`|`line`<br>`space`<br>`none`<br>`0` - `2`|-|`space`|✓|Column border (chars)<br>(Border width: line=1, space=1, none=0)|
|`text`|`t`|`wrap`<br>`nowrap`|-|`wrap`|✓|Text wrapping|
|`command`|`x`|_textdata_|✓|-|-|Device-specific commands|
|`comment`|`_`|_textdata_|✓|-|-|Comment|

## Barcode options

Barcode options are separated by commas or one or more whitespaces.

|Barcode option|Description|
|---|---|
|`upc`|UPC-A, UPC-E<br>(Check digit can be omitted)|
|`ean`<br>`jan`|EAN-13, EAN-8<br>(Check digit can be omitted)|
|`code39`|CODE39|
|`itf`|Interleaved 2 of 5|
|`codabar`<br>`nw7`|Codabar (NW-7)|
|`code93`|CODE93|
|`code128`|CODE128|
|`2` - `4`|Barcode module width (px)|
|`24` - `240`|Barcode module height (px)|
|`hri`|With human readable interpretation|
|`nohri`|Without human readable interpretation|

## 2D code options

2D code options are separated by commas or one or more whitespaces.

|2D code option|Description|
|---|---|
|`qrcode`|QR Code|
|`3` - `8`|Cell size (px)|
|`l`<br>`m`<br>`q`<br>`h`|Error correction level|

## Special characters in property values

Special characters in property values are different from special characters in text.

|Special character|Description|
|---|---|
|`\`|Character escape|
|<code>&#x7c;</code>|Column delimiter|
|`{`|Property delimiter (Start)|
|`}`|Property delimiter (End)|
|`:`|Key-value separator|
|`;`|Key-value delimiter|

## Escape sequences in property values

Escape special characters.

|Escape sequence|Description|
|---|---|
|`\\`|&#x5c;|
|<code>&#x5c;&#x7c;</code>|&#x7c;|
|`\{`|&#x7b;|
|`\}`|&#x7d;|
|`\;`|&#x3b;|
|`\n`|New line|
|`\x`_nn_|Hexadecimal character code|
|`\`_char_ (Others)|Ignore|

# Why use this one over the reference implementation?

The original library has a weird hack to generate UUIDs on insecure contexts to get around a [currently debated WebCrypto standards detail](https://github.com/w3c/webcrypto/issues/408).
This prevented me from deploying to Cloudflare workers.
This fork and typescript adjustment is enough to unblock my objective.

I also wanted to use a diferent font.

# License

Apache 2 Licensed, per the [original source](https://github.com/receiptline/receiptline)

The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
http://www.denso-wave.com/qrcode/faqpatent-e.html

# Author

Open Foodservice System Consortium
http://www.ofsc.or.jp/

Levi Schuck
https://levischuck.com/
