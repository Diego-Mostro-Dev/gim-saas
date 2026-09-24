export function printQrA4({ gymName, message, qrSvg, footer }) {
  const win = window.open("", "_blank");
  if (!win) return;

  const doc = win.document;
  doc.open();
  doc.title = `${gymName || ""} - QR`;

  const style = doc.createElement("style");
  style.textContent = `${STYLE_SHEET}`;
  doc.head.appendChild(style);

  const sheet = doc.createElement("div");
  sheet.className = "sheet";

  if (gymName) appendText(doc, sheet, "gym", gymName);

  const qr = doc.createElement("div");
  qr.className = "qr";
  qr.innerHTML = qrSvg.replace(/<svg[^>]*>/, (tag) => {
    const sized = tag.replace(
      /(<svg[^>]*?)(width="[^"]*")?([^>]*>)/,
      "$1 width=\"100%\" $2 $3",
    );
    return sized;
  });
  sheet.appendChild(qr);

  if (message) appendText(doc, sheet, "message", message);
  if (footer) appendText(doc, sheet, "footer", footer);

  doc.body.appendChild(sheet);
  doc.close();
  win.focus();
  win.print();
}

function appendText(doc, parent, className, text) {
  const el = doc.createElement("div");
  el.className = className;
  el.textContent = String(text);
  parent.appendChild(el);
}

const STYLE_SHEET = `
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
`;