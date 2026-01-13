# ReceiptLine React Demo

A live interactive demo of the ReceiptLine library built with React and Vite.

## Features

- **Live Editor**: Edit ReceiptLine markup in real-time
- **Dual Output Modes**: Toggle between SVG and HTML rendering
- **Dark Theme**: Modern dark UI optimized for coding
- **Split View**: Side-by-side editor and preview
- **Responsive**: Works on desktop and tablet devices

## Getting Started

### Install Dependencies

```bash
bun install
```

### Run Development Server

```bash
bun dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
bun run build
```

### Preview Production Build

```bash
bun preview
```

## Usage

1. Edit the ReceiptLine markup in the left panel
2. Toggle between SVG and HTML output modes using the radio buttons
3. See the rendered receipt in real-time in the right panel

## ReceiptLine Syntax Examples

### Basic Text

```
Hello World
```

### Horizontal Rule

```
-
```

### Tables

```
{width: 20, 20}
|Item|Price|
|Coffee|$3.50|
|Bagel|$2.00|
```

### Text Formatting

- `_text_` - Underline
- `"text"` - Bold/Emphasis
- `` `text` `` - Invert colors
- `^text^` - Scale up

### QR Code

```
{code: https://example.com; option: qrcode, 4, m}
```

### Cut Line

```
=
```

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **ReceiptLine** - Receipt rendering library

## License

MIT
