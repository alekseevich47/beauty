export const widgetStyles = `
:host {
  all: initial;
  display: block;
  font-family: "Manrope", system-ui, sans-serif;
  color: #1c1917;
  --bw-accent: #c45c26;
  --bw-bg: #fffaf6;
  --bw-surface: #ffffff;
  --bw-border: #e7ddd4;
  --bw-muted: #78716c;
  --bw-radius: 14px;
}

*, *::before, *::after { box-sizing: border-box; }

.bw-root {
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  background: var(--bw-bg);
  padding: 16px;
  max-width: 380px;
  box-shadow: 0 10px 30px rgba(28, 25, 23, 0.06);
}

.bw-brand {
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 4px;
}

.bw-sub {
  margin: 0 0 14px;
  color: var(--bw-muted);
  font-size: 0.85rem;
}

.bw-list { display: grid; gap: 8px; margin: 0 0 12px; padding: 0; list-style: none; }

.bw-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--bw-border);
  border-radius: 12px;
  background: var(--bw-surface);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font: inherit;
}

.bw-item:hover { border-color: var(--bw-accent); }

.bw-item strong { display: block; font-size: 0.92rem; }
.bw-item span { color: var(--bw-muted); font-size: 0.75rem; }
.bw-price { font-weight: 700; color: var(--bw-accent); white-space: nowrap; }

.bw-field { display: grid; gap: 4px; margin-bottom: 10px; font-size: 0.85rem; }
.bw-field input, .bw-field select {
  border: 1px solid var(--bw-border);
  border-radius: 10px;
  padding: 9px 11px;
  font: inherit;
  background: #fff;
}

.bw-actions { display: flex; gap: 8px; margin-top: 8px; }

.bw-btn {
  flex: 1;
  border: 0;
  border-radius: 11px;
  padding: 10px 12px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.bw-btn-primary { background: var(--bw-accent); color: #fff; }
.bw-btn-ghost { background: transparent; color: var(--bw-muted); border: 1px solid var(--bw-border); }

.bw-error { color: #b91c1c; font-size: 0.78rem; margin: 0 0 8px; }
.bw-ok { color: #047857; font-size: 0.9rem; margin: 8px 0 0; }
.bw-key { font-size: 0.7rem; color: var(--bw-muted); margin-top: 10px; word-break: break-all; }
`;
