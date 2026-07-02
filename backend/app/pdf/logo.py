"""Inline SVG for the Exicom brand mark.

Using an inline SVG keeps the logo crisp and reproducible in WeasyPrint
(conic-gradient / web fonts are unreliable in the PDF engine, SVG is not).
The mark is the teal circular "e" followed by the lowercase "exicom" wordmark.
"""

EXICOM_LOGO_SVG = """
<svg class="logo-svg" width="150" height="42" viewBox="0 0 300 84" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#16B8B0"/>
      <stop offset="55%" stop-color="#2EC48F"/>
      <stop offset="100%" stop-color="#57C62F"/>
    </linearGradient>
  </defs>

  <!-- circular "e" mark -->
  <circle cx="34" cy="42" r="31" fill="url(#eGrad)"/>
  <circle cx="34" cy="42" r="24" fill="#ffffff"/>
  <text x="34" y="42" font-family="Helvetica, Arial, sans-serif" font-size="40"
        font-weight="800" fill="#1AA39B" text-anchor="middle"
        dominant-baseline="central">e</text>

  <!-- wordmark -->
  <text x="78" y="42" font-family="Helvetica, Arial, sans-serif" font-size="42"
        font-weight="800" fill="#111111" letter-spacing="-1"
        dominant-baseline="central">exicom</text>
</svg>
"""
