/*!
 * qrcode.js — مولّد رموز QR بسيط بدون أي اعتمادية خارجية (يعمل بالكامل offline).
 * يدعم وضع البايت (Byte mode) فقط ومستوى تصحيح خطأ L، بأحجام رمزية 1-5
 * (كافية لأي نص قصير مثل معرّف الطالب). مبني حسب مواصفة QR القياسية.
 */
(function (global) {
  'use strict';

  var QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

  // ---------- حقل غالوا GF(256) ----------
  var EXP_TABLE = new Array(256);
  var LOG_TABLE = new Array(256);
  for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (var i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

  function glog(n) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return LOG_TABLE[n];
  }
  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP_TABLE[n];
  }

  function QRPolynomial(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  QRPolynomial.prototype.get = function (index) { return this.num[index]; };
  QRPolynomial.prototype.getLength = function () { return this.num.length; };
  QRPolynomial.prototype.multiply = function (e) {
    var num = new Array(this.getLength() + e.getLength() - 1);
    for (var i = 0; i < num.length; i++) num[i] = 0;
    for (var i = 0; i < this.getLength(); i++) {
      for (var j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  };
  QRPolynomial.prototype.mod = function (e) {
    if (this.getLength() - e.getLength() < 0) return this;
    var ratio = glog(this.get(0)) - glog(e.get(0));
    var num = new Array(this.getLength());
    for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (var i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  };

  function getErrorCorrectPolynomial(ecLength) {
    var a = new QRPolynomial([1], 0);
    for (var i = 0; i < ecLength; i++) {
      a = a.multiply(new QRPolynomial([1, gexp(i)], 0));
    }
    return a;
  }

  // ---------- مخزن البتات ----------
  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype.put = function (num, length) {
    for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  };
  QRBitBuffer.prototype.putBit = function (bit) {
    var bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  };

  // ---------- تحويل النص إلى بايتات UTF-8 ----------
  function toUtf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  // جداول ثابتة لحجوم 1-5 عند مستوى تصحيح L (كتلة واحدة بلا تقسيم)
  var VERSION_TABLE = {
    1: { total: 26, data: 19, ec: 7 },
    2: { total: 44, data: 34, ec: 10 },
    3: { total: 70, data: 55, ec: 15 },
    4: { total: 100, data: 80, ec: 20 },
    5: { total: 134, data: 108, ec: 26 },
  };
  var ALIGNMENT_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
  };

  function chooseVersion(byteLen) {
    for (var v = 1; v <= 5; v++) {
      // طرح 3 بايت تقريبًا كحمل زائد (نمط + طول + منتهي)
      if (byteLen <= VERSION_TABLE[v].data - 3) return v;
    }
    return null;
  }

  function createData(version, dataBytes) {
    var buffer = new QRBitBuffer();
    buffer.put(4, 4); // مؤشر الوضع: بايت (0100)
    buffer.put(dataBytes.length, 8); // مؤشر عدد الأحرف (8 بت لهذه الإصدارات الصغيرة)
    for (var i = 0; i < dataBytes.length; i++) buffer.put(dataBytes[i], 8);

    var totalDataCount = VERSION_TABLE[version].data;
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);

    var PAD0 = 0xec, PAD1 = 0x11;
    while (buffer.length < totalDataCount * 8) {
      buffer.put(PAD0, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }
    return buffer.buffer.slice(0, totalDataCount);
  }

  function createBytesWithEC(version, dataBytes) {
    var ecCount = VERSION_TABLE[version].ec;
    var rsPoly = getErrorCorrectPolynomial(ecCount);
    var rawPoly = new QRPolynomial(dataBytes, ecCount);
    var modPoly = rawPoly.mod(rsPoly);
    var ecBytes = new Array(ecCount);
    for (var i = 0; i < ecCount; i++) {
      var modIndex = i + modPoly.getLength() - ecCount;
      ecBytes[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
    return dataBytes.concat(ecBytes);
  }

  // ---------- إعداد المصفوفة ----------
  function newMatrix(n) {
    var m = new Array(n);
    for (var r = 0; r < n; r++) {
      m[r] = new Array(n);
      for (var c = 0; c < n; c++) m[r][c] = null;
    }
    return m;
  }

  function setupFinder(matrix, row, col) {
    var n = matrix.length;
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || n <= row + r) continue;
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || n <= col + c) continue;
        if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[row + r][col + c] = true;
        } else {
          matrix[row + r][col + c] = false;
        }
      }
    }
  }

  function setupTiming(matrix) {
    var n = matrix.length;
    for (var r = 8; r < n - 8; r++) {
      if (matrix[r][6] !== null) continue;
      matrix[r][6] = (r % 2 === 0);
    }
    for (var c = 8; c < n - 8; c++) {
      if (matrix[6][c] !== null) continue;
      matrix[6][c] = (c % 2 === 0);
    }
  }

  function setupAlignment(matrix, version) {
    var pos = ALIGNMENT_POS[version];
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var row = pos[i], col = pos[j];
        if (matrix[row][col] !== null) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              matrix[row + r][col + c] = true;
            } else {
              matrix[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
  var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
  function bchDigit(data) {
    var digit = 0;
    while (data !== 0) { digit++; data >>>= 1; }
    return digit;
  }
  function bchTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) {
      d ^= (G15 << (bchDigit(d) - bchDigit(G15)));
    }
    return ((data << 10) | d) ^ G15_MASK;
  }

  function setupTypeInfo(matrix, maskPattern, ecLevelBits, test) {
    var n = matrix.length;
    var data = (ecLevelBits << 3) | maskPattern;
    var bits = bchTypeInfo(data);

    for (var i = 0; i < 15; i++) {
      var mod = (!test && ((bits >> i) & 1) === 1);
      if (i < 6) matrix[i][8] = mod;
      else if (i < 8) matrix[i + 1][8] = mod;
      else matrix[n - 15 + i][8] = mod;
    }
    for (var i = 0; i < 15; i++) {
      var mod = (!test && ((bits >> i) & 1) === 1);
      if (i < 8) matrix[8][n - i - 1] = mod;
      else if (i < 9) matrix[8][15 - i - 1 + 1] = mod;
      else matrix[8][15 - i - 1] = mod;
    }
    matrix[n - 8][8] = !test;
  }

  function getMask(row, col) {
    return (row + col) % 2 === 0; // نمط القناع 0 الثابت
  }

  function setupData(matrix, dataCache) {
    var n = matrix.length;
    var inc = -1, row = n - 1, bitIndex = 7, byteIndex = 0;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (var c = 0; c < 2; c++) {
          if (matrix[row][col - c] === null) {
            var dark = false;
            if (byteIndex < dataCache.length) {
              dark = (((dataCache[byteIndex] >>> bitIndex) & 1) === 1);
            }
            if (getMask(row, col - c)) dark = !dark;
            matrix[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || n <= row) { row -= inc; inc = -inc; break; }
      }
    }
  }

  function buildMatrix(version, finalBytes) {
    var n = 4 * version + 17;
    var matrix = newMatrix(n);
    setupFinder(matrix, 0, 0);
    setupFinder(matrix, n - 7, 0);
    setupFinder(matrix, 0, n - 7);
    setupAlignment(matrix, version);
    setupTiming(matrix);
    setupTypeInfo(matrix, 0, QRErrorCorrectLevel.L, false);
    setupData(matrix, finalBytes);
    return matrix;
  }

  /**
   * توليد مصفوفة QR (مصفوفة boolean ثنائية الأبعاد) من نص.
   * يرمي استثناء إن كان النص أطول من السعة المدعومة (نادر جدًا لمعرفات قصيرة).
   */
  function generateMatrix(text) {
    var dataBytes = toUtf8Bytes(String(text));
    var version = chooseVersion(dataBytes.length);
    if (!version) throw new Error('QR: النص طويل جدًا لهذا المولّد المبسّط');
    var padded = createData(version, dataBytes);
    var withEC = createBytesWithEC(version, padded);
    return buildMatrix(version, withEC);
  }

  /** رسم مصفوفة QR داخل عنصر <canvas> موجود. */
  function renderToCanvas(canvas, text, opts) {
    opts = opts || {};
    var size = opts.size || 220;
    var margin = opts.margin != null ? opts.margin : 2;
    var dark = opts.dark || '#0f172a';
    var light = opts.light || '#ffffff';
    var matrix = generateMatrix(text);
    var n = matrix.length;
    var cell = Math.floor(size / (n + margin * 2));
    var total = cell * (n + margin * 2);
    canvas.width = total;
    canvas.height = total;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = dark;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (matrix[r][c]) {
          ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
    }
    return canvas;
  }

  /** إرجاع Data URL (PNG) مباشرة. */
  function toDataURL(text, opts) {
    var canvas = document.createElement('canvas');
    renderToCanvas(canvas, text, opts);
    return canvas.toDataURL('image/png');
  }

  var QR = {
    generateMatrix: generateMatrix,
    renderToCanvas: renderToCanvas,
    toDataURL: toDataURL,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QR;
  } else {
    global.EduQR = QR;
  }
})(typeof window !== 'undefined' ? window : globalThis);
