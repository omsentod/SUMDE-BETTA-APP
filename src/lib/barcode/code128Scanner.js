/**
 * Pure JavaScript Code 128 Barcode Scanner Engine
 * Designed for real-time camera canvas decoding of courier waybills & shipping labels.
 * Supports Subsets A, B, and C with full Modulo-103 checksum verification.
 * Zero external dependencies. Works on all mobile browsers (iOS Safari, Android Chrome, WebViews).
 */

// 107 pola Code 128 (modul 1-4, total 11 modul per karakter, Stop 13 modul)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (103: Start A, 104: Start B, 105: Start C, 106: Stop)
];

const CODE_B_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

/**
 * Decode scanline 1D pixels array (intensitas 0-255)
 */
function decodeScanline(pixels) {
  const len = pixels.length;
  if (len < 60) return null;

  // 1. Thresholding adaptif berbasis moving-average
  let totalSum = 0;
  for (let i = 0; i < len; i++) totalSum += pixels[i];
  const globalThreshold = totalSum / len;

  // 2. Run-length encoding
  const runs = [];
  let currentIsBlack = pixels[0] < globalThreshold;
  let currentRunLen = 1;

  for (let i = 1; i < len; i++) {
    const isBlack = pixels[i] < globalThreshold;
    if (isBlack === currentIsBlack) {
      currentRunLen++;
    } else {
      runs.push({ isBlack: currentIsBlack, len: currentRunLen });
      currentIsBlack = isBlack;
      currentRunLen = 1;
    }
  }
  runs.push({ isBlack: currentIsBlack, len: currentRunLen });

  // 3. Cari pola Start Code 128 (Start A: 103, Start B: 104, Start C: 105)
  for (let startIdx = 0; startIdx < runs.length - 12; startIdx++) {
    if (!runs[startIdx].isBlack) continue; // Start pattern selalu dimulai dengan bar (hitam)

    const startCand = runs.slice(startIdx, startIdx + 6);
    const startW = startCand.reduce((a, b) => a + b.len, 0);
    const unitW = startW / 11;
    if (unitW < 0.6) continue;

    const startNorm = startCand.map(r => Math.max(1, Math.min(4, Math.round(r.len / unitW)))).join('');
    const matchedStart = CODE128_PATTERNS.indexOf(startNorm);

    if (matchedStart === 103 || matchedStart === 104 || matchedStart === 105) {
      const decodedCodes = [matchedStart];
      let curr = startIdx + 6;
      let foundStop = false;

      while (curr < runs.length) {
        // Cek pola stop (7 elemen, 13 modul)
        if (curr + 7 <= runs.length) {
          const stopCand = runs.slice(curr, curr + 7);
          const stopW = stopCand.reduce((a, b) => a + b.len, 0);
          const stopUnit = stopW / 13;
          const stopNorm = stopCand.map(r => Math.max(1, Math.min(4, Math.round(r.len / stopUnit)))).join('');
          if (stopNorm === "2331112") {
            decodedCodes.push(106);
            foundStop = true;
            break;
          }
        }

        // Cek simbol data biasa (6 elemen, 11 modul)
        if (curr + 6 > runs.length) break;
        const symCand = runs.slice(curr, curr + 6);
        const symW = symCand.reduce((a, b) => a + b.len, 0);
        const symUnit = symW / 11;
        const symNorm = symCand.map(r => Math.max(1, Math.min(4, Math.round(r.len / symUnit)))).join('');
        const symIdx = CODE128_PATTERNS.indexOf(symNorm);

        if (symIdx === -1) {
          break; // Pola rusak / bukan barcode
        }

        decodedCodes.push(symIdx);
        curr += 6;
      }

      // Verifikasi checksum modulo 103
      if (foundStop && decodedCodes.length >= 3) {
        const expectedChecksum = decodedCodes[decodedCodes.length - 2];
        let sum = decodedCodes[0];
        for (let k = 1; k < decodedCodes.length - 2; k++) {
          sum += decodedCodes[k] * k;
        }

        if (sum % 103 === expectedChecksum) {
          // Checksum 100% VALID! Decode ke string hasil
          let mode = decodedCodes[0] === 103 ? 'A' : decodedCodes[0] === 104 ? 'B' : 'C';
          let str = '';

          for (let m = 1; m < decodedCodes.length - 2; m++) {
            const val = decodedCodes[m];
            if (val === 99) { mode = 'C'; continue; }
            if (val === 100) { mode = 'B'; continue; }
            if (val === 101) { mode = 'A'; continue; }

            if (mode === 'B') {
              if (val >= 0 && val < CODE_B_CHARS.length) str += CODE_B_CHARS[val];
            } else if (mode === 'C') {
              str += String(val).padStart(2, '0');
            } else if (mode === 'A') {
              if (val >= 0 && val <= 95) str += String.fromCharCode(val < 64 ? val + 32 : val);
            }
          }

          if (str.length >= 3) {
            return str;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Pindai ImageData dari Canvas area reticle
 * Mengambil multi-scanline (15 garis horizontal + reversed scan)
 * @param {ImageData} imageData 
 * @returns {string|null} Hasil nomor resi / kode barcode yang terdeteksi
 */
export function scanCode128FromImageData(imageData) {
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    return null;
  }

  const { width, height, data } = imageData;

  // Garis-garis pemindaian pada ketinggian berbeda di reticle
  const sampleYFractions = [
    0.50, 0.40, 0.60, 0.30, 0.70,
    0.45, 0.55, 0.35, 0.65, 0.25,
    0.75, 0.20, 0.80, 0.15, 0.85
  ];

  for (let s = 0; s < sampleYFractions.length; s++) {
    const y = Math.floor(height * sampleYFractions[s]);
    const rowOffset = y * width * 4;
    const pixels = new Uint8Array(width);

    for (let x = 0; x < width; x++) {
      const idx = rowOffset + (x * 4);
      // Grayscale Y = 0.299R + 0.587G + 0.114B
      pixels[x] = Math.round((data[idx] * 0.299) + (data[idx + 1] * 0.587) + (data[idx + 2] * 0.114));
    }

    // 1. Coba scan dari kiri ke kanan (arah normal)
    const normalResult = decodeScanline(pixels);
    if (normalResult) return normalResult;

    // 2. Coba scan dari kanan ke kiri (arah terbalik jika kertas resi miring 180 derajat)
    const reversedPixels = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      reversedPixels[x] = pixels[width - 1 - x];
    }
    const reversedResult = decodeScanline(reversedPixels);
    if (reversedResult) return reversedResult;
  }

  return null;
}
