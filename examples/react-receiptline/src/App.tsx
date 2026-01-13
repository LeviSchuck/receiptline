import { useState, useEffect, useMemo } from 'react';
import { transform, SvgTarget, HtmlTarget, AuditTarget, BaseTarget } from '@levischuck/receiptline';
import './App.css';

const defaultReceipt = `Example Receipt
{image:iVBORw0KGgoAAAANSUhEUgAAAHAAAAAYCAMAAAAVmYlOAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZQTFRFAAAA////pdmf3QAAAAlwSFlzAAAuIwAALiMBeKU/dgAAALZJREFUSMftlVESgCAIROH+l25qLIUFRMfpw9EvU5ZnuBTxz4MOcAsglRFEyU0lCKUR0Nc5wLI6A3zTpIGtYBbIo0BeA1TFfeYpoL4VyBIC69I9HQC+kZilRDklFblooKTG2pckMo0IGjGNFOLxrLaoDz7QbAsUymgyG1/sxkB84TSQ3cuL2sK8I7ek6NIuMOQvASqX5oE+kfAIbeeRfuqYllj1HtrC0bceypUUPkraOOePvwvwAi2zCEzzMOsBAAAAAElFTkSuQmCC}
(Merchant Copy)
---

{w: * 4 8}
{b:line}
|Product | Qty| Price
--
|Pad Thai | 1| 14.99
|Spring Roll | 1| 4.99
--
{w:* 8}
| Subtotal| 19.98
| Tax (6%)| 1.20
| Convenience Fee| 0.99
| Total| 22.17
---
{b:space}
{w:auto}
Please Sign:



---

{c:https://levischuck.com;o:qrcode,6}

Please Take our Survey`;

function App() {
  const [receiptText, setReceiptText] = useState(defaultReceipt);
  const [targetType, setTargetType] = useState<'svg' | 'html' | 'audit'>('svg');
  const [cpl, setCpl] = useState(48);
  const [charWidth, setCharWidth] = useState(12);
  const [charHeight, setCharHeight] = useState(24);
  const [actualFontWidth, setActualFontWidth] = useState(13.2);
  const [output, setOutput] = useState('');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [error, setError] = useState('');

  // Instantiate target based on targetType
  const target = useMemo<BaseTarget>(() => {
    switch (targetType) {
      case 'svg':
        return new SvgTarget();
      case 'html':
        const htmlTarget = new HtmlTarget();
        htmlTarget.setDefaultFont("'Google Sans Code', monospace");
        htmlTarget.setActualFontCharacterWidth(actualFontWidth);
        htmlTarget.setCharHeight(charHeight);
        return htmlTarget;
      case 'audit':
        return new AuditTarget();
      default:
        return new SvgTarget();
    }
  }, [targetType, actualFontWidth, charHeight]);

  useEffect(() => {
    const generateReceipt = async () => {
      try {
        setError('');
        const result = await transform(receiptText, {
          target: target,
          cpl: cpl,
          charWidth: charWidth,
        });
        setOutput(result.content);
        setWidth(result.width);
        setHeight(result.height);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setOutput('');
      }
    };

    generateReceipt();
  }, [receiptText, target, cpl, charWidth, charHeight, actualFontWidth]);

  return (
    <div className="app">
      <header className="header">
        <h1>ReceiptLine Demo</h1>
        <div className="controls">
          <div className="target-selection">
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
          <div className="config-section">
            <label className="config-label">
              <span>Characters per line:</span>
              <input
                type="number"
                min="1"
                max="200"
                value={cpl}
                onChange={(e) => setCpl(parseInt(e.target.value) || 48)}
              />
            </label>
            <label className="config-label">
              <span>Character width:</span>
              <input
                type="number"
                min="1"
                max="50"
                step="0.1"
                value={charWidth}
                onChange={(e) => setCharWidth(parseFloat(e.target.value) || 12)}
              />
            </label>
            <label className="config-label">
              <span>Character height:</span>
              <input
                type="number"
                min="1"
                max="100"
                step="0.1"
                value={charHeight}
                onChange={(e) => setCharHeight(parseFloat(e.target.value) || 24)}
                disabled={targetType !== 'html'}
              />
            </label>
            <label className="config-label">
              <span>Actual font width:</span>
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={actualFontWidth}
                onChange={(e) => setActualFontWidth(parseFloat(e.target.value) || 13.2)}
                disabled={targetType !== 'html'}
              />
            </label>
          </div>
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
