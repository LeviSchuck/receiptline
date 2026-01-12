import { useState, useEffect } from 'react';
import { transform } from '@levischuck/receiptline';
import './App.css';

const defaultReceipt = `Example Receipt
(Merchant Copy)
---

| Product | Qty| Price
--
|Pad Thai | 1| 14.99
|Spring Roll | 1| 4.99
| | |
| | Subtotal| 19.98
| | Tax (6%)| 1.20
| | Convenience Fee| 0.99
| | Total| 22.17

Please Sign:



---

{c:https://levischuck.com;o:qrcode,6}

Please Take our Survey
`;

function App() {
  const [receiptText, setReceiptText] = useState(defaultReceipt);
  const [targetType, setTargetType] = useState<'svg' | 'html' | 'audit'>('svg');
  const [output, setOutput] = useState('');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const generateReceipt = async () => {
      try {
        setError('');
        const result = await transform(receiptText, {
          target: targetType,
          cpl: 48,
          charWidth: 12,
        });
        setOutput(result.svg);
        setWidth(result.width);
        setHeight(result.height);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setOutput('');
      }
    };

    generateReceipt();
  }, [receiptText, targetType]);

  return (
    <div className="app">
      <header className="header">
        <h1>ReceiptLine Demo</h1>
        <div className="controls">
          <label className="toggle">
            <input
              type="radio"
              name="target"
              value="svg"
              checked={targetType === 'svg'}
              onChange={(e) => setTargetType(e.target.value as 'svg' | 'html' | 'audit')}
            />
            <span>SVG</span>
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="target"
              value="html"
              checked={targetType === 'html'}
              onChange={(e) => setTargetType(e.target.value as 'svg' | 'html' | 'audit')}
            />
            <span>HTML</span>
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="target"
              value="audit"
              checked={targetType === 'audit'}
              onChange={(e) => setTargetType(e.target.value as 'svg' | 'html' | 'audit')}
            />
            <span>Audit</span>
          </label>
        </div>
      </header>

      <div className="container">
        <div className="editor-panel">
          <h2>ReceiptLine Markup</h2>
          <textarea
            className="editor"
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="preview-panel">
          <h2>
            Preview ({targetType.toUpperCase()}) - {width}×{height}px
          </h2>
          {error ? (
            <div className="error">
              <strong>Error:</strong> {error}
            </div>
          ) : (
            <div className="preview">
              {targetType === 'audit' ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', margin: 0, padding: '1rem', background: 'transparent', borderRadius: '4px' }}>{output}</pre>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: output }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
