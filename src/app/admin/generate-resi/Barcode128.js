'use client';

// Pure Vector Code 128 (Subset B) Barcode Generator
// Renders instant, crisp SVG bars with shapeRendering="crispEdges"
// Eliminates network latency, broken image links, and blur in thermal printing

const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export default function Barcode128({ text = '', height = 40, className = '' }) {
  const safeText = String(text || '').trim().slice(0, 32);
  if (!safeText) {
    return null;
  }

  // Code 128B start symbol = 104
  const codes = [104];
  let checkSum = 104;

  for (let i = 0; i < safeText.length; i++) {
    const code = Math.max(0, Math.min(95, safeText.charCodeAt(i) - 32));
    codes.push(code);
    checkSum += (i + 1) * code;
  }

  // Checksum symbol & Stop symbol (106)
  codes.push(checkSum % 103);
  codes.push(106);

  // Bangun rects untuk setiap bar hitam (modul ganjil adalah spasi, modul genap adalah bar)
  let currentX = 0;
  const bars = [];

  for (const c of codes) {
    const pattern = PATTERNS[c] || '212222';
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      if (p % 2 === 0) {
        bars.push({ x: currentX, w: width });
      }
      currentX += width;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${currentX} ${height}`}
      preserveAspectRatio="none"
      className={className}
      shapeRendering="crispEdges"
      aria-label={`Barcode: ${safeText}`}
      role="img"
    >
      <rect x="0" y="0" width={currentX} height={height} fill="#ffffff" />
      {bars.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x}
          y="0"
          width={bar.w}
          height={height}
          fill="#000000"
        />
      ))}
    </svg>
  );
}
