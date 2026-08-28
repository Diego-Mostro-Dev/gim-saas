export function printQrA4({ gymName, message, qrSvg, footer }) {
  const win = window.open("", "_blank");
  if (!win) return;

  const svg = qrSvg.replace(/<svg[^>]*>/, (tag) => {
    const sized = tag.replace(
      /(<svg[^>]*?)(width="[^"]*")?([^>]*>)/,
      '$1 width="100%" $2 $3',
    );
    return sized;
  });

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(gymName || "")} - QR</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4 portrait; margin: 0; }
      html, body { width: 210mm; height: 297mm; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        color: #111;
      }
      .sheet {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20mm;
        text-align: center;
      }
      .gym {
        font-size: 42pt;
        font-weight: 800;
        margin-bottom: 10mm;
        color: #111;
      }
      .qr { width: 150mm; max-width: 150mm; margin-bottom: 10mm; }
      .qr svg { display: block; width: 100%; height: auto; }
      .message {
        font-size: 30pt;
        font-weight: 700;
        color: #111;
        line-height: 1.2;
      }
      .footer {
        margin-top: 8mm;
        font-size: 14pt;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${gymName ? `<div class="gym">${escapeHtml(gymName)}</div>` : ""}
      <div class="qr">${svg}</div>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ""}
      ${footer ? `<div class="footer">${escapeHtml(footer)}</div>` : ""}
    </div>
  </body>
</html>`);

  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
