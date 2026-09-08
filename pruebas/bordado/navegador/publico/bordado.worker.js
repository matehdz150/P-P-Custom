"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/path_parse.js
  var require_path_parse = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/path_parse.js"(exports, module) {
      "use strict";
      var paramCounts = { a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0 };
      var SPECIAL_SPACES = [
        5760,
        6158,
        8192,
        8193,
        8194,
        8195,
        8196,
        8197,
        8198,
        8199,
        8200,
        8201,
        8202,
        8239,
        8287,
        12288,
        65279
      ];
      function isSpace(ch) {
        return ch === 10 || ch === 13 || ch === 8232 || ch === 8233 || // Line terminators
        // White spaces
        ch === 32 || ch === 9 || ch === 11 || ch === 12 || ch === 160 || ch >= 5760 && SPECIAL_SPACES.indexOf(ch) >= 0;
      }
      function isCommand(code) {
        switch (code | 32) {
          case 109:
          case 122:
          case 108:
          case 104:
          case 118:
          case 99:
          case 115:
          case 113:
          case 116:
          case 97:
          case 114:
            return true;
        }
        return false;
      }
      function isArc(code) {
        return (code | 32) === 97;
      }
      function isDigit(code) {
        return code >= 48 && code <= 57;
      }
      function isDigitStart(code) {
        return code >= 48 && code <= 57 || /* 0..9 */
        code === 43 || /* + */
        code === 45 || /* - */
        code === 46;
      }
      function State(path) {
        this.index = 0;
        this.path = path;
        this.max = path.length;
        this.result = [];
        this.param = 0;
        this.err = "";
        this.segmentStart = 0;
        this.data = [];
      }
      function skipSpaces(state) {
        while (state.index < state.max && isSpace(state.path.charCodeAt(state.index))) {
          state.index++;
        }
      }
      function scanFlag(state) {
        var ch = state.path.charCodeAt(state.index);
        if (ch === 48) {
          state.param = 0;
          state.index++;
          return;
        }
        if (ch === 49) {
          state.param = 1;
          state.index++;
          return;
        }
        state.err = "SvgPath: arc flag can be 0 or 1 only (at pos " + state.index + ")";
      }
      function scanParam(state) {
        var start = state.index, index = start, max = state.max, zeroFirst = false, hasCeiling = false, hasDecimal = false, hasDot = false, ch;
        if (index >= max) {
          state.err = "SvgPath: missed param (at pos " + index + ")";
          return;
        }
        ch = state.path.charCodeAt(index);
        if (ch === 43 || ch === 45) {
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (!isDigit(ch) && ch !== 46) {
          state.err = "SvgPath: param should start with 0..9 or `.` (at pos " + index + ")";
          return;
        }
        if (ch !== 46) {
          zeroFirst = ch === 48;
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
          if (zeroFirst && index < max) {
            if (ch && isDigit(ch)) {
              state.err = "SvgPath: numbers started with `0` such as `09` are illegal (at pos " + start + ")";
              return;
            }
          }
          while (index < max && isDigit(state.path.charCodeAt(index))) {
            index++;
            hasCeiling = true;
          }
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (ch === 46) {
          hasDot = true;
          index++;
          while (isDigit(state.path.charCodeAt(index))) {
            index++;
            hasDecimal = true;
          }
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (ch === 101 || ch === 69) {
          if (hasDot && !hasCeiling && !hasDecimal) {
            state.err = "SvgPath: invalid float exponent (at pos " + index + ")";
            return;
          }
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
          if (ch === 43 || ch === 45) {
            index++;
          }
          if (index < max && isDigit(state.path.charCodeAt(index))) {
            while (index < max && isDigit(state.path.charCodeAt(index))) {
              index++;
            }
          } else {
            state.err = "SvgPath: invalid float exponent (at pos " + index + ")";
            return;
          }
        }
        state.index = index;
        state.param = parseFloat(state.path.slice(start, index)) + 0;
      }
      function finalizeSegment(state) {
        var cmd, cmdLC;
        cmd = state.path[state.segmentStart];
        cmdLC = cmd.toLowerCase();
        var params = state.data;
        if (cmdLC === "m" && params.length > 2) {
          state.result.push([cmd, params[0], params[1]]);
          params = params.slice(2);
          cmdLC = "l";
          cmd = cmd === "m" ? "l" : "L";
        }
        if (cmdLC === "r") {
          state.result.push([cmd].concat(params));
        } else {
          while (params.length >= paramCounts[cmdLC]) {
            state.result.push([cmd].concat(params.splice(0, paramCounts[cmdLC])));
            if (!paramCounts[cmdLC]) {
              break;
            }
          }
        }
      }
      function scanSegment(state) {
        var max = state.max, cmdCode, is_arc, comma_found, need_params, i;
        state.segmentStart = state.index;
        cmdCode = state.path.charCodeAt(state.index);
        is_arc = isArc(cmdCode);
        if (!isCommand(cmdCode)) {
          state.err = "SvgPath: bad command " + state.path[state.index] + " (at pos " + state.index + ")";
          return;
        }
        need_params = paramCounts[state.path[state.index].toLowerCase()];
        state.index++;
        skipSpaces(state);
        state.data = [];
        if (!need_params) {
          finalizeSegment(state);
          return;
        }
        comma_found = false;
        for (; ; ) {
          for (i = need_params; i > 0; i--) {
            if (is_arc && (i === 3 || i === 4)) scanFlag(state);
            else scanParam(state);
            if (state.err.length) {
              finalizeSegment(state);
              return;
            }
            state.data.push(state.param);
            skipSpaces(state);
            comma_found = false;
            if (state.index < max && state.path.charCodeAt(state.index) === 44) {
              state.index++;
              skipSpaces(state);
              comma_found = true;
            }
          }
          if (comma_found) {
            continue;
          }
          if (state.index >= state.max) {
            break;
          }
          if (!isDigitStart(state.path.charCodeAt(state.index))) {
            break;
          }
        }
        finalizeSegment(state);
      }
      module.exports = function pathParse(svgPath) {
        var state = new State(svgPath);
        var max = state.max;
        skipSpaces(state);
        while (state.index < max && !state.err.length) {
          scanSegment(state);
        }
        if (state.result.length) {
          if ("mM".indexOf(state.result[0][0]) < 0) {
            state.err = "SvgPath: string should start with `M` or `m`";
            state.result = [];
          } else {
            state.result[0][0] = "M";
          }
        }
        return {
          err: state.err,
          segments: state.result
        };
      };
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/matrix.js
  var require_matrix = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/matrix.js"(exports, module) {
      "use strict";
      function combine(m1, m2) {
        return [
          m1[0] * m2[0] + m1[2] * m2[1],
          m1[1] * m2[0] + m1[3] * m2[1],
          m1[0] * m2[2] + m1[2] * m2[3],
          m1[1] * m2[2] + m1[3] * m2[3],
          m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
          m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
        ];
      }
      function Matrix() {
        if (!(this instanceof Matrix)) {
          return new Matrix();
        }
        this.queue = [];
        this.cache = null;
      }
      Matrix.prototype.matrix = function(m) {
        if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) {
          return this;
        }
        this.cache = null;
        this.queue.push(m);
        return this;
      };
      Matrix.prototype.translate = function(tx, ty) {
        if (tx !== 0 || ty !== 0) {
          this.cache = null;
          this.queue.push([1, 0, 0, 1, tx, ty]);
        }
        return this;
      };
      Matrix.prototype.scale = function(sx, sy) {
        if (sx !== 1 || sy !== 1) {
          this.cache = null;
          this.queue.push([sx, 0, 0, sy, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.rotate = function(angle, rx, ry) {
        var rad, cos, sin;
        if (angle !== 0) {
          this.translate(rx, ry);
          rad = angle * Math.PI / 180;
          cos = Math.cos(rad);
          sin = Math.sin(rad);
          this.queue.push([cos, sin, -sin, cos, 0, 0]);
          this.cache = null;
          this.translate(-rx, -ry);
        }
        return this;
      };
      Matrix.prototype.skewX = function(angle) {
        if (angle !== 0) {
          this.cache = null;
          this.queue.push([1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.skewY = function(angle) {
        if (angle !== 0) {
          this.cache = null;
          this.queue.push([1, Math.tan(angle * Math.PI / 180), 0, 1, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.toArray = function() {
        if (this.cache) {
          return this.cache;
        }
        if (!this.queue.length) {
          this.cache = [1, 0, 0, 1, 0, 0];
          return this.cache;
        }
        this.cache = this.queue[0];
        if (this.queue.length === 1) {
          return this.cache;
        }
        for (var i = 1; i < this.queue.length; i++) {
          this.cache = combine(this.cache, this.queue[i]);
        }
        return this.cache;
      };
      Matrix.prototype.calc = function(x, y, isRelative) {
        var m;
        if (!this.queue.length) {
          return [x, y];
        }
        if (!this.cache) {
          this.cache = this.toArray();
        }
        m = this.cache;
        return [
          x * m[0] + y * m[2] + (isRelative ? 0 : m[4]),
          x * m[1] + y * m[3] + (isRelative ? 0 : m[5])
        ];
      };
      module.exports = Matrix;
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/transform_parse.js
  var require_transform_parse = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/transform_parse.js"(exports, module) {
      "use strict";
      var Matrix = require_matrix();
      var operations = {
        matrix: true,
        scale: true,
        rotate: true,
        translate: true,
        skewX: true,
        skewY: true
      };
      var CMD_SPLIT_RE = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
      var PARAMS_SPLIT_RE = /[\s,]+/;
      module.exports = function transformParse(transformString) {
        var matrix = new Matrix();
        var cmd, params;
        transformString.split(CMD_SPLIT_RE).forEach(function(item) {
          if (!item.length) {
            return;
          }
          if (typeof operations[item] !== "undefined") {
            cmd = item;
            return;
          }
          params = item.split(PARAMS_SPLIT_RE).map(function(i) {
            return +i || 0;
          });
          switch (cmd) {
            case "matrix":
              if (params.length === 6) {
                matrix.matrix(params);
              }
              return;
            case "scale":
              if (params.length === 1) {
                matrix.scale(params[0], params[0]);
              } else if (params.length === 2) {
                matrix.scale(params[0], params[1]);
              }
              return;
            case "rotate":
              if (params.length === 1) {
                matrix.rotate(params[0], 0, 0);
              } else if (params.length === 3) {
                matrix.rotate(params[0], params[1], params[2]);
              }
              return;
            case "translate":
              if (params.length === 1) {
                matrix.translate(params[0], 0);
              } else if (params.length === 2) {
                matrix.translate(params[0], params[1]);
              }
              return;
            case "skewX":
              if (params.length === 1) {
                matrix.skewX(params[0]);
              }
              return;
            case "skewY":
              if (params.length === 1) {
                matrix.skewY(params[0]);
              }
              return;
          }
        });
        return matrix;
      };
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/a2c.js
  var require_a2c = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/a2c.js"(exports, module) {
      "use strict";
      var TAU = Math.PI * 2;
      function unit_vector_angle(ux, uy, vx, vy) {
        var sign = ux * vy - uy * vx < 0 ? -1 : 1;
        var dot = ux * vx + uy * vy;
        if (dot > 1) {
          dot = 1;
        }
        if (dot < -1) {
          dot = -1;
        }
        return sign * Math.acos(dot);
      }
      function get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi) {
        var x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        var y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;
        var rx_sq = rx * rx;
        var ry_sq = ry * ry;
        var x1p_sq = x1p * x1p;
        var y1p_sq = y1p * y1p;
        var radicant = rx_sq * ry_sq - rx_sq * y1p_sq - ry_sq * x1p_sq;
        if (radicant < 0) {
          radicant = 0;
        }
        radicant /= rx_sq * y1p_sq + ry_sq * x1p_sq;
        radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);
        var cxp = radicant * rx / ry * y1p;
        var cyp = radicant * -ry / rx * x1p;
        var cx = cos_phi * cxp - sin_phi * cyp + (x1 + x2) / 2;
        var cy = sin_phi * cxp + cos_phi * cyp + (y1 + y2) / 2;
        var v1x = (x1p - cxp) / rx;
        var v1y = (y1p - cyp) / ry;
        var v2x = (-x1p - cxp) / rx;
        var v2y = (-y1p - cyp) / ry;
        var theta1 = unit_vector_angle(1, 0, v1x, v1y);
        var delta_theta = unit_vector_angle(v1x, v1y, v2x, v2y);
        if (fs === 0 && delta_theta > 0) {
          delta_theta -= TAU;
        }
        if (fs === 1 && delta_theta < 0) {
          delta_theta += TAU;
        }
        return [cx, cy, theta1, delta_theta];
      }
      function approximate_unit_arc(theta1, delta_theta) {
        var alpha = 4 / 3 * Math.tan(delta_theta / 4);
        var x1 = Math.cos(theta1);
        var y1 = Math.sin(theta1);
        var x2 = Math.cos(theta1 + delta_theta);
        var y2 = Math.sin(theta1 + delta_theta);
        return [x1, y1, x1 - y1 * alpha, y1 + x1 * alpha, x2 + y2 * alpha, y2 - x2 * alpha, x2, y2];
      }
      module.exports = function a2c(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
        var sin_phi = Math.sin(phi * TAU / 360);
        var cos_phi = Math.cos(phi * TAU / 360);
        var x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        var y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;
        if (x1p === 0 && y1p === 0) {
          return [];
        }
        if (rx === 0 || ry === 0) {
          return [];
        }
        rx = Math.abs(rx);
        ry = Math.abs(ry);
        var lambda = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
        if (lambda > 1) {
          rx *= Math.sqrt(lambda);
          ry *= Math.sqrt(lambda);
        }
        var cc = get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi);
        var result = [];
        var theta1 = cc[2];
        var delta_theta = cc[3];
        var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);
        delta_theta /= segments;
        for (var i = 0; i < segments; i++) {
          result.push(approximate_unit_arc(theta1, delta_theta));
          theta1 += delta_theta;
        }
        return result.map(function(curve) {
          for (var i2 = 0; i2 < curve.length; i2 += 2) {
            var x = curve[i2 + 0];
            var y = curve[i2 + 1];
            x *= rx;
            y *= ry;
            var xp = cos_phi * x - sin_phi * y;
            var yp = sin_phi * x + cos_phi * y;
            curve[i2 + 0] = xp + cc[0];
            curve[i2 + 1] = yp + cc[1];
          }
          return curve;
        });
      };
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/ellipse.js
  var require_ellipse = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/ellipse.js"(exports, module) {
      "use strict";
      var epsilon = 1e-10;
      var torad = Math.PI / 180;
      function Ellipse(rx, ry, ax) {
        if (!(this instanceof Ellipse)) {
          return new Ellipse(rx, ry, ax);
        }
        this.rx = rx;
        this.ry = ry;
        this.ax = ax;
      }
      Ellipse.prototype.transform = function(m) {
        var c = Math.cos(this.ax * torad), s = Math.sin(this.ax * torad);
        var ma = [
          this.rx * (m[0] * c + m[2] * s),
          this.rx * (m[1] * c + m[3] * s),
          this.ry * (-m[0] * s + m[2] * c),
          this.ry * (-m[1] * s + m[3] * c)
        ];
        var J = ma[0] * ma[0] + ma[2] * ma[2], K = ma[1] * ma[1] + ma[3] * ma[3];
        var D = ((ma[0] - ma[3]) * (ma[0] - ma[3]) + (ma[2] + ma[1]) * (ma[2] + ma[1])) * ((ma[0] + ma[3]) * (ma[0] + ma[3]) + (ma[2] - ma[1]) * (ma[2] - ma[1]));
        var JK = (J + K) / 2;
        if (D < epsilon * JK) {
          this.rx = this.ry = Math.sqrt(JK);
          this.ax = 0;
          return this;
        }
        var L = ma[0] * ma[1] + ma[2] * ma[3];
        D = Math.sqrt(D);
        var l1 = JK + D / 2, l2 = JK - D / 2;
        this.ax = Math.abs(L) < epsilon && Math.abs(l1 - K) < epsilon ? 90 : Math.atan(
          Math.abs(L) > Math.abs(l1 - K) ? (l1 - J) / L : L / (l1 - K)
        ) * 180 / Math.PI;
        if (this.ax >= 0) {
          this.rx = Math.sqrt(l1);
          this.ry = Math.sqrt(l2);
        } else {
          this.ax += 90;
          this.rx = Math.sqrt(l2);
          this.ry = Math.sqrt(l1);
        }
        return this;
      };
      Ellipse.prototype.isDegenerate = function() {
        return this.rx < epsilon * this.ry || this.ry < epsilon * this.rx;
      };
      module.exports = Ellipse;
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/svgpath.js
  var require_svgpath = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/svgpath.js"(exports, module) {
      "use strict";
      var pathParse = require_path_parse();
      var transformParse = require_transform_parse();
      var matrix = require_matrix();
      var a2c = require_a2c();
      var ellipse = require_ellipse();
      function SvgPath(path) {
        if (!(this instanceof SvgPath)) {
          return new SvgPath(path);
        }
        var pstate = pathParse(path);
        this.segments = pstate.segments;
        this.err = pstate.err;
        this.__stack = [];
      }
      SvgPath.from = function(src) {
        if (typeof src === "string") return new SvgPath(src);
        if (src instanceof SvgPath) {
          var s = new SvgPath("");
          s.err = src.err;
          s.segments = src.segments.map(function(sgm) {
            return sgm.slice();
          });
          s.__stack = src.__stack.map(function(m) {
            return matrix().matrix(m.toArray());
          });
          return s;
        }
        throw new Error("SvgPath.from: invalid param type " + src);
      };
      SvgPath.prototype.__matrix = function(m) {
        var self2 = this, i;
        if (!m.queue.length) {
          return;
        }
        this.iterate(function(s, index, x, y) {
          var p, result, name, isRelative;
          switch (s[0]) {
            // Process 'assymetric' commands separately
            case "v":
              p = m.calc(0, s[1], true);
              result = p[0] === 0 ? ["v", p[1]] : ["l", p[0], p[1]];
              break;
            case "V":
              p = m.calc(x, s[1], false);
              result = p[0] === m.calc(x, y, false)[0] ? ["V", p[1]] : ["L", p[0], p[1]];
              break;
            case "h":
              p = m.calc(s[1], 0, true);
              result = p[1] === 0 ? ["h", p[0]] : ["l", p[0], p[1]];
              break;
            case "H":
              p = m.calc(s[1], y, false);
              result = p[1] === m.calc(x, y, false)[1] ? ["H", p[0]] : ["L", p[0], p[1]];
              break;
            case "a":
            case "A":
              var ma = m.toArray();
              var e = ellipse(s[1], s[2], s[3]).transform(ma);
              if (ma[0] * ma[3] - ma[1] * ma[2] < 0) {
                s[5] = s[5] ? "0" : "1";
              }
              p = m.calc(s[6], s[7], s[0] === "a");
              if (s[0] === "A" && s[6] === x && s[7] === y || s[0] === "a" && s[6] === 0 && s[7] === 0) {
                result = [s[0] === "a" ? "l" : "L", p[0], p[1]];
                break;
              }
              if (e.isDegenerate()) {
                result = [s[0] === "a" ? "l" : "L", p[0], p[1]];
              } else {
                result = [s[0], e.rx, e.ry, e.ax, s[4], s[5], p[0], p[1]];
              }
              break;
            case "m":
              isRelative = index > 0;
              p = m.calc(s[1], s[2], isRelative);
              result = ["m", p[0], p[1]];
              break;
            default:
              name = s[0];
              result = [name];
              isRelative = name.toLowerCase() === name;
              for (i = 1; i < s.length; i += 2) {
                p = m.calc(s[i], s[i + 1], isRelative);
                result.push(p[0], p[1]);
              }
          }
          self2.segments[index] = result;
        }, true);
      };
      SvgPath.prototype.__evaluateStack = function() {
        var m, i;
        if (!this.__stack.length) {
          return;
        }
        if (this.__stack.length === 1) {
          this.__matrix(this.__stack[0]);
          this.__stack = [];
          return;
        }
        m = matrix();
        i = this.__stack.length;
        while (--i >= 0) {
          m.matrix(this.__stack[i].toArray());
        }
        this.__matrix(m);
        this.__stack = [];
      };
      SvgPath.prototype.toString = function() {
        var result = "", prevCmd = "", cmdSkipped = false;
        this.__evaluateStack();
        for (var i = 0, len = this.segments.length; i < len; i++) {
          var segment = this.segments[i];
          var cmd = segment[0];
          if (cmd !== prevCmd || cmd === "m" || cmd === "M") {
            if (cmd === "m" && prevCmd === "z") result += " ";
            result += cmd;
            cmdSkipped = false;
          } else {
            cmdSkipped = true;
          }
          for (var pos = 1; pos < segment.length; pos++) {
            var val = segment[pos];
            if (pos === 1) {
              if (cmdSkipped && val >= 0) result += " ";
            } else if (val >= 0) result += " ";
            result += val;
          }
          prevCmd = cmd;
        }
        return result;
      };
      SvgPath.prototype.translate = function(x, y) {
        this.__stack.push(matrix().translate(x, y || 0));
        return this;
      };
      SvgPath.prototype.scale = function(sx, sy) {
        this.__stack.push(matrix().scale(sx, !sy && sy !== 0 ? sx : sy));
        return this;
      };
      SvgPath.prototype.rotate = function(angle, rx, ry) {
        this.__stack.push(matrix().rotate(angle, rx || 0, ry || 0));
        return this;
      };
      SvgPath.prototype.skewX = function(degrees) {
        this.__stack.push(matrix().skewX(degrees));
        return this;
      };
      SvgPath.prototype.skewY = function(degrees) {
        this.__stack.push(matrix().skewY(degrees));
        return this;
      };
      SvgPath.prototype.matrix = function(m) {
        this.__stack.push(matrix().matrix(m));
        return this;
      };
      SvgPath.prototype.transform = function(transformString) {
        if (!transformString.trim()) {
          return this;
        }
        this.__stack.push(transformParse(transformString));
        return this;
      };
      SvgPath.prototype.round = function(d) {
        var contourStartDeltaX = 0, contourStartDeltaY = 0, deltaX = 0, deltaY = 0, l;
        d = d || 0;
        this.__evaluateStack();
        this.segments.forEach(function(s) {
          var isRelative = s[0].toLowerCase() === s[0];
          switch (s[0]) {
            case "H":
            case "h":
              if (isRelative) {
                s[1] += deltaX;
              }
              deltaX = s[1] - s[1].toFixed(d);
              s[1] = +s[1].toFixed(d);
              return;
            case "V":
            case "v":
              if (isRelative) {
                s[1] += deltaY;
              }
              deltaY = s[1] - s[1].toFixed(d);
              s[1] = +s[1].toFixed(d);
              return;
            case "Z":
            case "z":
              deltaX = contourStartDeltaX;
              deltaY = contourStartDeltaY;
              return;
            case "M":
            case "m":
              if (isRelative) {
                s[1] += deltaX;
                s[2] += deltaY;
              }
              deltaX = s[1] - s[1].toFixed(d);
              deltaY = s[2] - s[2].toFixed(d);
              contourStartDeltaX = deltaX;
              contourStartDeltaY = deltaY;
              s[1] = +s[1].toFixed(d);
              s[2] = +s[2].toFixed(d);
              return;
            case "A":
            case "a":
              if (isRelative) {
                s[6] += deltaX;
                s[7] += deltaY;
              }
              deltaX = s[6] - s[6].toFixed(d);
              deltaY = s[7] - s[7].toFixed(d);
              s[1] = +s[1].toFixed(d);
              s[2] = +s[2].toFixed(d);
              s[3] = +s[3].toFixed(d + 2);
              s[6] = +s[6].toFixed(d);
              s[7] = +s[7].toFixed(d);
              return;
            default:
              l = s.length;
              if (isRelative) {
                s[l - 2] += deltaX;
                s[l - 1] += deltaY;
              }
              deltaX = s[l - 2] - s[l - 2].toFixed(d);
              deltaY = s[l - 1] - s[l - 1].toFixed(d);
              s.forEach(function(val, i) {
                if (!i) {
                  return;
                }
                s[i] = +s[i].toFixed(d);
              });
              return;
          }
        });
        return this;
      };
      SvgPath.prototype.iterate = function(iterator, keepLazyStack) {
        var segments = this.segments, replacements = {}, needReplace = false, lastX = 0, lastY = 0, countourStartX = 0, countourStartY = 0;
        var i, j, newSegments;
        if (!keepLazyStack) {
          this.__evaluateStack();
        }
        segments.forEach(function(s, index) {
          var res = iterator(s, index, lastX, lastY);
          if (Array.isArray(res)) {
            replacements[index] = res;
            needReplace = true;
          }
          var isRelative = s[0] === s[0].toLowerCase();
          switch (s[0]) {
            case "m":
            case "M":
              lastX = s[1] + (isRelative ? lastX : 0);
              lastY = s[2] + (isRelative ? lastY : 0);
              countourStartX = lastX;
              countourStartY = lastY;
              return;
            case "h":
            case "H":
              lastX = s[1] + (isRelative ? lastX : 0);
              return;
            case "v":
            case "V":
              lastY = s[1] + (isRelative ? lastY : 0);
              return;
            case "z":
            case "Z":
              lastX = countourStartX;
              lastY = countourStartY;
              return;
            default:
              lastX = s[s.length - 2] + (isRelative ? lastX : 0);
              lastY = s[s.length - 1] + (isRelative ? lastY : 0);
          }
        });
        if (!needReplace) {
          return this;
        }
        newSegments = [];
        for (i = 0; i < segments.length; i++) {
          if (typeof replacements[i] !== "undefined") {
            for (j = 0; j < replacements[i].length; j++) {
              newSegments.push(replacements[i][j]);
            }
          } else {
            newSegments.push(segments[i]);
          }
        }
        this.segments = newSegments;
        return this;
      };
      SvgPath.prototype.abs = function() {
        this.iterate(function(s, index, x, y) {
          var name = s[0], nameUC = name.toUpperCase(), i;
          if (name === nameUC) {
            return;
          }
          s[0] = nameUC;
          switch (name) {
            case "v":
              s[1] += y;
              return;
            case "a":
              s[6] += x;
              s[7] += y;
              return;
            default:
              for (i = 1; i < s.length; i++) {
                s[i] += i % 2 ? x : y;
              }
          }
        }, true);
        return this;
      };
      SvgPath.prototype.rel = function() {
        this.iterate(function(s, index, x, y) {
          var name = s[0], nameLC = name.toLowerCase(), i;
          if (name === nameLC) {
            return;
          }
          if (index === 0 && name === "M") {
            return;
          }
          s[0] = nameLC;
          switch (name) {
            case "V":
              s[1] -= y;
              return;
            case "A":
              s[6] -= x;
              s[7] -= y;
              return;
            default:
              for (i = 1; i < s.length; i++) {
                s[i] -= i % 2 ? x : y;
              }
          }
        }, true);
        return this;
      };
      SvgPath.prototype.unarc = function() {
        this.iterate(function(s, index, x, y) {
          var new_segments, nextX, nextY, result = [], name = s[0];
          if (name !== "A" && name !== "a") {
            return null;
          }
          if (name === "a") {
            nextX = x + s[6];
            nextY = y + s[7];
          } else {
            nextX = s[6];
            nextY = s[7];
          }
          new_segments = a2c(x, y, nextX, nextY, s[4], s[5], s[1], s[2], s[3]);
          if (new_segments.length === 0) {
            return [[s[0] === "a" ? "l" : "L", s[6], s[7]]];
          }
          new_segments.forEach(function(s2) {
            result.push(["C", s2[2], s2[3], s2[4], s2[5], s2[6], s2[7]]);
          });
          return result;
        });
        return this;
      };
      SvgPath.prototype.unshort = function() {
        var segments = this.segments;
        var prevControlX, prevControlY, prevSegment;
        var curControlX, curControlY;
        this.iterate(function(s, idx, x, y) {
          var name = s[0], nameUC = name.toUpperCase(), isRelative;
          if (!idx) {
            return;
          }
          if (nameUC === "T") {
            isRelative = name === "t";
            prevSegment = segments[idx - 1];
            if (prevSegment[0] === "Q") {
              prevControlX = prevSegment[1] - x;
              prevControlY = prevSegment[2] - y;
            } else if (prevSegment[0] === "q") {
              prevControlX = prevSegment[1] - prevSegment[3];
              prevControlY = prevSegment[2] - prevSegment[4];
            } else {
              prevControlX = 0;
              prevControlY = 0;
            }
            curControlX = -prevControlX;
            curControlY = -prevControlY;
            if (!isRelative) {
              curControlX += x;
              curControlY += y;
            }
            segments[idx] = [
              isRelative ? "q" : "Q",
              curControlX,
              curControlY,
              s[1],
              s[2]
            ];
          } else if (nameUC === "S") {
            isRelative = name === "s";
            prevSegment = segments[idx - 1];
            if (prevSegment[0] === "C") {
              prevControlX = prevSegment[3] - x;
              prevControlY = prevSegment[4] - y;
            } else if (prevSegment[0] === "c") {
              prevControlX = prevSegment[3] - prevSegment[5];
              prevControlY = prevSegment[4] - prevSegment[6];
            } else {
              prevControlX = 0;
              prevControlY = 0;
            }
            curControlX = -prevControlX;
            curControlY = -prevControlY;
            if (!isRelative) {
              curControlX += x;
              curControlY += y;
            }
            segments[idx] = [
              isRelative ? "c" : "C",
              curControlX,
              curControlY,
              s[1],
              s[2],
              s[3],
              s[4]
            ];
          }
        });
        return this;
      };
      module.exports = SvgPath;
    }
  });

  // node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/index.js
  var require_svgpath2 = __commonJS({
    "node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/index.js"(exports, module) {
      "use strict";
      module.exports = require_svgpath();
    }
  });

  // packages/bordado/src/geometria.ts
  var VECINOS_8 = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1]
  ];
  function componentes(rejilla) {
    const { datos, ancho, alto } = rejilla;
    const visto = new Uint8Array(ancho * alto);
    const salida = [];
    const cola = new Int32Array(ancho * alto);
    for (let inicio = 0; inicio < datos.length; inicio++) {
      if (!datos[inicio] || visto[inicio]) continue;
      let cabeza = 0;
      let fin = 0;
      cola[fin++] = inicio;
      visto[inicio] = 1;
      let minX = ancho;
      let minY = alto;
      let maxX = -1;
      let maxY = -1;
      const pixeles = [];
      while (cabeza < fin) {
        const p = cola[cabeza++];
        const x = p % ancho;
        const y = p / ancho | 0;
        pixeles.push(p);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        for (const [dx, dy] of VECINOS_8) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
          const q = ny * ancho + nx;
          if (datos[q] && !visto[q]) {
            visto[q] = 1;
            cola[fin++] = q;
          }
        }
      }
      salida.push({ pixeles: Int32Array.from(pixeles), minX, minY, maxX, maxY });
    }
    return salida;
  }
  function distanciaAlFondo(rejilla) {
    const { datos, ancho, alto } = rejilla;
    const d = new Float32Array(ancho * alto);
    const GRANDE = 1e9;
    for (let i = 0; i < datos.length; i++) d[i] = datos[i] ? GRANDE : 0;
    const mira = (i, j, coste) => {
      const v = d[j] + coste;
      if (v < d[i]) d[i] = v;
    };
    const fuera = (i, coste) => {
      if (coste < d[i]) d[i] = coste;
    };
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = y * ancho + x;
        if (!d[i]) continue;
        if (x > 0) mira(i, i - 1, 3);
        else fuera(i, 3);
        if (y > 0) mira(i, i - ancho, 3);
        else fuera(i, 3);
        if (x > 0 && y > 0) mira(i, i - ancho - 1, 4);
        else fuera(i, 4);
        if (x < ancho - 1 && y > 0) mira(i, i - ancho + 1, 4);
        else fuera(i, 4);
      }
    }
    for (let y = alto - 1; y >= 0; y--) {
      for (let x = ancho - 1; x >= 0; x--) {
        const i = y * ancho + x;
        if (!d[i]) continue;
        if (x < ancho - 1) mira(i, i + 1, 3);
        else fuera(i, 3);
        if (y < alto - 1) mira(i, i + ancho, 3);
        else fuera(i, 3);
        if (x < ancho - 1 && y < alto - 1) mira(i, i + ancho + 1, 4);
        else fuera(i, 4);
        if (x > 0 && y < alto - 1) mira(i, i + ancho - 1, 4);
        else fuera(i, 4);
      }
    }
    for (let i = 0; i < d.length; i++) d[i] /= 3;
    return d;
  }
  function crestaDeDistancia(rejilla, componente, distancia) {
    const { ancho } = rejilla;
    const cresta = [];
    for (const p of componente.pixeles) {
      const dp = distancia[p];
      if (dp <= 0) continue;
      const x = p % ancho;
      const y = p / ancho | 0;
      let esMaximo = true;
      for (const [dx, dy] of VECINOS_8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= rejilla.ancho || ny >= rejilla.alto)
          continue;
        if (distancia[ny * ancho + nx] > dp + 1e-6) {
          esMaximo = false;
          break;
        }
      }
      if (esMaximo) cresta.push(p);
    }
    return cresta;
  }
  function huecosLocales(rejilla, componente) {
    const ancho = componente.maxX - componente.minX + 3;
    const alto = componente.maxY - componente.minY + 3;
    const offsetX = componente.minX - 1;
    const offsetY = componente.minY - 1;
    const dentro = new Uint8Array(ancho * alto);
    for (const p of componente.pixeles) {
      const x = p % rejilla.ancho - offsetX;
      const y = (p / rejilla.ancho | 0) - offsetY;
      dentro[y * ancho + x] = 1;
    }
    const fuera = new Uint8Array(ancho * alto);
    const cola = [];
    for (let x = 0; x < ancho; x++) cola.push(x, (alto - 1) * ancho + x);
    for (let y = 0; y < alto; y++) cola.push(y * ancho, y * ancho + ancho - 1);
    while (cola.length) {
      const i = cola.pop();
      if (fuera[i] || dentro[i]) continue;
      fuera[i] = 1;
      const x = i % ancho;
      const y = i / ancho | 0;
      if (x > 0) cola.push(i - 1);
      if (x < ancho - 1) cola.push(i + 1);
      if (y > 0) cola.push(i - ancho);
      if (y < alto - 1) cola.push(i + ancho);
    }
    const salida = [];
    const visto = new Uint8Array(ancho * alto);
    for (let inicio = 0; inicio < dentro.length; inicio++) {
      if (dentro[inicio] || fuera[inicio] || visto[inicio]) continue;
      const pixeles = [];
      const pila = [inicio];
      visto[inicio] = 1;
      while (pila.length) {
        const i = pila.pop();
        pixeles.push(i);
        const x = i % ancho;
        const y = i / ancho | 0;
        for (const [dx, dy] of VECINOS_8) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
          const j = ny * ancho + nx;
          if (!dentro[j] && !fuera[j] && !visto[j]) {
            visto[j] = 1;
            pila.push(j);
          }
        }
      }
      const mascara = new Uint8Array(ancho * alto);
      for (const i of pixeles) mascara[i] = 1;
      salida.push({
        mascara,
        pixeles: Int32Array.from(pixeles),
        ancho,
        alto,
        offsetX,
        offsetY
      });
    }
    return salida;
  }
  function huecosDe(rejilla, componente) {
    const area = rejilla.mmPorPx * rejilla.mmPorPx;
    return huecosLocales(rejilla, componente).map((hueco) => hueco.pixeles.length * area).sort((a, b) => b - a);
  }
  function percentil(ordenados, p) {
    if (!ordenados.length) return 0;
    const i = Math.min(
      ordenados.length - 1,
      Math.max(0, Math.round((ordenados.length - 1) * p))
    );
    return ordenados[i];
  }
  function medir(rejilla, componente, distancia) {
    const mm = rejilla.mmPorPx;
    const cresta = crestaDeDistancia(rejilla, componente, distancia);
    const grosores = (cresta.length ? cresta : Array.from(componente.pixeles)).map((p) => distancia[p] * 2 * mm).sort((a, b) => a - b);
    const mediano = percentil(grosores, 0.5);
    const p10 = percentil(grosores, 0.1);
    const p90 = percentil(grosores, 0.9);
    const uniformidad = p90 > 0 ? Math.min(1, p10 / p90) : 0;
    return {
      areaMm2: componente.pixeles.length * mm * mm,
      anchoMm: (componente.maxX - componente.minX + 1) * mm,
      altoMm: (componente.maxY - componente.minY + 1) * mm,
      grosorMedianoMm: mediano,
      grosorMinimoMm: grosores[0] ?? 0,
      grosorMaximoMm: grosores[grosores.length - 1] ?? 0,
      uniformidad,
      // El eje aproximado por su número de píxeles: para decidir "alargado o no"
      // sobra, y no obliga a ordenar la cresta en una polilínea.
      largoEjeMm: cresta.length * mm,
      huecosMm2: huecosDe(rejilla, componente)
    };
  }
  function trazarBorde(rejilla, componente) {
    const { datos, ancho, alto } = rejilla;
    const dentro = (x2, y2) => x2 >= 0 && y2 >= 0 && x2 < ancho && y2 < alto && datos[y2 * ancho + x2] === 1;
    let inicio = -1;
    for (const p of componente.pixeles) {
      if (inicio < 0 || p < inicio) inicio = p;
    }
    if (inicio < 0) return [];
    const ix = inicio % ancho;
    const iy = inicio / ancho | 0;
    const orden = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1]
    ];
    const puntos = [];
    let x = ix;
    let y = iy;
    let direccion = 0;
    const tope = componente.pixeles.length * 8 + 64;
    for (let paso = 0; paso < tope; paso++) {
      puntos.push([x, y]);
      let siguiente = -1;
      for (let k = 0; k < 8; k++) {
        const d = (direccion + 6 + k) % 8;
        const nx = x + orden[d][0];
        const ny = y + orden[d][1];
        if (dentro(nx, ny)) {
          siguiente = d;
          x = nx;
          y = ny;
          break;
        }
      }
      if (siguiente < 0) break;
      direccion = siguiente;
      if (x === ix && y === iy) break;
    }
    return puntos;
  }
  function contorno(rejilla, componente, toleranciaMm) {
    const enMm = trazarBorde(rejilla, componente).map(
      ([px, py]) => [px * rejilla.mmPorPx, py * rejilla.mmPorPx]
    );
    return simplificar(enMm, toleranciaMm);
  }
  function contornos(rejilla, componente, toleranciaMm, minHuecoMm2 = 0) {
    const exterior = contorno(rejilla, componente, toleranciaMm);
    const mm = rejilla.mmPorPx;
    const huecos = [];
    for (const hueco of huecosLocales(rejilla, componente)) {
      if (hueco.pixeles.length * mm * mm < minHuecoMm2) continue;
      const sub = {
        datos: hueco.mascara,
        ancho: hueco.ancho,
        alto: hueco.alto,
        mmPorPx: mm
      };
      const trazo = trazarBorde(sub, {
        pixeles: hueco.pixeles,
        minX: 0,
        minY: 0,
        maxX: hueco.ancho - 1,
        maxY: hueco.alto - 1
      }).map(
        ([px, py]) => [(px + hueco.offsetX) * mm, (py + hueco.offsetY) * mm]
      );
      const simple = simplificar(trazo, toleranciaMm);
      if (simple.length >= 3) huecos.push(simple);
    }
    return { exterior, huecos };
  }
  function simplificar(puntos, tolerancia) {
    if (puntos.length < 3) return puntos;
    const guardar = new Uint8Array(puntos.length);
    guardar[0] = 1;
    guardar[puntos.length - 1] = 1;
    const pila = [[0, puntos.length - 1]];
    while (pila.length) {
      const [desde, hasta] = pila.pop();
      if (hasta <= desde + 1) continue;
      const [ax, ay] = puntos[desde];
      const [bx, by] = puntos[hasta];
      const dx = bx - ax;
      const dy = by - ay;
      const norma = Math.hypot(dx, dy) || 1;
      let peor = -1;
      let peorD = tolerancia;
      for (let i = desde + 1; i < hasta; i++) {
        const [px, py] = puntos[i];
        const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / norma;
        if (d > peorD) {
          peorD = d;
          peor = i;
        }
      }
      if (peor > 0) {
        guardar[peor] = 1;
        pila.push([desde, peor], [peor, hasta]);
      }
    }
    return puntos.filter((_, i) => guardar[i] === 1);
  }
  function comoPath(puntos, cerrado = true) {
    if (!puntos.length) return "";
    const n2 = (v) => Number(v.toFixed(3)).toString();
    const cuerpo = puntos.map(([x, y], i) => `${i ? "L" : "M"}${n2(x)} ${n2(y)}`).join("");
    return cerrado ? `${cuerpo}Z` : cuerpo;
  }
  function comoPathCompuesto(partes) {
    return [partes.exterior, ...partes.huecos].filter((p) => p.length >= 3).map((p) => comoPath(p, true)).join("");
  }
  function limpiar(rejilla, pasadas = 1) {
    const { ancho, alto } = rejilla;
    let actual = rejilla.datos;
    for (let vuelta = 0; vuelta < pasadas; vuelta++) {
      const siguiente = new Uint8Array(ancho * alto);
      for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
          let vecinos = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= alto) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= ancho) continue;
              vecinos += actual[ny * ancho + nx];
            }
          }
          siguiente[y * ancho + x] = vecinos >= 5 ? 1 : 0;
        }
      }
      actual = siguiente;
    }
    return { ...rejilla, datos: actual };
  }

  // packages/bordado/src/presupuesto.ts
  var COMPLEJIDAD_EXCEDIDA = "COMPLEJIDAD_AUTOMATICA_EXCEDIDA";
  var PresupuestoExcedido = class extends Error {
    recurso;
    medido;
    tope;
    constructor(recurso, medido, tope) {
      super(`presupuesto agotado en ${recurso}: ${medido} > ${tope}`);
      this.name = "PresupuestoExcedido";
      this.recurso = recurso;
      this.medido = medido;
      this.tope = tope;
    }
  };
  function esPresupuestoExcedido(error) {
    return error instanceof PresupuestoExcedido;
  }
  function exigir(recurso, medido, tope) {
    if (medido > tope) throw new PresupuestoExcedido(recurso, medido, tope);
  }
  function incidenciaDeComplejidad() {
    return {
      code: COMPLEJIDAD_EXCEDIDA,
      message: "Este dise\xF1o es demasiado complejo para prepararlo autom\xE1ticamente. Prueba simplificando algunos detalles o usando una imagen m\xE1s sencilla.",
      severity: "review"
    };
  }

  // packages/bordado/src/esqueleto.ts
  var P = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1]
  ];
  function esqueleto(rejilla, caja, coste, maxPasadas = 200) {
    const { ancho, alto } = rejilla;
    const m = Uint8Array.from(rejilla.datos);
    const vecinos = new Uint8Array(8);
    const desdeX = Math.max(0, caja ? caja.minX : 0);
    const hastaX = Math.min(ancho - 1, caja ? caja.maxX : ancho - 1);
    const desdeY = Math.max(0, caja ? caja.minY : 0);
    const hastaY = Math.min(alto - 1, caja ? caja.maxY : alto - 1);
    const leer = (x, y) => x >= 0 && y >= 0 && x < ancho && y < alto ? m[y * ancho + x] : 0;
    let cambio = true;
    let vuelta = 0;
    while (cambio && vuelta < maxPasadas) {
      cambio = false;
      for (const paso of [0, 1]) {
        const borrar = [];
        for (let y = desdeY; y <= hastaY; y++) {
          for (let x = desdeX; x <= hastaX; x++) {
            const i = y * ancho + x;
            if (!m[i]) continue;
            let b = 0;
            for (let k = 0; k < 8; k++) {
              vecinos[k] = leer(x + P[k][0], y + P[k][1]);
              b += vecinos[k];
            }
            if (b < 2 || b > 6) continue;
            let a = 0;
            for (let k = 0; k < 8; k++) {
              if (!vecinos[k] && vecinos[(k + 1) % 8]) a++;
            }
            if (a !== 1) continue;
            const [n2, , e, , s, , o] = vecinos;
            const primera = paso === 0 ? n2 * e * s : n2 * e * o;
            const segunda = paso === 0 ? e * s * o : n2 * s * o;
            if (primera === 0 && segunda === 0) borrar.push(i);
          }
        }
        if (borrar.length) {
          for (const i of borrar) m[i] = 0;
          cambio = true;
        }
      }
      vuelta++;
    }
    if (coste) coste.pasadasAdelgazado += vuelta;
    return { datos: m, convergio: !cambio };
  }
  function costeVacio() {
    return {
      pixelesEsqueleto: 0,
      ramas: 0,
      cruces: 0,
      pasadasAdelgazado: 0,
      fusiones: 0,
      comparacionesFusion: 0,
      msEsqueleto: 0,
      msFusion: 0
    };
  }
  var ahora = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  function percentil2(ordenados, p) {
    if (!ordenados.length) return 0;
    const i = Math.min(
      ordenados.length - 1,
      Math.max(0, Math.round((ordenados.length - 1) * p))
    );
    return ordenados[i];
  }
  function medirRama(recorrido, muestras, rejilla, distancia, toleranciaMm, cerrada, junctionInicio = false, junctionFin = false) {
    const mm = rejilla.mmPorPx;
    const grosores = muestras.map((p) => distancia[p] * 2 * mm).sort((a, b) => a - b);
    const p10 = percentil2(grosores, 0.1);
    const p90 = percentil2(grosores, 0.9);
    const crudos = recorrido.map(
      (p) => [p % rejilla.ancho * mm, (p / rejilla.ancho | 0) * mm]
    );
    let largo = 0;
    for (let i = 1; i < crudos.length; i++) {
      largo += Math.hypot(
        crudos[i][0] - crudos[i - 1][0],
        crudos[i][1] - crudos[i - 1][1]
      );
    }
    const puntos = simplificar(crudos, toleranciaMm);
    const anchosMm = puntos.map(([x, y]) => {
      const px = Math.max(0, Math.min(rejilla.ancho - 1, Math.round(x / mm)));
      const py = Math.max(0, Math.min(rejilla.alto - 1, Math.round(y / mm)));
      return distancia[py * rejilla.ancho + px] * 2 * mm;
    });
    return {
      puntos,
      anchosMm,
      pixeles: recorrido,
      largoMm: largo,
      grosorMedianoMm: percentil2(grosores, 0.5),
      grosorMinimoMm: grosores[0] ?? 0,
      grosorMaximoMm: grosores[grosores.length - 1] ?? 0,
      uniformidad: p90 > 0 ? Math.min(1, p10 / p90) : 0,
      cerrada,
      junctionInicio,
      junctionFin
    };
  }
  function prolongar(camino, mascara, ancho, alto, distancia) {
    const punta = (indices) => {
      const fin = indices[indices.length - 1];
      const atras = indices[Math.max(0, indices.length - 6)];
      let dx = fin % ancho - atras % ancho;
      let dy = (fin / ancho | 0) - (atras / ancho | 0);
      const norma = Math.hypot(dx, dy);
      if (!norma) return [];
      dx /= norma;
      dy /= norma;
      const pasos = Math.ceil(distancia[fin]) + 2;
      const extra = [];
      const x = fin % ancho;
      const y = fin / ancho | 0;
      for (let k = 1; k <= pasos; k++) {
        const nx = Math.round(x + dx * k);
        const ny = Math.round(y + dy * k);
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) break;
        const i = ny * ancho + nx;
        if (!mascara[i]) break;
        if (extra[extra.length - 1] !== i) extra.push(i);
      }
      return extra;
    };
    const cola = punta(camino);
    const cabeza = punta([...camino].reverse());
    return [...cabeza.reverse(), ...camino, ...cola];
  }
  function ramas(rejilla, componente, distancia, toleranciaMm, coste, presupuesto) {
    const { ancho, alto } = rejilla;
    const soloEste = new Uint8Array(ancho * alto);
    for (const p of componente.pixeles) soloEste[p] = 1;
    const caja = {
      minX: componente.minX - 1,
      minY: componente.minY - 1,
      maxX: componente.maxX + 1,
      maxY: componente.maxY + 1
    };
    const desdeEsqueleto = ahora();
    const adelgazado = esqueleto(
      { ...rejilla, datos: soloEste },
      caja,
      coste,
      presupuesto?.maxPasadasAdelgazado
    );
    if (coste) coste.msEsqueleto += ahora() - desdeEsqueleto;
    if (!adelgazado.convergio) return [];
    const hueso = adelgazado.datos;
    const puntos = [];
    for (const p of componente.pixeles) if (hueso[p]) puntos.push(p);
    puntos.sort((a, b) => a - b);
    if (puntos.length < 2) return [];
    const indice = /* @__PURE__ */ new Map();
    puntos.forEach((p, i) => {
      indice.set(p, i);
    });
    const vecinos = puntos.map((p) => {
      const x = p % ancho;
      const y = p / ancho | 0;
      const hay = (dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < ancho && ny < alto && hueso[ny * ancho + nx] === 1;
      };
      const salida = [];
      for (const [dx, dy] of P) {
        if (!hay(dx, dy)) continue;
        if (dx !== 0 && dy !== 0 && (hay(dx, 0) || hay(0, dy))) continue;
        const j = indice.get((y + dy) * ancho + (x + dx));
        if (j !== void 0) salida.push(j);
      }
      return salida;
    });
    const nodo = vecinos.map((v) => v.length !== 2);
    if (coste) {
      coste.pixelesEsqueleto += puntos.length;
      coste.cruces += nodo.filter(Boolean).length;
      if (presupuesto)
        exigir(
          "pixelesEsqueleto",
          coste.pixelesEsqueleto,
          presupuesto.maxPixelesEsqueleto
        );
    }
    const crudas = [];
    const visitado = /* @__PURE__ */ new Set();
    const arista = (a, b) => `${a}>${b}`;
    for (let inicio = 0; inicio < puntos.length; inicio++) {
      if (!nodo[inicio]) continue;
      for (const primero of vecinos[inicio]) {
        if (visitado.has(arista(inicio, primero))) continue;
        const camino = [inicio];
        let previo = inicio;
        let actual = primero;
        while (true) {
          visitado.add(arista(previo, actual));
          visitado.add(arista(actual, previo));
          camino.push(actual);
          if (nodo[actual]) break;
          const siguiente = vecinos[actual].find((v) => v !== previo);
          if (siguiente === void 0) break;
          previo = actual;
          actual = siguiente;
        }
        crudas.push(camino);
      }
    }
    if (!crudas.length) {
      if (!vecinos[0].length) return [];
      const camino = [0];
      let previo = 0;
      let actual = vecinos[0][0];
      while (actual !== void 0 && actual !== 0) {
        camino.push(actual);
        const siguiente = vecinos[actual].find(
          (v) => v !== previo
        );
        previo = actual;
        actual = siguiente;
        if (camino.length > puntos.length) break;
      }
      const enPixeles = camino.map((i) => puntos[i]);
      return [
        medirRama(enPixeles, enPixeles, rejilla, distancia, toleranciaMm, true)
      ];
    }
    if (coste) {
      coste.ramas += crudas.length;
      if (presupuesto) exigir("ramas", coste.ramas, presupuesto.maxRamas);
    }
    const desdeFusion = ahora();
    const enteras = fundirRectas(
      crudas,
      puntos,
      ancho,
      distancia,
      coste,
      presupuesto
    );
    if (coste) coste.msFusion += ahora() - desdeFusion;
    return enteras.map((camino) => {
      const enPixeles = camino.map((i) => puntos[i]);
      return medirRama(
        prolongar(enPixeles, soloEste, ancho, alto, distancia),
        enPixeles,
        rejilla,
        distancia,
        toleranciaMm,
        false,
        vecinos[camino[0]].length >= 3,
        vecinos[camino[camino.length - 1]].length >= 3
      );
    });
  }
  var RECTA = Math.cos(35 * Math.PI / 180);
  function fundirRectas(crudas, puntos, ancho, distancia, coste, presupuesto) {
    const vivas = crudas.map((camino) => [...camino]);
    const muerta = new Uint8Array(vivas.length);
    const grosor = (camino) => {
      const v = camino.map((i) => distancia[puntos[i]]).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)] ?? 0;
    };
    const salida = (camino, alFinal) => {
      const orden = alFinal ? [...camino].reverse() : camino;
      const a = puntos[orden[0]];
      const b = puntos[orden[Math.min(orden.length - 1, 6)]];
      const dx = b % ancho - a % ancho;
      const dy = (b / ancho | 0) - (a / ancho | 0);
      const n2 = Math.hypot(dx, dy) || 1;
      return [dx / n2, dy / n2];
    };
    let hubo = true;
    while (hubo) {
      hubo = false;
      for (let i = 0; i < vivas.length && !hubo; i++) {
        if (muerta[i]) continue;
        for (const iAlFinal of [false, true]) {
          const nodoI = iAlFinal ? vivas[i][vivas[i].length - 1] : vivas[i][0];
          const dirI = salida(vivas[i], iAlFinal);
          const grosorI = grosor(vivas[i]);
          let mejor = -1;
          let mejorAlFinal = false;
          let mejorDot = -RECTA;
          for (let j = 0; j < vivas.length; j++) {
            if (j === i || muerta[j]) continue;
            for (const jAlFinal of [false, true]) {
              if (coste) {
                coste.comparacionesFusion++;
                if (presupuesto)
                  exigir(
                    "comparacionesFusion",
                    coste.comparacionesFusion,
                    presupuesto.maxComparacionesFusion
                  );
              }
              const nodoJ = jAlFinal ? vivas[j][vivas[j].length - 1] : vivas[j][0];
              if (nodoJ !== nodoI) continue;
              const dirJ = salida(vivas[j], jAlFinal);
              const dot = dirI[0] * dirJ[0] + dirI[1] * dirJ[1];
              if (dot >= mejorDot) continue;
              const grosorJ = grosor(vivas[j]);
              const mayor = Math.max(grosorI, grosorJ) || 1;
              if (Math.abs(grosorI - grosorJ) / mayor > 0.35) continue;
              mejor = j;
              mejorAlFinal = jAlFinal;
              mejorDot = dot;
            }
          }
          if (mejor < 0) continue;
          const izquierda = iAlFinal ? vivas[i] : [...vivas[i]].reverse();
          const derecha = mejorAlFinal ? [...vivas[mejor]].reverse() : vivas[mejor];
          vivas[i] = [...izquierda, ...derecha.slice(1)];
          muerta[mejor] = 1;
          if (coste) coste.fusiones++;
          hubo = true;
          break;
        }
      }
    }
    return vivas.filter((_, i) => !muerta[i]);
  }
  function sobranteDe(rejilla, componente, distancia, cubiertas) {
    const { ancho, alto } = rejilla;
    const resto = new Uint8Array(ancho * alto);
    for (const p of componente.pixeles) resto[p] = 1;
    for (const rama of cubiertas) {
      const radio = Math.max(
        1,
        Math.round(rama.grosorMedianoMm / 2 / rejilla.mmPorPx)
      );
      const salto = Math.max(1, Math.floor(radio / 3));
      for (let k = 0; k < rama.pixeles.length; k += salto) {
        const p = rama.pixeles[k];
        const cx = p % ancho;
        const cy = p / ancho | 0;
        const r = Math.ceil(distancia[p]) + 1;
        for (let dy = -r; dy <= r; dy++) {
          const y = cy + dy;
          if (y < 0 || y >= alto) continue;
          const media = Math.floor(Math.sqrt(r * r - dy * dy));
          const desde = Math.max(0, cx - media);
          const hasta = Math.min(ancho - 1, cx + media);
          for (let x = desde; x <= hasta; x++) resto[y * ancho + x] = 0;
        }
      }
    }
    return componentes({ ...rejilla, datos: resto });
  }
  function distanciaDe(rejilla, componente) {
    const soloEste = new Uint8Array(rejilla.ancho * rejilla.alto);
    for (const p of componente.pixeles) soloEste[p] = 1;
    return distanciaAlFondo({ ...rejilla, datos: soloEste });
  }

  // packages/bordado/src/hybrid.ts
  var grados = (radianes) => radianes * 180 / Math.PI;
  function deltaOrientacion(a, b) {
    let delta = Math.abs(a - b) % Math.PI;
    if (delta > Math.PI / 2) delta = Math.PI - delta;
    return Math.abs(grados(delta));
  }
  function promedio(valores) {
    return valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : 0;
  }
  function orientacion(a, b) {
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  function seCruzan(a, b, c, d) {
    const cruz = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const abC = cruz(a, b, c);
    const abD = cruz(a, b, d);
    const cdA = cruz(c, d, a);
    const cdB = cruz(c, d, b);
    return abC * abD < -1e-7 && cdA * cdB < -1e-7;
  }
  function medirComplejidadColumna(rama) {
    const widths = rama.anchosMm.length === rama.puntos.length ? rama.anchosMm : rama.puntos.map(() => rama.grosorMedianoMm);
    const averageWidthMm = promedio(widths);
    const widthVariance = promedio(
      widths.map((width) => (width - averageWidthMm) ** 2)
    );
    const lengths = [];
    const angles = [];
    for (let i = 1; i < rama.puntos.length; i++) {
      const a = rama.puntos[i - 1];
      const b = rama.puntos[i];
      lengths.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
      angles.push(orientacion(a, b));
    }
    const deltas = angles.slice(1).map(
      (angle, index) => deltaOrientacion(angle, angles[index])
    );
    const accumulatedTurningAngleDeg = deltas.reduce(
      (suma, value) => suma + value,
      0
    );
    const lengthMm = lengths.reduce((suma, value) => suma + value, 0);
    const curvaturePeaks = deltas.map(
      (delta, index) => delta / Math.max(0.01, (lengths[index] + lengths[index + 1]) / 2)
    );
    let intersections = 0;
    for (let i = 1; i < rama.puntos.length; i++)
      for (let j = i + 2; j < rama.puntos.length; j++) {
        if (!rama.cerrada && i === 1 && j === rama.puntos.length - 1) continue;
        if (seCruzan(
          rama.puntos[i - 1],
          rama.puntos[i],
          rama.puntos[j - 1],
          rama.puntos[j]
        ))
          intersections++;
      }
    let divergence = 0;
    let convergence = 0;
    for (let i = 1; i < widths.length; i++) {
      const slope = (widths[i] - widths[i - 1]) / Math.max(0.01, lengths[i - 1] ?? 0.01);
      divergence = Math.max(divergence, slope);
      convergence = Math.max(convergence, -slope);
    }
    const endpoints = rama.cerrada ? [averageWidthMm, averageWidthMm] : [widths[0] ?? averageWidthMm, widths.at(-1) ?? averageWidthMm];
    const endpointTaper = averageWidthMm ? Math.max(0, 1 - Math.min(...endpoints) / averageWidthMm) : 0;
    const maxDirectionDeltaDeg = Math.max(0, ...deltas);
    const curvatureDegPerMm = accumulatedTurningAngleDeg / Math.max(0.01, lengthMm);
    const widthVariationRatio = averageWidthMm ? Math.sqrt(widthVariance) / averageWidthMm : 0;
    const fanRisk = Math.min(
      1,
      Math.max(
        maxDirectionDeltaDeg / 40,
        curvatureDegPerMm * averageWidthMm / 12,
        widthVariationRatio / 0.25
      )
    );
    const junctionCount = Number(rama.junctionInicio) + Number(rama.junctionFin);
    return {
      lengthMm: Number(lengthMm.toFixed(3)),
      averageWidthMm: Number(averageWidthMm.toFixed(3)),
      minWidthMm: Number(Math.min(...widths).toFixed(3)),
      maxWidthMm: Number(Math.max(...widths).toFixed(3)),
      widthVariance: Number(widthVariance.toFixed(5)),
      widthVariationRatio: Number(widthVariationRatio.toFixed(5)),
      curvatureDegPerMm: Number(curvatureDegPerMm.toFixed(4)),
      maxCurvatureDegPerMm: Number(Math.max(0, ...curvaturePeaks).toFixed(4)),
      accumulatedTurningAngleDeg: Number(accumulatedTurningAngleDeg.toFixed(3)),
      maxDirectionDeltaDeg: Number(maxDirectionDeltaDeg.toFixed(3)),
      junctionCount,
      branchCount: 1 + junctionCount,
      endpointTaper: Number(endpointTaper.toFixed(4)),
      selfIntersectionRisk: intersections ? 1 : 0,
      fanRisk: Number(fanRisk.toFixed(4)),
      railDivergenceMmPerMm: Number(divergence.toFixed(4)),
      railConvergenceMmPerMm: Number(convergence.toFixed(4)),
      numberOfSharpTurns: deltas.filter((delta) => delta > 25).length
    };
  }
  function decidirRepresentacionSatin(rama, profile) {
    if (!profile.hybrid)
      throw new Error("El perfil no define thresholds h\xEDbridos");
    const metrics = medirComplejidadColumna(rama);
    const limits = profile.hybrid;
    const reasons = [];
    const signals = [];
    const hardReasons = [];
    if (rama.cerrada) signals.push("CLOSED_COLUMN");
    if (metrics.junctionCount) signals.push("JUNCTION");
    if (metrics.curvatureDegPerMm > limits.maxCurvatureDegPerMm)
      signals.push("HIGH_CURVATURE");
    if (metrics.maxCurvatureDegPerMm > limits.maxCurvaturePeakDegPerMm)
      signals.push("CURVATURE_PEAK");
    if (metrics.accumulatedTurningAngleDeg > limits.maxAccumulatedTurnDeg)
      signals.push("ACCUMULATED_TURN");
    if (metrics.maxDirectionDeltaDeg > limits.maxDirectionDeltaDeg)
      signals.push("DIRECTION_CHANGE");
    if (metrics.widthVariationRatio > limits.maxWidthVariationRatio)
      signals.push("WIDTH_VARIANCE");
    if (metrics.railDivergenceMmPerMm > limits.maxRailSlopeMmPerMm || metrics.railConvergenceMmPerMm > limits.maxRailSlopeMmPerMm)
      signals.push("RAIL_NON_PARALLEL");
    if (metrics.endpointTaper > 0.1) signals.push("ENDPOINT_TAPER");
    if (metrics.selfIntersectionRisk) hardReasons.push("SELF_INTERSECTION_RISK");
    if (metrics.fanRisk > limits.maxFanRisk) signals.push("FAN_RISK");
    if (metrics.numberOfSharpTurns > limits.maxSharpTurns)
      signals.push("SHARP_TURN");
    if (metrics.maxWidthMm > profile.quality.maxSatinWidthMm)
      return {
        representationDecision: "fill",
        reasons: ["WIDTH_TOO_LARGE"],
        metrics
      };
    const compositeRisk = !rama.cerrada && metrics.averageWidthMm >= 2.2 && signals.length >= 3;
    const junctionConRiesgo = metrics.junctionCount > 0 && signals.some((senal) => senal !== "JUNCTION" && senal !== "CLOSED_COLUMN");
    if (hardReasons.length || compositeRisk || junctionConRiesgo)
      reasons.push(...hardReasons, ...signals);
    return {
      representationDecision: reasons.length ? "rails-v3" : "stroke-v2",
      reasons,
      metrics
    };
  }

  // packages/bordado/src/profile.ts
  var EMBROIDERY_PROFILE_V1 = Object.freeze({
    version: "experimental-v1-2026-09-05",
    experimental: true,
    physicallyValidated: false,
    limits: {
      maxWidthMm: 90,
      maxHeightMm: 60,
      maxInputBytes: 75e4,
      maxPixels: 12e6,
      maxObjects: 120,
      maxComponents: 100,
      maxNodes: 8e3,
      maxColors: 8,
      maxGradientRatio: 0.18,
      maxTexture: 0.42,
      maxEntropy: 6.8
    },
    stitches: {
      fillSpacingMm: 0.45,
      satinSpacingMm: 0.42,
      maxStitchLengthMm: 4,
      pullCompensationMm: 0.15
    },
    geometria: {
      minAreaMm2: 0.75,
      toleranciaMm: 0.12,
      maxGrosorRunningMm: 1,
      minGrosorSatinMm: 1,
      maxGrosorSatinMm: 8,
      minUniformidadSatin: 0.55,
      minAlargamientoSatin: 2.5,
      minAreaUnderlayMm2: 18
    },
    texto: {
      minAlturaMm: 6,
      minAstaMm: 1.2,
      minContraformaMm2: 0.8
    },
    raster: {
      maxColoresReducidos: 6,
      deltaObjetivoDeltaE: 3,
      maxPerdidaCuantizacionDeltaE: 12,
      maxSuavidadInterior: 0.61,
      maxComponentesLogo: 40
    },
    presupuesto: {
      maxPixelesPrimerPlano: 3e6,
      maxComponentes: 600,
      maxPixelesEsqueleto: 4e4,
      maxRamas: 1500,
      maxComparacionesFusion: 2e6,
      maxPasadasAdelgazado: 200
    },
    quality: {
      // Línea base v2: límites diagnósticos, todavía no bloquean producción.
      maxSatinWidthMm: 8,
      maxAutoSplitSatinWidthMm: 8,
      maxSatinStitchLengthMm: 8,
      maxRunningStitchLengthMm: 4,
      maxFillStitchLengthMm: 4.5,
      maxDirectionDeltaDeg: 55,
      maxLocalOverlap: 0.25,
      maxLocalDensity: 24,
      maxFanAngleDeg: 40,
      maxColumnLengthMm: 24,
      maxAccumulatedTurnDeg: 40,
      railSampleSpacingMm: 1.2,
      junctionInsetRatio: 0.35,
      taperLengthMm: 2.5
    }
  });
  var EMBROIDERY_PROFILE_V2 = Object.freeze({
    ...EMBROIDERY_PROFILE_V1,
    version: "experimental-v2-2026-09-06",
    limits: {
      ...EMBROIDERY_PROFILE_V1.limits,
      /* Los techos de v1 contaban OTRA COSA. Allí un objeto era una forma entera
      		   cosida de relleno y sin contraformas; aquí una letra son varias columnas
      		   —un objeto cada una— y un relleno lleva sus agujeros como subtrazados,
      		   así que la misma "Kustto" pasa de 6 objetos a unos 30 y de 6 subtrazados
      		   a unos 45 sin ser ni un ápice más compleja de bordar.
      
      		   Siguen siendo topes, no permisos: lo que frenan es un diseño que no se
      		   podría coser, y se recalibran con la matriz de test-sew igual que el
      		   resto del perfil. */
      maxObjects: 300,
      maxComponents: 320,
      maxNodes: 4e4
    }
  });
  var EMBROIDERY_PROFILE_V3 = Object.freeze({
    ...EMBROIDERY_PROFILE_V2,
    version: "experimental-v3-2026-09-06",
    geometria: {
      ...EMBROIDERY_PROFILE_V2.geometria,
      // El baseline mostró puntadas de 7.6–8.0 mm en curvas y texto. Por encima
      // de seis milímetros v3 usa fill antes que fabricar un satin de riesgo.
      maxGrosorSatinMm: 6
    },
    quality: {
      ...EMBROIDERY_PROFILE_V2.quality,
      maxSatinWidthMm: 6,
      maxAutoSplitSatinWidthMm: 12,
      maxSatinStitchLengthMm: 6.5,
      maxColumnLengthMm: 60,
      maxAccumulatedTurnDeg: 80,
      railSampleSpacingMm: 2
    }
  });
  var EMBROIDERY_PROFILE_HYBRID_V4 = Object.freeze({
    ...EMBROIDERY_PROFILE_V3,
    version: "experimental-hybrid-v4-2026-09-06",
    quality: {
      ...EMBROIDERY_PROFILE_V3.quality,
      // El baseline v3 mostró que dividir satins de 7+ mm en dos carriles crea
      // cruces y overlap; v4 los deja caer al fill ya existente.
      maxAutoSplitSatinWidthMm: 6,
      // Un rail adaptativo conserva checkpoints internos; no necesita cortar
      // cada 80° y repetir rungs/underlay en cada pedazo.
      maxColumnLengthMm: 100,
      maxAccumulatedTurnDeg: 360
    },
    hybrid: {
      // P75 de las columnas visualmente estables del baseline, redondeado hacia
      // abajo. Los gates se combinan; ninguno decide por sí solo.
      maxCurvatureDegPerMm: 0.8,
      maxCurvaturePeakDegPerMm: 3,
      maxAccumulatedTurnDeg: 14,
      maxDirectionDeltaDeg: 9,
      maxWidthVariationRatio: 0.08,
      maxRailSlopeMmPerMm: 0.08,
      maxFanRisk: 0.35,
      maxSharpTurns: 0,
      // Menor que la tolerancia visual/física del pipeline (0.2 mm), pero evita
      // muestrear una recta a intervalos fijos de 2 mm.
      simplificationErrorMm: 0.16,
      minAdaptiveSpacingMm: 0.8,
      maxAdaptiveSpacingMm: 8,
      joinToleranceMm: 0.2
    }
  });

  // packages/bordado/src/puntada.ts
  function decidirPuntada(medidas, profile, opciones = {}) {
    const g = profile.geometria;
    const incidencias = [];
    if (medidas.areaMm2 < g.minAreaMm2) {
      return {
        tipo: "running",
        motivo: `area ${medidas.areaMm2.toFixed(2)}mm2 < ${g.minAreaMm2}mm2`,
        fabricable: false,
        incidencias: [
          {
            code: "REGION_DEMASIADO_PEQUENA",
            message: "Hay detalles demasiado peque\xF1os para bordarse.",
            severity: "review"
          }
        ]
      };
    }
    if (opciones.esTexto)
      incidencias.push(...revisarLegibilidad(medidas, profile));
    const alargamiento = medidas.grosorMedianoMm > 0 ? medidas.largoEjeMm / medidas.grosorMedianoMm : 0;
    if (medidas.grosorMedianoMm < g.maxGrosorRunningMm) {
      return {
        tipo: "running",
        motivo: `grosor ${medidas.grosorMedianoMm.toFixed(2)}mm < ${g.maxGrosorRunningMm}mm`,
        fabricable: true,
        incidencias
      };
    }
    if (medidas.grosorMedianoMm <= g.maxGrosorSatinMm && medidas.grosorMedianoMm >= g.minGrosorSatinMm && medidas.uniformidad >= g.minUniformidadSatin && alargamiento >= g.minAlargamientoSatin) {
      return {
        tipo: "satin",
        strokeWidthMm: Number(medidas.grosorMedianoMm.toFixed(2)),
        motivo: `columna ${medidas.grosorMedianoMm.toFixed(2)}mm uniformidad ${medidas.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`,
        fabricable: true,
        incidencias
      };
    }
    if (medidas.uniformidad >= g.minUniformidadSatin && alargamiento >= g.minAlargamientoSatin && medidas.grosorMedianoMm > g.maxGrosorSatinMm) {
      incidencias.push({
        code: "COLUMNA_DEMASIADO_ANCHA",
        message: `Un trazo de ${medidas.grosorMedianoMm.toFixed(1)} mm es demasiado ancho para una columna; se borda como relleno.`,
        severity: "review"
      });
    }
    return {
      tipo: "fill",
      motivo: `relleno area ${medidas.areaMm2.toFixed(1)}mm2 grosor ${medidas.grosorMedianoMm.toFixed(2)}mm uniformidad ${medidas.uniformidad.toFixed(2)}`,
      fabricable: true,
      incidencias
    };
  }
  function parametrosDe(decision, medidas, profile, indice) {
    if (decision.tipo === "satin") {
      return {
        type: "satin",
        strokeWidthMm: decision.strokeWidthMm,
        spacingMm: profile.stitches.satinSpacingMm,
        pullCompensationMm: profile.stitches.pullCompensationMm,
        underlay: true
      };
    }
    if (decision.tipo === "running") {
      return {
        type: "running",
        // Fino a propósito: el stroke de un running no es el ancho de nada, sólo
        // le dice al motor por dónde pasar.
        strokeWidthMm: 0.3,
        maxStitchLengthMm: profile.stitches.maxStitchLengthMm
      };
    }
    return {
      type: "fill",
      spacingMm: profile.stitches.fillSpacingMm,
      // Ángulos alternados entre objetos: dos rellenos contiguos en la misma
      // dirección se leen como una sola mancha.
      angleDeg: indice % 4 * 45,
      maxStitchLengthMm: profile.stitches.maxStitchLengthMm,
      underlay: medidas.areaMm2 >= profile.geometria.minAreaUnderlayMm2,
      pullCompensationMm: profile.stitches.pullCompensationMm
    };
  }
  function revisarLegibilidad(medidas, profile) {
    const incidencias = [];
    if (medidas.altoMm < profile.texto.minAlturaMm) {
      incidencias.push({
        code: "TEXTO_DEMASIADO_PEQUENO",
        message: `El texto mide ${medidas.altoMm.toFixed(1)} mm de alto; por debajo de ${profile.texto.minAlturaMm} mm no se lee bordado.`,
        severity: "reject"
      });
    }
    if (medidas.grosorMedianoMm < profile.texto.minAstaMm) {
      incidencias.push({
        code: "ASTA_DEMASIADO_FINA",
        message: `Los trazos de esta tipograf\xEDa miden ${medidas.grosorMedianoMm.toFixed(2)} mm; el m\xEDnimo para bordar es ${profile.texto.minAstaMm} mm.`,
        severity: "reject"
      });
    }
    const cerradas = medidas.huecosMm2.filter(
      (area) => area > 0 && area < profile.texto.minContraformaMm2
    );
    if (cerradas.length) {
      incidencias.push({
        code: "CONTRAFORMA_PEQUENA",
        message: `Hay ${cerradas.length} hueco(s) interior(es) que se cerrar\xEDan al bordar.`,
        severity: "review"
      });
    }
    return incidencias;
  }
  function decidirDeRama(rama, profile) {
    const g = profile.geometria;
    if (rama.largoMm <= rama.grosorMedianoMm) {
      return { tipo: "ninguna", motivo: "rabillo de cruce" };
    }
    if (rama.grosorMedianoMm < g.maxGrosorRunningMm) {
      return {
        tipo: "running",
        motivo: `grosor ${rama.grosorMedianoMm.toFixed(2)}mm`
      };
    }
    const alargamiento = rama.largoMm / (rama.grosorMedianoMm || 1);
    if (rama.grosorMedianoMm <= (profile.version.startsWith("experimental-v3") || profile.hybrid ? profile.quality.maxAutoSplitSatinWidthMm : g.maxGrosorSatinMm) && rama.grosorMedianoMm >= g.minGrosorSatinMm && rama.uniformidad >= g.minUniformidadSatin && alargamiento >= g.minAlargamientoSatin) {
      return {
        tipo: "satin",
        strokeWidthMm: Number(rama.grosorMedianoMm.toFixed(2)),
        motivo: `columna ${rama.grosorMedianoMm.toFixed(2)}mm uniformidad ${rama.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`
      };
    }
    return {
      tipo: "ninguna",
      motivo: `no es columna: grosor ${rama.grosorMedianoMm.toFixed(2)}mm uniformidad ${rama.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`
    };
  }

  // packages/bordado/src/satin.ts
  var n = (value) => Number(value.toFixed(3)).toString();
  var punto = ([x, y], primero) => `${primero ? "M" : "L"}${n(x)} ${n(y)}`;
  function deltaAngulo(a, b) {
    let delta = Math.abs(a - b) % Math.PI;
    if (delta > Math.PI / 2) delta = Math.PI - delta;
    return Math.abs(delta);
  }
  function interpolarCamino(puntos, anchos, espaciado, cerrada) {
    if (puntos.length < 2) return { puntos: [...puntos], anchos: [...anchos] };
    const base = [...puntos];
    const widths = [...anchos];
    if (cerrada && Math.hypot(base[0][0] - base.at(-1)[0], base[0][1] - base.at(-1)[1]) > 1e-6) {
      base.push(base[0]);
      widths.push(widths[0]);
    }
    const acumulado = [0];
    for (let i = 1; i < base.length; i++)
      acumulado.push(
        acumulado[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1])
      );
    const total = acumulado.at(-1) ?? 0;
    if (total <= 1e-6) return { puntos: [base[0]], anchos: [widths[0]] };
    const cantidad = Math.max(2, Math.ceil(total / espaciado) + 1);
    const salida = [];
    const salidaAnchos = [];
    let segmento = 1;
    for (let i = 0; i < cantidad; i++) {
      const distancia = i / (cantidad - 1) * total;
      while (segmento < acumulado.length - 1 && acumulado[segmento] < distancia)
        segmento++;
      const desde = acumulado[segmento - 1];
      const largo = Math.max(1e-9, acumulado[segmento] - desde);
      const t = Math.min(1, Math.max(0, (distancia - desde) / largo));
      const a = base[segmento - 1];
      const b = base[segmento];
      salida.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      salidaAnchos.push(
        widths[segmento - 1] + (widths[segmento] - widths[segmento - 1]) * t
      );
    }
    return { puntos: salida, anchos: salidaAnchos };
  }
  function recortarExtremo(puntos, anchos, distancia, desdeInicio) {
    if (distancia <= 0 || puntos.length < 4) return { puntos, anchos };
    const orden = desdeInicio ? puntos.map((_, i) => i) : puntos.map((_, i) => puntos.length - 1 - i);
    let recorrido = 0;
    let cortar = 0;
    for (let k = 1; k < orden.length - 2; k++) {
      const a = puntos[orden[k - 1]];
      const b = puntos[orden[k]];
      recorrido += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (recorrido >= distancia) {
        cortar = k;
        break;
      }
    }
    if (!cortar) return { puntos, anchos };
    return desdeInicio ? { puntos: puntos.slice(cortar), anchos: anchos.slice(cortar) } : { puntos: puntos.slice(0, -cortar), anchos: anchos.slice(0, -cortar) };
  }
  function recortarRamaEnJunctions(rama, profile) {
    if (rama.cerrada || !rama.junctionInicio && !rama.junctionFin) return rama;
    let puntos = rama.puntos;
    let anchos = rama.anchosMm;
    const inset = rama.grosorMedianoMm * profile.quality.junctionInsetRatio;
    if (rama.junctionInicio)
      ({ puntos, anchos } = recortarExtremo(puntos, anchos, inset, true));
    if (rama.junctionFin)
      ({ puntos, anchos } = recortarExtremo(puntos, anchos, inset, false));
    const pasoPxMm = rama.largoMm / Math.max(1, rama.pixeles.length - 1);
    const quitar = Math.max(0, Math.round(inset / Math.max(pasoPxMm, 0.01)));
    const desde = rama.junctionInicio ? Math.min(quitar, rama.pixeles.length - 2) : 0;
    const hasta = rama.junctionFin ? Math.max(desde + 2, rama.pixeles.length - quitar) : rama.pixeles.length;
    return {
      ...rama,
      puntos,
      anchosMm: anchos,
      pixeles: rama.pixeles.slice(desde, hasta),
      largoMm: Math.max(
        0,
        rama.largoMm - (rama.junctionInicio ? inset : 0) - (rama.junctionFin ? inset : 0)
      )
    };
  }
  function suavizar(valores, radio = 2) {
    return valores.map((_, i) => {
      let suma = 0;
      let cuenta = 0;
      for (let j = Math.max(0, i - radio); j <= Math.min(valores.length - 1, i + radio); j++) {
        suma += valores[j];
        cuenta++;
      }
      return suma / cuenta;
    });
  }
  function orientar(puntos, anchos) {
    const salida = [];
    let normalAnterior;
    for (let i = 0; i < puntos.length; i++) {
      const a = puntos[Math.max(0, i - 2)];
      const b = puntos[Math.min(puntos.length - 1, i + 2)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const norma = Math.hypot(dx, dy) || 1;
      let normal = [-dy / norma, dx / norma];
      if (normalAnterior && normal[0] * normalAnterior[0] + normal[1] * normalAnterior[1] < 0)
        normal = [-normal[0], -normal[1]];
      normalAnterior = normal;
      salida.push({
        centro: puntos[i],
        ancho: anchos[i],
        angulo: Math.atan2(dy, dx),
        normal
      });
    }
    return salida;
  }
  function compactarMuestras(muestras) {
    if (muestras.length < 3) return muestras;
    const salida = [muestras[0]];
    let recorrido = 0;
    for (let i = 1; i < muestras.length - 1; i++) {
      recorrido += Math.hypot(
        muestras[i].centro[0] - muestras[i - 1].centro[0],
        muestras[i].centro[1] - muestras[i - 1].centro[1]
      );
      const ultimo = salida.at(-1);
      const giro = deltaAngulo(ultimo.angulo, muestras[i].angulo) * 180 / Math.PI;
      if (giro >= 4 || Math.abs(ultimo.ancho - muestras[i].ancho) >= 0.1 || recorrido >= 8) {
        salida.push(muestras[i]);
        recorrido = 0;
      }
    }
    salida.push(muestras.at(-1));
    return salida;
  }
  function rangos(muestras, profile, maxTurnDeg = profile.quality.maxAccumulatedTurnDeg) {
    const salida = [];
    let inicio = 0;
    let largo = 0;
    let giro = 0;
    for (let i = 1; i < muestras.length; i++) {
      largo += Math.hypot(
        muestras[i].centro[0] - muestras[i - 1].centro[0],
        muestras[i].centro[1] - muestras[i - 1].centro[1]
      );
      giro += deltaAngulo(muestras[i].angulo, muestras[i - 1].angulo) * 180 / Math.PI;
      if (i - inicio >= 4 && (largo >= profile.quality.maxColumnLengthMm || giro >= maxTurnDeg)) {
        salida.push([inicio, i]);
        inicio = i;
        largo = 0;
        giro = 0;
      }
    }
    if (muestras.length - 1 - inicio < 3 && salida.length) {
      salida[salida.length - 1][1] = muestras.length - 1;
    } else {
      salida.push([inicio, muestras.length - 1]);
    }
    return salida;
  }
  function varianza(valores) {
    if (!valores.length) return 0;
    const promedio3 = valores.reduce((a, b) => a + b, 0) / valores.length;
    return valores.reduce((suma, value) => suma + (value - promedio3) ** 2, 0) / valores.length;
  }
  function promedio2(valores) {
    return valores.length ? valores.reduce((suma, value) => suma + value, 0) / valores.length : 0;
  }
  function construirSatinManual(rama, profile) {
    if (rama.grosorMedianoMm > profile.quality.maxSatinWidthMm && rama.grosorMedianoMm <= profile.quality.maxAutoSplitSatinWidthMm) {
      const base = orientar(rama.puntos, rama.anchosMm);
      const crearCarril = (signo) => ({
        ...rama,
        puntos: base.map((m) => [
          m.centro[0] + m.normal[0] * m.ancho * 0.25 * signo,
          m.centro[1] + m.normal[1] * m.ancho * 0.25 * signo
        ]),
        anchosMm: rama.anchosMm.map((width) => width / 2),
        grosorMedianoMm: rama.grosorMedianoMm / 2,
        grosorMinimoMm: rama.grosorMinimoMm / 2,
        grosorMaximoMm: rama.grosorMaximoMm / 2
      });
      return [
        ...construirSatinManual(crearCarril(-1), profile),
        ...construirSatinManual(crearCarril(1), profile)
      ];
    }
    let { puntos, anchos } = interpolarCamino(
      rama.puntos,
      rama.anchosMm.length === rama.puntos.length ? rama.anchosMm : rama.puntos.map(() => rama.grosorMedianoMm),
      profile.quality.railSampleSpacingMm,
      rama.cerrada
    );
    if (puntos.length < 3) return [];
    anchos = suavizar(anchos).map((value, i) => {
      let factor = 1;
      if (!rama.cerrada && !rama.junctionInicio)
        factor = Math.min(
          factor,
          0.42 + 0.58 * Math.min(
            1,
            i * profile.quality.railSampleSpacingMm / profile.quality.taperLengthMm
          )
        );
      if (!rama.cerrada && !rama.junctionFin)
        factor = Math.min(
          factor,
          0.42 + 0.58 * Math.min(
            1,
            (anchos.length - 1 - i) * profile.quality.railSampleSpacingMm / profile.quality.taperLengthMm
          )
        );
      return Math.min(
        profile.quality.maxSatinWidthMm,
        Math.max(0.65, value * factor)
      );
    });
    const muestras = compactarMuestras(orientar(puntos, anchos));
    const cortes = rangos(muestras, profile);
    const total = cortes.length;
    return cortes.map(([desde, hasta], segmentIndex) => {
      const tramo = muestras.slice(desde, hasta + 1);
      const izquierda = tramo.map(
        (m) => [
          m.centro[0] + m.normal[0] * m.ancho / 2,
          m.centro[1] + m.normal[1] * m.ancho / 2
        ]
      );
      const derecha = tramo.map(
        (m) => [
          m.centro[0] - m.normal[0] * m.ancho / 2,
          m.centro[1] - m.normal[1] * m.ancho / 2
        ]
      );
      const rail = (lista) => lista.map((p, i) => punto(p, i === 0)).join("");
      const indices = [
        .../* @__PURE__ */ new Set([0, Math.floor((tramo.length - 1) / 2), tramo.length - 1])
      ];
      const rungs = indices.map((i) => {
        const extension = 0.12;
        const normal = tramo[i].normal;
        const a = [
          izquierda[i][0] + normal[0] * extension,
          izquierda[i][1] + normal[1] * extension
        ];
        const b = [
          derecha[i][0] - normal[0] * extension,
          derecha[i][1] - normal[1] * extension
        ];
        return `${punto(a, true)}${punto(b, false)}`;
      });
      const widths = tramo.map((m) => m.ancho);
      const angles = tramo.map((m) => m.angulo);
      const deltas = angles.slice(1).map((angle, i) => deltaAngulo(angle, angles[i]) * 180 / Math.PI);
      return {
        d: [rail(izquierda), rail(derecha), ...rungs].join(""),
        puntos: [...izquierda, ...derecha],
        quality: {
          minWidthMm: Number(Math.min(...widths).toFixed(3)),
          maxWidthMm: Number(Math.max(...widths).toFixed(3)),
          averageWidthMm: Number(
            (widths.reduce((a, b) => a + b, 0) / widths.length).toFixed(3)
          ),
          widthVariance: Number(varianza(widths).toFixed(5)),
          angleVariance: Number(varianza(deltas).toFixed(5)),
          maxAngleDeltaDeg: Number(Math.max(0, ...deltas).toFixed(3)),
          junctionCount: Number(segmentIndex === 0 && rama.junctionInicio) + Number(segmentIndex === total - 1 && rama.junctionFin),
          segmentIndex,
          segmentCount: total
        }
      };
    });
  }
  function distanciaPuntoSegmento(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;
    if (length2 <= 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)
    );
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function simplificarAdaptativo(muestras, desde, hasta, errorMm, maxSpacingMm, seleccionados) {
    if (hasta <= desde + 1) return;
    const a = muestras[desde];
    const b = muestras[hasta];
    let largo = 0;
    for (let i = desde + 1; i <= hasta; i++)
      largo += Math.hypot(
        muestras[i].centro[0] - muestras[i - 1].centro[0],
        muestras[i].centro[1] - muestras[i - 1].centro[1]
      );
    let peor = -1;
    let indice = -1;
    for (let i = desde + 1; i < hasta; i++) {
      const t = (i - desde) / (hasta - desde);
      const widthError = Math.abs(
        muestras[i].ancho - (a.ancho + (b.ancho - a.ancho) * t)
      );
      const spatialError = distanciaPuntoSegmento(
        muestras[i].centro,
        a.centro,
        b.centro
      );
      const score = Math.max(
        spatialError / errorMm,
        widthError / Math.max(0.08, errorMm)
      );
      if (score > peor) {
        peor = score;
        indice = i;
      }
    }
    if (peor > 1 || largo > maxSpacingMm) {
      if (largo > maxSpacingMm && peor <= 1) indice = Math.floor((desde + hasta) / 2);
      seleccionados.add(indice);
      simplificarAdaptativo(
        muestras,
        desde,
        indice,
        errorMm,
        maxSpacingMm,
        seleccionados
      );
      simplificarAdaptativo(
        muestras,
        indice,
        hasta,
        errorMm,
        maxSpacingMm,
        seleccionados
      );
    }
  }
  function indicesRungs(muestras, maxSpacingMm) {
    const elegidos = /* @__PURE__ */ new Set([0, muestras.length - 1]);
    let desdeUltimo = 0;
    for (let i = 1; i < muestras.length - 1; i++) {
      desdeUltimo += Math.hypot(
        muestras[i].centro[0] - muestras[i - 1].centro[0],
        muestras[i].centro[1] - muestras[i - 1].centro[1]
      );
      const giro = deltaAngulo(muestras[i - 1].angulo, muestras[i + 1].angulo) * 180 / Math.PI;
      const ancho = Math.abs(muestras[i + 1].ancho - muestras[i - 1].ancho);
      if (giro >= 12 || ancho >= 0.18 || desdeUltimo >= maxSpacingMm) {
        elegidos.add(i);
        desdeUltimo = 0;
      }
    }
    if (elegidos.size < 3) elegidos.add(Math.floor((muestras.length - 1) / 2));
    let indices = [...elegidos].sort((a, b) => a - b);
    if (indices.length > 5) {
      indices = Array.from(
        { length: 5 },
        (_, i) => indices[Math.round(i * (indices.length - 1) / 4)]
      );
    }
    return [...new Set(indices)];
  }
  function construirSatinManualAdaptativo(rama, profile) {
    if (!profile.hybrid)
      throw new Error("El perfil no define muestreo h\xEDbrido");
    if (rama.grosorMedianoMm > profile.quality.maxSatinWidthMm && rama.grosorMedianoMm <= profile.quality.maxAutoSplitSatinWidthMm) {
      const base = orientar(rama.puntos, rama.anchosMm);
      const crearCarril = (signo) => ({
        ...rama,
        puntos: base.map((m) => [
          m.centro[0] + m.normal[0] * m.ancho * 0.25 * signo,
          m.centro[1] + m.normal[1] * m.ancho * 0.25 * signo
        ]),
        anchosMm: rama.anchosMm.map((width) => width / 2),
        grosorMedianoMm: rama.grosorMedianoMm / 2,
        grosorMinimoMm: rama.grosorMinimoMm / 2,
        grosorMaximoMm: rama.grosorMaximoMm / 2
      });
      return [
        ...construirSatinManualAdaptativo(crearCarril(-1), profile),
        ...construirSatinManualAdaptativo(crearCarril(1), profile)
      ];
    }
    const decision = decidirRepresentacionSatin(rama, profile);
    let { puntos, anchos } = interpolarCamino(
      rama.puntos,
      rama.anchosMm.length === rama.puntos.length ? rama.anchosMm : rama.puntos.map(() => rama.grosorMedianoMm),
      profile.hybrid.minAdaptiveSpacingMm,
      rama.cerrada
    );
    if (puntos.length < 3) return [];
    anchos = suavizar(anchos).map((value, i) => {
      let factor = 1;
      const distanciaInicio = i * profile.hybrid.minAdaptiveSpacingMm;
      const distanciaFin = (anchos.length - 1 - i) * profile.hybrid.minAdaptiveSpacingMm;
      if (!rama.cerrada && !rama.junctionInicio)
        factor = Math.min(
          factor,
          0.42 + 0.58 * Math.min(1, distanciaInicio / profile.quality.taperLengthMm)
        );
      if (!rama.cerrada && !rama.junctionFin)
        factor = Math.min(
          factor,
          0.42 + 0.58 * Math.min(1, distanciaFin / profile.quality.taperLengthMm)
        );
      return Math.min(profile.quality.maxSatinWidthMm, Math.max(0.65, value * factor));
    });
    const densas = orientar(puntos, anchos);
    const keep = /* @__PURE__ */ new Set([0, densas.length - 1]);
    simplificarAdaptativo(
      densas,
      0,
      densas.length - 1,
      profile.hybrid.simplificationErrorMm,
      profile.hybrid.maxAdaptiveSpacingMm,
      keep
    );
    const muestras = [...keep].sort((a, b) => a - b).map((index) => densas[index]);
    const cortes = rangos(muestras, profile, rama.cerrada ? 80 : void 0);
    const total = cortes.length;
    return cortes.map(([desde, hasta], segmentIndex) => {
      const tramo = muestras.slice(desde, hasta + 1);
      const izquierda = tramo.map(
        (m) => [
          m.centro[0] + m.normal[0] * m.ancho / 2,
          m.centro[1] + m.normal[1] * m.ancho / 2
        ]
      );
      const derecha = tramo.map(
        (m) => [
          m.centro[0] - m.normal[0] * m.ancho / 2,
          m.centro[1] - m.normal[1] * m.ancho / 2
        ]
      );
      const rail = (lista) => lista.map((p, i) => punto(p, i === 0)).join("");
      const indices = indicesRungs(tramo, profile.hybrid.maxAdaptiveSpacingMm);
      const rungs = indices.map((i) => {
        const normal = tramo[i].normal;
        const extension = 0.12;
        return `${punto(
          [
            izquierda[i][0] + normal[0] * extension,
            izquierda[i][1] + normal[1] * extension
          ],
          true
        )}${punto(
          [
            derecha[i][0] - normal[0] * extension,
            derecha[i][1] - normal[1] * extension
          ],
          false
        )}`;
      });
      const widths = tramo.map((m) => m.ancho);
      const angles = tramo.map((m) => m.angulo);
      const deltas = angles.slice(1).map((angle, i) => deltaAngulo(angle, angles[i]) * 180 / Math.PI);
      const segmentLength = tramo.slice(1).reduce(
        (sum, item, i) => sum + Math.hypot(item.centro[0] - tramo[i].centro[0], item.centro[1] - tramo[i].centro[1]),
        0
      );
      return {
        d: [rail(izquierda), rail(derecha), ...rungs].join(""),
        puntos: [...izquierda, ...derecha],
        quality: {
          minWidthMm: Number(Math.min(...widths).toFixed(3)),
          maxWidthMm: Number(Math.max(...widths).toFixed(3)),
          averageWidthMm: Number(promedio2(widths).toFixed(3)),
          widthVariance: Number(varianza(widths).toFixed(5)),
          angleVariance: Number(varianza(deltas).toFixed(5)),
          maxAngleDeltaDeg: Number(Math.max(0, ...deltas).toFixed(3)),
          junctionCount: Number(segmentIndex === 0 && rama.junctionInicio) + Number(segmentIndex === total - 1 && rama.junctionFin),
          segmentIndex,
          segmentCount: total,
          representationDecision: "rails-v3",
          representationReasons: decision.reasons,
          lengthMm: Number(segmentLength.toFixed(3)),
          curvatureDegPerMm: decision.metrics.curvatureDegPerMm,
          maxCurvatureDegPerMm: decision.metrics.maxCurvatureDegPerMm,
          accumulatedTurningAngleDeg: decision.metrics.accumulatedTurningAngleDeg,
          branchCount: decision.metrics.branchCount,
          endpointTaper: decision.metrics.endpointTaper,
          selfIntersectionRisk: decision.metrics.selfIntersectionRisk,
          fanRisk: decision.metrics.fanRisk,
          railDivergenceMmPerMm: decision.metrics.railDivergenceMmPerMm,
          railConvergenceMmPerMm: decision.metrics.railConvergenceMmPerMm,
          numberOfSharpTurns: decision.metrics.numberOfSharpTurns,
          rawCenterlineNodes: rama.puntos.length,
          rawRailNodes: densas.length * 2,
          finalRailNodes: tramo.length * 2,
          rungsBefore: densas.length,
          rungsAfter: indices.length,
          underlayLayers: segmentIndex === 0 ? 1 : 0,
          estimatedUnderlayStitches: segmentIndex === 0 ? Math.ceil(segmentLength / 2.2) : 0
        }
      };
    });
  }

  // packages/bordado/src/types.ts
  var EMBROIDERY_SCHEMA_VERSION = 1;
  var INKSTITCH_ENGINE_VERSION = "inkstitch-3.3.0";

  // apps/web/lib/bordado/color.ts
  function colorIdDe(hex) {
    return `color-${normalizarHex(hex).slice(1)}`;
  }
  function normalizarHex(raw) {
    if (!raw || raw === "none") return "#111111";
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw))
      return `#${raw.slice(1).split("").map((parte) => parte + parte).join("")}`.toLowerCase();
    const rgb = raw.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    return rgb ? `#${rgb.slice(1, 4).map((valor) => Number(valor).toString(16).padStart(2, "0")).join("")}` : "#111111";
  }

  // apps/web/lib/bordado/cronometro.ts
  var ahora2 = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  function crearCronometro() {
    const etapas = {};
    return {
      etapas,
      sumar(etapa, ms) {
        etapas[etapa] = (etapas[etapa] ?? 0) + ms;
      },
      medir(etapa, fn) {
        const desde = ahora2();
        const salida = fn();
        etapas[etapa] = (etapas[etapa] ?? 0) + (ahora2() - desde);
        return salida;
      }
    };
  }

  // apps/web/lib/bordado/formas.ts
  var import_svgpath = __toESM(require_svgpath2());
  function contarNodos(d) {
    return Math.max(1, (d.match(/[MmLlHhVvCcSsQqTtAa]/g) ?? []).length);
  }
  function cajaDe(puntos) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of puntos) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return {
      xMm: minX,
      yMm: minY,
      widthMm: Math.max(0.05, maxX - minX),
      heightMm: Math.max(0.05, maxY - minY)
    };
  }
  function objetosDeMascara(entrada) {
    const { rejilla, profile, desplazamientoMm } = entrada;
    const objetos = [];
    const incidencias = [];
    const conteo = { satin: 0, running: 0, fill: 0 };
    let eliminadas = 0;
    let eliminadasMm2 = 0;
    const reloj = entrada.cronometro;
    const medirCon = (etapa, fn) => reloj ? reloj.medir(etapa, fn) : fn();
    const partes = medirCon(
      "segmentation",
      () => medirCon("analisisComponentes", () => componentes(rejilla))
    );
    const mover = (d) => (0, import_svgpath.default)(d).translate(-desplazamientoMm, -desplazamientoMm).round(3).toString();
    const emitir = (d, puntos, stitch, quality) => {
      const movido = mover(d);
      if (!movido) return;
      const caja = cajaDe(puntos);
      objetos.push({
        id: `${entrada.prefijo}-${objetos.length}`,
        sourceObjectId: entrada.sourceObjectId,
        sourceType: entrada.sourceType,
        classification: entrada.classification,
        colorId: entrada.colorId,
        geometry: {
          kind: "path",
          d: movido,
          fillRule: stitch.type === "fill" ? "evenodd" : void 0
        },
        stitch,
        quality,
        bounds: {
          xMm: Math.max(0, caja.xMm - desplazamientoMm),
          yMm: Math.max(0, caja.yMm - desplazamientoMm),
          widthMm: caja.widthMm,
          heightMm: caja.heightMm
        },
        nodeCount: contarNodos(movido)
      });
      conteo[stitch.type]++;
    };
    for (const parte of partes) {
      const distancia = medirCon("distancia", () => distanciaDe(rejilla, parte));
      const medidas = medirCon(
        "medicion",
        () => medir(rejilla, parte, distancia)
      );
      if (medidas.areaMm2 < profile.geometria.minAreaMm2) {
        eliminadas++;
        eliminadasMm2 += medidas.areaMm2;
        continue;
      }
      if (entrada.esTexto) {
        incidencias.push(...revisarLegibilidad(medidas, profile));
      }
      const todas = medirCon(
        "skeleton",
        () => medirCon(
          "esqueleto",
          () => ramas(
            rejilla,
            parte,
            distancia,
            profile.geometria.toleranciaMm,
            entrada.coste,
            profile.presupuesto
          )
        )
      );
      const columnas = [];
      for (const rama of todas) {
        const decision = medirCon(
          "stitchTypeAssignment",
          () => decidirDeRama(rama, profile)
        );
        if (decision.tipo !== "ninguna") {
          const representacion = decision.tipo === "satin" && profile.hybrid ? decidirRepresentacionSatin(rama, profile) : void 0;
          columnas.push({
            rama,
            cobertura: decision.tipo === "satin" && (profile.version.startsWith("experimental-v3") || representacion?.representationDecision === "rails-v3") ? medirCon(
              "junctionHandling",
              () => recortarRamaEnJunctions(rama, profile)
            ) : rama,
            decision,
            representacion
          });
        }
      }
      if (!columnas.length) {
        const decision = decidirPuntada(medidas, profile, {
          esTexto: entrada.esTexto
        });
        incidencias.push(
          ...decision.incidencias.filter(
            (i) => !incidencias.some((y) => y.code === i.code)
          )
        );
        if (!decision.fabricable) {
          eliminadas++;
          eliminadasMm2 += medidas.areaMm2;
          continue;
        }
        const trazos = medirCon(
          "vectorGeometry",
          () => medirCon(
            "contornos",
            () => contornos(
              rejilla,
              parte,
              profile.geometria.toleranciaMm,
              profile.texto.minContraformaMm2
            )
          )
        );
        emitir(
          comoPathCompuesto(trazos),
          trazos.exterior,
          parametrosDe(decision, medidas, profile, objetos.length)
        );
        continue;
      }
      for (const { rama, cobertura, decision, representacion } of columnas) {
        const d = comoPath(rama.puntos, rama.cerrada);
        if (decision.tipo === "satin") {
          if (profile.version.startsWith("experimental-v3") || representacion?.representationDecision === "rails-v3") {
            const segmentos = medirCon(
              "rails",
              () => profile.hybrid ? construirSatinManualAdaptativo(cobertura, profile) : construirSatinManual(cobertura, profile)
            );
            for (const segmento of segmentos)
              emitir(
                segmento.d,
                segmento.puntos,
                {
                  type: "satin",
                  satinMode: "rails",
                  spacingMm: profile.stitches.satinSpacingMm,
                  pullCompensationMm: profile.stitches.pullCompensationMm,
                  underlay: !profile.hybrid || segmento.quality.segmentIndex === 0
                },
                segmento.quality
              );
          } else {
            emitir(
              d,
              rama.puntos,
              {
                type: "satin",
                satinMode: profile.hybrid ? "stroke" : void 0,
                strokeWidthMm: decision.strokeWidthMm,
                spacingMm: profile.stitches.satinSpacingMm,
                pullCompensationMm: profile.stitches.pullCompensationMm,
                underlay: true
              },
              representacion ? {
                ...representacion.metrics,
                representationDecision: "stroke-v2",
                representationReasons: [],
                rawCenterlineNodes: rama.puntos.length,
                rawRailNodes: 0,
                finalRailNodes: 0,
                rungsBefore: 0,
                rungsAfter: 0,
                underlayLayers: 1,
                estimatedUnderlayStitches: Math.ceil(rama.largoMm / 2.2)
              } : void 0
            );
          }
        } else {
          emitir(d, rama.puntos, {
            type: "running",
            // Fino a propósito: en un running el stroke no es el ancho de nada,
            // sólo le dice al motor por dónde pasar.
            strokeWidthMm: 0.3,
            maxStitchLengthMm: profile.stitches.maxStitchLengthMm
          });
        }
      }
      const sobrantes = medirCon(
        "sobrante",
        () => sobranteDe(
          rejilla,
          parte,
          distancia,
          columnas.map((c) => c.cobertura)
        )
      );
      for (const resto of sobrantes) {
        const suyas = medirCon(
          "medicion",
          () => medir(rejilla, resto, distanciaDe(rejilla, resto))
        );
        if (suyas.areaMm2 < profile.geometria.minAreaMm2) {
          eliminadas++;
          eliminadasMm2 += suyas.areaMm2;
          continue;
        }
        const trazos = medirCon(
          "vectorGeometry",
          () => medirCon(
            "contornos",
            () => contornos(
              rejilla,
              resto,
              profile.geometria.toleranciaMm,
              profile.texto.minContraformaMm2
            )
          )
        );
        emitir(
          comoPathCompuesto(trazos),
          trazos.exterior,
          parametrosDe(
            {
              tipo: "fill",
              motivo: "sobrante de las columnas",
              fabricable: true,
              incidencias: []
            },
            suyas,
            profile,
            objetos.length
          )
        );
      }
    }
    return {
      objetos,
      incidencias: incidencias.filter(
        (issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i
      ),
      conteo,
      eliminadas,
      eliminadasMm2: Number(eliminadasMm2.toFixed(3))
    };
  }

  // apps/web/lib/impresion/mascara.ts
  var LINEAL = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    LINEAL[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  var f = (t) => t > 0.008856451679 ? Math.cbrt(t) : 7.787037 * t + 16 / 116;
  var memoria = /* @__PURE__ */ new Map();
  function aLab(r, g, b) {
    const llave = r << 16 | g << 8 | b;
    const guardado = memoria.get(llave);
    if (guardado) return guardado;
    const R = LINEAL[r];
    const G = LINEAL[g];
    const B = LINEAL[b];
    const x = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
    const y = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
    const z = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
    const lab = [
      116 * y - 16,
      500 * (x - y),
      200 * (y - z)
    ];
    if (memoria.size < 4e4) memoria.set(llave, lab);
    return lab;
  }
  function fondoDe(datos, ancho, alto) {
    const grosor = Math.max(2, Math.round(Math.min(ancho, alto) * 0.02));
    const rs = [];
    const gs = [];
    const bs = [];
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const borde = x < grosor || y < grosor || x >= ancho - grosor || y >= alto - grosor;
        if (!borde) continue;
        const i = (y * ancho + x) * 4;
        rs.push(datos[i]);
        gs.push(datos[i + 1]);
        bs.push(datos[i + 2]);
      }
    }
    const mediana = (a) => {
      a.sort((p, q) => p - q);
      return a[a.length >> 1] ?? 255;
    };
    return [mediana(rs), mediana(gs), mediana(bs)];
  }
  function otsu(hist, total) {
    let suma = 0;
    for (let i = 0; i < 256; i++) suma += i * hist[i];
    let sumaB = 0;
    let pesoB = 0;
    let mejor = 0;
    let umbral = 0;
    for (let t = 0; t < 256; t++) {
      pesoB += hist[t];
      if (!pesoB) continue;
      const pesoF = total - pesoB;
      if (!pesoF) break;
      sumaB += t * hist[t];
      const mediaB = sumaB / pesoB;
      const mediaF = (suma - sumaB) / pesoF;
      const entre = pesoB * pesoF * (mediaB - mediaF) ** 2;
      if (entre > mejor) {
        mejor = entre;
        umbral = t;
      }
    }
    return umbral;
  }

  // apps/web/lib/bordado/rejilla.ts
  var MM_POR_PX_OBJETIVO = 0.05;
  var PIXELES_MAXIMOS = 6e6;
  var MARGEN_PX = 2;
  function lienzoEnMm(anchoMm, altoMm) {
    const escala = Math.min(
      1,
      Math.sqrt(
        PIXELES_MAXIMOS / (anchoMm / MM_POR_PX_OBJETIVO * (altoMm / MM_POR_PX_OBJETIVO))
      )
    );
    const mmPorPx = MM_POR_PX_OBJETIVO / escala;
    const ancho = Math.max(4, Math.ceil(anchoMm / mmPorPx) + MARGEN_PX * 2);
    const alto = Math.max(4, Math.ceil(altoMm / mmPorPx) + MARGEN_PX * 2);
    const lienzo = new OffscreenCanvas(ancho, alto);
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No pudimos preparar el lienzo de bordado");
    ctx.setTransform(1 / mmPorPx, 0, 0, 1 / mmPorPx, MARGEN_PX, MARGEN_PX);
    return {
      ctx,
      ancho,
      alto,
      mmPorPx,
      desplazamientoMm: MARGEN_PX * mmPorPx
    };
  }
  function aRejilla(lienzo, umbralAlfa = 128) {
    const imagen = lienzo.ctx.getImageData(0, 0, lienzo.ancho, lienzo.alto);
    const datos = new Uint8Array(lienzo.ancho * lienzo.alto);
    for (let i = 0; i < datos.length; i++) {
      datos[i] = imagen.data[i * 4 + 3] >= umbralAlfa ? 1 : 0;
    }
    return {
      datos,
      ancho: lienzo.ancho,
      alto: lienzo.alto,
      mmPorPx: lienzo.mmPorPx
    };
  }
  function comoLa(rejilla, datos) {
    return {
      datos,
      ancho: rejilla.ancho,
      alto: rejilla.alto,
      mmPorPx: rejilla.mmPorPx
    };
  }

  // apps/web/lib/bordado/raster.ts
  var BITS = 5;
  function llaveDe(r, g, b) {
    const s = 8 - BITS;
    return r >> s << BITS * 2 | g >> s << BITS | b >> s;
  }
  function deLlave(llave) {
    const s = 8 - BITS;
    const mascara = (1 << BITS) - 1;
    const medio = 1 << s - 1;
    return [
      ((llave >> BITS * 2 & mascara) << s) + medio,
      ((llave >> BITS & mascara) << s) + medio,
      ((llave & mascara) << s) + medio
    ];
  }
  function deltaE(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  function reducirPaleta(histograma, k) {
    const cubos = [...histograma.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([llave, cuenta]) => {
      const rgb = deLlave(llave);
      return { llave, cuenta, rgb, lab: aLab(rgb[0], rgb[1], rgb[2]) };
    });
    if (!cubos.length)
      return { centros: [], asignacion: /* @__PURE__ */ new Map(), deltaMedio: 0 };
    const semillas = [cubos[0]];
    const candidatos = cubos.slice(0, 256);
    while (semillas.length < Math.min(k, cubos.length)) {
      let mejor = candidatos[0];
      let mejorD = -1;
      for (const c of candidatos) {
        let cerca = Infinity;
        for (const s of semillas) cerca = Math.min(cerca, deltaE(c.lab, s.lab));
        const puntuacion = cerca * Math.log1p(c.cuenta);
        if (puntuacion > mejorD) {
          mejorD = puntuacion;
          mejor = c;
        }
      }
      if (semillas.includes(mejor)) break;
      semillas.push(mejor);
    }
    let centros = semillas.map((s) => ({
      lab: [...s.lab],
      rgb: s.rgb
    }));
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const sumas = centros.map(() => [0, 0, 0, 0, 0, 0, 0]);
      for (const cubo of cubos) {
        let mejor = 0;
        let mejorD = Infinity;
        for (let i = 0; i < centros.length; i++) {
          const d = deltaE(cubo.lab, centros[i].lab);
          if (d < mejorD) {
            mejorD = d;
            mejor = i;
          }
        }
        const s = sumas[mejor];
        s[0] += cubo.lab[0] * cubo.cuenta;
        s[1] += cubo.lab[1] * cubo.cuenta;
        s[2] += cubo.lab[2] * cubo.cuenta;
        s[3] += cubo.rgb[0] * cubo.cuenta;
        s[4] += cubo.rgb[1] * cubo.cuenta;
        s[5] += cubo.rgb[2] * cubo.cuenta;
        s[6] += cubo.cuenta;
      }
      let movio = 0;
      centros = centros.map((centro, i) => {
        const s = sumas[i];
        if (!s[6]) return centro;
        const lab = [
          s[0] / s[6],
          s[1] / s[6],
          s[2] / s[6]
        ];
        movio = Math.max(movio, deltaE(lab, centro.lab));
        return {
          lab,
          rgb: [
            Math.round(s[3] / s[6]),
            Math.round(s[4] / s[6]),
            Math.round(s[5] / s[6])
          ]
        };
      });
      if (movio < 0.3) break;
    }
    const asignacion = /* @__PURE__ */ new Map();
    let sumaDelta = 0;
    let total = 0;
    for (const cubo of cubos) {
      let mejor = 0;
      let mejorD = Infinity;
      for (let i = 0; i < centros.length; i++) {
        const d = deltaE(cubo.lab, centros[i].lab);
        if (d < mejorD) {
          mejorD = d;
          mejor = i;
        }
      }
      asignacion.set(cubo.llave, mejor);
      sumaDelta += mejorD * cubo.cuenta;
      total += cubo.cuenta;
    }
    return {
      centros,
      asignacion,
      deltaMedio: total ? sumaDelta / total : 0
    };
  }
  function hexDe([r, g, b]) {
    return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
  }
  var DOMINANTES = 8;
  function analizarOriginal(datos, primerPlano, ancho, alto, tintas) {
    const n2 = ancho * alto;
    const lab = new Float32Array(n2 * 3);
    for (let p = 0; p < n2; p++) {
      if (!primerPlano[p]) continue;
      const i = p * 4;
      const l = aLab(datos[i], datos[i + 1], datos[i + 2]);
      lab[p * 3] = l[0];
      lab[p * 3 + 1] = l[1];
      lab[p * 3 + 2] = l[2];
    }
    const distanciaA = (p, q) => Math.hypot(
      lab[p * 3] - lab[q * 3],
      lab[p * 3 + 1] - lab[q * 3 + 1],
      lab[p * 3 + 2] - lab[q * 3 + 2]
    );
    const todos = /* @__PURE__ */ new Map();
    const interior = /* @__PURE__ */ new Map();
    let diseno = 0;
    let dentro = 0;
    let suaves = 0;
    for (let p = 0; p < n2; p++) {
      if (!primerPlano[p]) continue;
      diseno++;
      const i = p * 4;
      const llave = llaveDe(datos[i], datos[i + 1], datos[i + 2]);
      todos.set(llave, (todos.get(llave) ?? 0) + 1);
      const x = p % ancho;
      const y = p / ancho | 0;
      let mayor = 0;
      let vecinos = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
        const q = ny * ancho + nx;
        if (!primerPlano[q]) continue;
        vecinos++;
        mayor = Math.max(mayor, distanciaA(p, q));
      }
      if (vecinos < 4 || mayor >= 2) continue;
      dentro++;
      interior.set(llave, (interior.get(llave) ?? 0) + 1);
      if (mayor >= 0.3) suaves++;
    }
    const reparto = (mapa, total, cuantos) => {
      if (!total) return { concentracion: 0, entropia: 0 };
      const cuentas = [...mapa.values()].sort((a, b) => b - a);
      return {
        concentracion: cuentas.slice(0, cuantos).reduce((s, v) => s + v, 0) / total,
        entropia: cuentas.reduce((h, c) => {
          const q = c / total;
          return h - q * Math.log2(q);
        }, 0)
      };
    };
    const global = reparto(todos, diseno, DOMINANTES);
    const dentroReparto = reparto(interior, dentro, tintas);
    return {
      coloresDistintos: todos.size,
      concentracionDominante: Number(global.concentracion.toFixed(4)),
      entropia: Number(global.entropia.toFixed(3)),
      fraccionInterior: Number((dentro / Math.max(1, diseno)).toFixed(4)),
      concentracionInterior: Number(dentroReparto.concentracion.toFixed(4)),
      entropiaInterior: Number(dentroReparto.entropia.toFixed(3)),
      suavidadInterior: Number((suaves / Math.max(1, dentro)).toFixed(4))
    };
  }
  function prepararPixeles(input) {
    const reloj = input.cronometro ?? crearCronometro();
    const coste = costeVacio();
    const lienzo = {
      ancho: input.ancho,
      alto: input.alto,
      mmPorPx: input.mmPorPx,
      desplazamientoMm: input.desplazamientoMm
    };
    const datos = input.datos;
    const n2 = lienzo.ancho * lienzo.alto;
    const inicioSegmentacion = typeof performance !== "undefined" ? performance.now() : Date.now();
    let minX = lienzo.ancho;
    let minY = lienzo.alto;
    let maxX = -1;
    let maxY = -1;
    for (let p = 0; p < n2; p++) {
      if (datos[p * 4 + 3] === 0) continue;
      const x = p % lienzo.ancho;
      const y = p / lienzo.ancho | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) {
      return vacio(lienzo.mmPorPx, {
        code: "IMAGEN_FUERA_DEL_AREA",
        message: "La imagen qued\xF3 fuera del \xE1rea de bordado.",
        severity: "reject"
      });
    }
    const dentroDelRecorte = (p) => {
      const x = p % lienzo.ancho;
      const y = p / lienzo.ancho | 0;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    };
    let semi = 0;
    let conImagen = 0;
    for (let p = 0; p < n2; p++) {
      if (!dentroDelRecorte(p)) continue;
      conImagen++;
      const a = datos[p * 4 + 3];
      if (a < 250) semi++;
    }
    const conAlfa = semi > conImagen * 0.02;
    const primerPlano = new Uint8Array(n2);
    if (conAlfa) {
      for (let p = 0; p < n2; p++) {
        primerPlano[p] = datos[p * 4 + 3] >= 128 ? 1 : 0;
      }
    } else {
      const recorte = recortar(datos, lienzo.ancho, minX, minY, maxX, maxY);
      const [fr, fg, fb] = fondoDe(recorte, maxX - minX + 1, maxY - minY + 1);
      const fondo = aLab(fr, fg, fb);
      const distancia = new Float32Array(n2);
      let maxima = 0;
      for (let p = 0; p < n2; p++) {
        if (!dentroDelRecorte(p) || datos[p * 4 + 3] < 128) continue;
        const i = p * 4;
        const d = deltaE(aLab(datos[i], datos[i + 1], datos[i + 2]), fondo);
        distancia[p] = d;
        if (d > maxima) maxima = d;
      }
      if (!(maxima > 0)) {
        return vacio(lienzo.mmPorPx, {
          code: "IMAGEN_DE_UN_SOLO_COLOR",
          message: "Esta imagen es de un solo color; no hay nada que bordar.",
          severity: "reject"
        });
      }
      const hist = new Uint32Array(256);
      for (let p = 0; p < n2; p++) {
        if (!dentroDelRecorte(p)) continue;
        hist[Math.min(255, distancia[p] / maxima * 255 | 0)]++;
      }
      const corte = Math.max(1, otsu(hist, conImagen)) * (maxima / 255);
      for (let p = 0; p < n2; p++) {
        primerPlano[p] = distancia[p] >= corte ? 1 : 0;
      }
    }
    reloj.sumar(
      "segmentacion",
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - inicioSegmentacion
    );
    const histograma = /* @__PURE__ */ new Map();
    let pixelesDiseno = 0;
    let pixelesPrimerPlano = 0;
    for (let p = 0; p < n2; p++) pixelesPrimerPlano += primerPlano[p];
    try {
      exigir(
        "pixelesPrimerPlano",
        pixelesPrimerPlano,
        input.profile.presupuesto.maxPixelesPrimerPlano
      );
    } catch (error) {
      if (!esPresupuestoExcedido(error)) throw error;
      return excedido(lienzo.mmPorPx, error.recurso, reloj, coste);
    }
    for (let p = 0; p < n2; p++) {
      if (!primerPlano[p]) continue;
      pixelesDiseno++;
      const i = p * 4;
      const llave = llaveDe(datos[i], datos[i + 1], datos[i + 2]);
      histograma.set(llave, (histograma.get(llave) ?? 0) + 1);
    }
    if (!pixelesDiseno) {
      return vacio(lienzo.mmPorPx, {
        code: "IMAGEN_SIN_DISENO",
        message: "No encontramos ninguna forma que bordar en esta imagen.",
        severity: "reject"
      });
    }
    const r = input.profile.raster;
    const base = {
      sourceColorCount: histograma.size,
      hadAlpha: conAlfa,
      mmPorPx: Number(lienzo.mmPorPx.toFixed(4))
    };
    const original = reloj.medir(
      "analisisOriginal",
      () => analizarOriginal(
        datos,
        primerPlano,
        lienzo.ancho,
        lienzo.alto,
        r.maxColoresReducidos
      )
    );
    const entropia = original.entropia;
    if (original.suavidadInterior > r.maxSuavidadInterior) {
      return {
        objetos: [],
        incidencias: [],
        colores: /* @__PURE__ */ new Map(),
        conteo: { satin: 0, running: 0, fill: 0 },
        analisis: {
          ...base,
          reducedColorCount: 0,
          quantizationDeltaE: 0,
          classification: "photo",
          removedRegions: 0,
          removedAreaMm2: 0
        },
        rechazo: {
          code: "PHOTO",
          message: "Esta imagen tiene tonos que van cambiando poco a poco, y el bordado s\xF3lo puede hacer colores planos. Prueba con un logo o una ilustraci\xF3n de pocas tintas.",
          severity: "reject"
        },
        tiempos: reloj.etapas,
        coste,
        metricas: {
          gradientRatio: 0,
          texture: 0,
          colorEntropy: Number(entropia.toFixed(3)),
          alphaCoverage: Number(
            (pixelesDiseno / Math.max(1, conImagen)).toFixed(4)
          )
        },
        diagnostico: {
          ...original,
          componentesAntes: 0,
          componentesDespues: 0,
          regionesGrandes: 0,
          motas: 0,
          fraccionMotas: 0,
          areaEnMotas: 0
        }
      };
    }
    const paleta = reloj.medir("cuantizacion", () => {
      let elegida = reducirPaleta(histograma, 2);
      for (let k = 3; k <= Math.min(r.maxColoresReducidos, input.profile.limits.maxColors); k++) {
        if (elegida.deltaMedio <= r.deltaObjetivoDeltaE) break;
        const siguiente = reducirPaleta(histograma, k);
        if (siguiente.centros.length <= elegida.centros.length) break;
        elegida = siguiente;
      }
      return elegida;
    });
    const { centros, asignacion, deltaMedio } = paleta;
    const porPixel = new Int16Array(n2).fill(-1);
    for (let p = 0; p < n2; p++) {
      if (!primerPlano[p]) continue;
      const i = p * 4;
      porPixel[p] = asignacion.get(llaveDe(datos[i], datos[i + 1], datos[i + 2])) ?? 0;
    }
    let gradiente = 0;
    for (const [llave, cuenta] of histograma) {
      const centro = centros[asignacion.get(llave) ?? 0];
      const rgb = deLlave(llave);
      if (deltaE(aLab(rgb[0], rgb[1], rgb[2]), centro.lab) > 10)
        gradiente += cuenta;
    }
    const gradientRatio = gradiente / pixelesDiseno;
    let bordes = 0;
    for (let p = 0; p < n2; p++) {
      if (porPixel[p] < 0) continue;
      const x = p % lienzo.ancho;
      if (x + 1 < lienzo.ancho && porPixel[p + 1] >= 0 && porPixel[p + 1] !== porPixel[p])
        bordes++;
    }
    const metricas = {
      gradientRatio: Number(gradientRatio.toFixed(4)),
      texture: Number((bordes / pixelesDiseno).toFixed(4)),
      colorEntropy: Number(entropia.toFixed(3)),
      alphaCoverage: Number((pixelesDiseno / Math.max(1, conImagen)).toFixed(4))
    };
    const mascaras = [];
    let regionesGrandes = 0;
    let motas = 0;
    let pixelesEnMotas = 0;
    let componentesAntes = 0;
    let componentesDespues = 0;
    for (let c = 0; c < centros.length; c++) {
      const mascara = new Uint8Array(n2);
      let cuantos = 0;
      for (let p = 0; p < n2; p++) {
        if (porPixel[p] === c) {
          mascara[p] = 1;
          cuantos++;
        }
      }
      const cruda = comoLa(rejillaVacia(lienzo), mascara);
      componentesAntes += reloj.medir(
        "analisisComponentes",
        () => componentes(cruda).length
      );
      const limpia = reloj.medir("limpieza", () => limpiar(cruda));
      mascaras.push(limpia.datos);
      if (!cuantos) continue;
      const partes = reloj.medir(
        "analisisComponentes",
        () => componentes(limpia)
      );
      componentesDespues += partes.length;
      for (const parte of partes) {
        const area = parte.pixeles.length * lienzo.mmPorPx * lienzo.mmPorPx;
        if (area >= input.profile.geometria.minAreaMm2) regionesGrandes++;
        else {
          motas++;
          pixelesEnMotas += parte.pixeles.length;
        }
      }
    }
    const fraccionMotas = motas / Math.max(1, regionesGrandes + motas);
    const areaEnMotas = pixelesEnMotas / pixelesDiseno;
    const diagnostico = {
      ...original,
      componentesAntes,
      componentesDespues,
      regionesGrandes,
      motas,
      fraccionMotas: Number(fraccionMotas.toFixed(4)),
      areaEnMotas: Number(areaEnMotas.toFixed(4))
    };
    try {
      exigir(
        "componentes",
        componentesDespues,
        input.profile.presupuesto.maxComponentes
      );
    } catch (error) {
      if (!esPresupuestoExcedido(error)) throw error;
      return excedido(lienzo.mmPorPx, error.recurso, reloj, coste, diagnostico);
    }
    if (deltaMedio > r.maxPerdidaCuantizacionDeltaE) {
      return {
        objetos: [],
        incidencias: [],
        colores: /* @__PURE__ */ new Map(),
        conteo: { satin: 0, running: 0, fill: 0 },
        analisis: {
          ...base,
          reducedColorCount: centros.length,
          quantizationDeltaE: Number(deltaMedio.toFixed(2)),
          classification: "photo",
          removedRegions: motas,
          removedAreaMm2: 0
        },
        rechazo: {
          code: "COLOR_IRREPRESENTABLE",
          message: `No pudimos reducir esta imagen a ${centros.length} hilos sin cambiarle los colores de forma visible.`,
          severity: "reject"
        },
        tiempos: reloj.etapas,
        coste,
        metricas,
        diagnostico
      };
    }
    const clasificacion = regionesGrandes > r.maxComponentesLogo ? "illustration" : "logo";
    const incidencias = [];
    if (clasificacion === "illustration") {
      incidencias.push({
        code: "ILLUSTRATION_REVIEW",
        message: `Este dise\xF1o tiene ${regionesGrandes} piezas; alguien del taller lo revisar\xE1 antes de bordarlo.`,
        severity: "review"
      });
    }
    const objetos = [];
    const colores = /* @__PURE__ */ new Map();
    const conteo = { satin: 0, running: 0, fill: 0 };
    let eliminadas = 0;
    let eliminadasMm2 = 0;
    try {
      for (let c = 0; c < centros.length; c++) {
        const mascara = mascaras[c];
        if (!mascara.some((v) => v === 1)) continue;
        const hex = hexDe(centros[c].rgb);
        const colorId = colorIdDe(hex);
        colores.set(colorId, hex);
        const resultado = objetosDeMascara({
          cronometro: reloj,
          coste,
          rejilla: comoLa(rejillaVacia(lienzo), mascara),
          profile: input.profile,
          colorId,
          sourceObjectId: input.sourceObjectId,
          sourceType: "raster",
          classification: clasificacion,
          prefijo: `${input.prefijo}-t${c}`,
          desplazamientoMm: lienzo.desplazamientoMm
        });
        objetos.push(...resultado.objetos);
        incidencias.push(...resultado.incidencias);
        conteo.satin += resultado.conteo.satin;
        conteo.running += resultado.conteo.running;
        conteo.fill += resultado.conteo.fill;
        eliminadas += resultado.eliminadas;
        eliminadasMm2 += resultado.eliminadasMm2;
      }
    } catch (error) {
      if (!esPresupuestoExcedido(error)) throw error;
      return excedido(lienzo.mmPorPx, error.recurso, reloj, coste, diagnostico);
    }
    if (eliminadas > 0) {
      incidencias.push({
        code: "DETALLE_PERDIDO",
        message: `Quitamos ${eliminadas} detalle(s) demasiado peque\xF1o(s) para bordarse a este tama\xF1o.`,
        severity: "review"
      });
    }
    if (deltaMedio > r.deltaObjetivoDeltaE) {
      incidencias.push({
        code: "PALETA_FORZADA",
        message: "Tuvimos que simplificar bastante los colores; el bordado no se parecer\xE1 del todo al original.",
        severity: "review"
      });
    }
    return {
      objetos,
      incidencias: incidencias.filter(
        (issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i
      ),
      colores,
      conteo,
      analisis: {
        ...base,
        reducedColorCount: colores.size,
        quantizationDeltaE: Number(deltaMedio.toFixed(2)),
        classification: clasificacion,
        removedRegions: eliminadas,
        removedAreaMm2: Number(eliminadasMm2.toFixed(3))
      },
      tiempos: reloj.etapas,
      coste,
      metricas,
      diagnostico
    };
  }
  function excedido(mmPorPx, recurso, reloj, coste, diagnostico) {
    const vacia = vacio(mmPorPx, incidenciaDeComplejidad());
    return {
      ...vacia,
      rechazo: void 0,
      incidencias: [incidenciaDeComplejidad()],
      presupuestoAgotado: recurso,
      tiempos: reloj.etapas,
      coste,
      diagnostico: diagnostico ?? vacia.diagnostico
    };
  }
  function rejillaVacia(lienzo) {
    return {
      datos: new Uint8Array(0),
      ancho: lienzo.ancho,
      alto: lienzo.alto,
      mmPorPx: lienzo.mmPorPx
    };
  }
  function recortar(datos, ancho, minX, minY, maxX, maxY) {
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const salida = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const desde = ((minY + y) * ancho + minX) * 4;
      salida.set(datos.subarray(desde, desde + w * 4), y * w * 4);
    }
    return salida;
  }
  function vacio(mmPorPx, rechazo) {
    return {
      objetos: [],
      incidencias: [],
      colores: /* @__PURE__ */ new Map(),
      conteo: { satin: 0, running: 0, fill: 0 },
      analisis: {
        sourceColorCount: 0,
        reducedColorCount: 0,
        quantizationDeltaE: 0,
        classification: "logo",
        removedRegions: 0,
        removedAreaMm2: 0,
        hadAlpha: false,
        mmPorPx: Number(mmPorPx.toFixed(4))
      },
      rechazo,
      metricas: {
        gradientRatio: 0,
        texture: 0,
        colorEntropy: 0,
        alphaCoverage: 0
      },
      tiempos: {},
      coste: costeVacio(),
      diagnostico: {
        coloresDistintos: 0,
        concentracionDominante: 0,
        entropia: 0,
        fraccionInterior: 0,
        concentracionInterior: 0,
        entropiaInterior: 0,
        suavidadInterior: 0,
        componentesAntes: 0,
        componentesDespues: 0,
        regionesGrandes: 0,
        motas: 0,
        fraccionMotas: 0,
        areaEnMotas: 0
      }
    };
  }

  // apps/web/lib/bordado/preparar.ts
  var BordadoRechazado = class extends Error {
    constructor(incidencias) {
      super(incidencias[0]?.message ?? "Este dise\xF1o no se puede bordar");
      this.name = "BordadoRechazado";
      this.incidencias = incidencias;
    }
  };
  function dedupe(lista) {
    return lista.filter(
      (issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i
    );
  }
  function prepararConProfile(solicitud, profile) {
    const reloj = crearCronometro();
    const colores = /* @__PURE__ */ new Map();
    const objetos = [];
    const incidencias = [];
    const rechazos = [];
    const conteoTexto = { satin: 0, running: 0, fill: 0 };
    let analisisRaster;
    let metricasRaster;
    for (let i = 0; i < solicitud.fuentes.length; i++) {
      const fuente = solicitud.fuentes[i];
      const prefijo = `o${i}`;
      if (fuente.tipo === "raster") {
        const preparado = prepararPixeles({
          datos: fuente.datos,
          ancho: fuente.ancho,
          alto: fuente.alto,
          mmPorPx: fuente.mmPorPx,
          desplazamientoMm: fuente.desplazamientoMm,
          profile,
          sourceObjectId: fuente.sourceObjectId,
          prefijo,
          cronometro: reloj
        });
        if (preparado.rechazo) {
          rechazos.push(preparado.rechazo);
          continue;
        }
        if (preparado.presupuestoAgotado) {
          throw new BordadoRechazado([incidenciaDeComplejidad()]);
        }
        for (const [id, hex] of preparado.colores) colores.set(id, hex);
        objetos.push(...preparado.objetos);
        incidencias.push(...preparado.incidencias);
        analisisRaster = preparado.analisis;
        metricasRaster = preparado.metricas;
        continue;
      }
      try {
        if (fuente.tipo === "texto") {
          const lienzo = lienzoEnMm(solicitud.widthMm, solicitud.heightMm);
          lienzo.ctx.fillStyle = "#000000";
          lienzo.ctx.fill(new Path2D(fuente.d), "nonzero");
          const hex = normalizarHex(fuente.colorHex);
          colores.set(colorIdDe(hex), hex);
          const preparado = objetosDeMascara({
            rejilla: aRejilla(lienzo),
            profile,
            colorId: colorIdDe(hex),
            sourceObjectId: fuente.sourceObjectId,
            sourceType: "text",
            classification: "text",
            prefijo,
            desplazamientoMm: lienzo.desplazamientoMm,
            esTexto: true,
            cronometro: reloj
          });
          objetos.push(...preparado.objetos);
          for (const incidencia of preparado.incidencias) {
            (incidencia.severity === "reject" ? rechazos : incidencias).push(
              incidencia
            );
          }
          conteoTexto.satin += preparado.conteo.satin;
          conteoTexto.running += preparado.conteo.running;
          conteoTexto.fill += preparado.conteo.fill;
          continue;
        }
        let indice = 0;
        for (const grupo of fuente.porColor) {
          const lienzo = lienzoEnMm(solicitud.widthMm, solicitud.heightMm);
          lienzo.ctx.fillStyle = "#000000";
          for (const camino of grupo.caminos)
            lienzo.ctx.fill(new Path2D(camino), "nonzero");
          const hex = normalizarHex(grupo.hex);
          colores.set(colorIdDe(hex), hex);
          objetos.push(
            ...objetosDeMascara({
              rejilla: aRejilla(lienzo),
              profile,
              colorId: colorIdDe(hex),
              sourceObjectId: fuente.sourceObjectId,
              sourceType: "vector",
              classification: "logo",
              prefijo: `${prefijo}-v${indice++}`,
              desplazamientoMm: lienzo.desplazamientoMm,
              cronometro: reloj
            }).objetos
          );
        }
      } catch (error) {
        if (!esPresupuestoExcedido(error)) throw error;
        throw new BordadoRechazado([incidenciaDeComplejidad()]);
      }
    }
    if (rechazos.length) throw new BordadoRechazado(dedupe(rechazos));
    if (!objetos.length)
      throw new Error("No encontramos trazos fabricables en este dise\xF1o");
    if (objetos.length > profile.limits.maxObjects)
      throw new BordadoRechazado([
        {
          code: "TOO_COMPLEX",
          message: "Este dise\xF1o tiene demasiadas piezas para bordarse autom\xE1ticamente. Simplif\xEDcalo e int\xE9ntalo de nuevo.",
          severity: "reject"
        }
      ]);
    if (colores.size > profile.limits.maxColors)
      throw new BordadoRechazado([
        {
          code: "DEMASIADOS_HILOS",
          message: `El bordado admite hasta ${profile.limits.maxColors} hilos y este dise\xF1o necesita ${colores.size}.`,
          severity: "reject"
        }
      ]);
    const caja = objetos.reduce(
      (todo, objeto) => ({
        xMm: Math.min(todo.xMm, objeto.bounds.xMm),
        yMm: Math.min(todo.yMm, objeto.bounds.yMm),
        maxX: Math.max(todo.maxX, objeto.bounds.xMm + objeto.bounds.widthMm),
        maxY: Math.max(todo.maxY, objeto.bounds.yMm + objeto.bounds.heightMm)
      }),
      { xMm: Infinity, yMm: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    const preparation = {
      profileVersion: profile.version,
      raster: analisisRaster,
      texto: conteoTexto.satin + conteoTexto.running + conteoTexto.fill ? {
        satinColumns: conteoTexto.satin,
        runningPaths: conteoTexto.running,
        fillAreas: conteoTexto.fill
      } : void 0,
      issues: dedupe(incidencias)
    };
    const design = {
      schemaVersion: EMBROIDERY_SCHEMA_VERSION,
      sourceSnapshotHash: solicitud.sourceSnapshotHash,
      productId: solicitud.productId,
      sideId: solicitud.sideId,
      physical: { widthMm: solicitud.widthMm, heightMm: solicitud.heightMm },
      bounds: {
        xMm: Math.max(0, caja.xMm),
        yMm: Math.max(0, caja.yMm),
        widthMm: Math.min(solicitud.widthMm, caja.maxX - Math.max(0, caja.xMm)),
        heightMm: Math.min(solicitud.heightMm, caja.maxY - Math.max(0, caja.yMm))
      },
      colors: [...colores.entries()].map(([id, valor], orden) => ({
        id,
        sourceHex: valor,
        displayHex: valor,
        order: orden
      })),
      objects: objetos,
      metrics: {
        componentCount: objetos.length,
        nodeCount: objetos.reduce((suma, objeto) => suma + objeto.nodeCount, 0),
        colorCount: colores.size,
        widthMm: solicitud.widthMm,
        heightMm: solicitud.heightMm,
        ...metricasRaster ?? {}
      },
      preparation,
      profileVersion: profile.version,
      engineVersion: INKSTITCH_ENGINE_VERSION
    };
    return { design, tiempos: reloj.etapas };
  }
  function preparar(solicitud) {
    return prepararConProfile(solicitud, EMBROIDERY_PROFILE_HYBRID_V4);
  }

  // apps/web/lib/bordado/bordado.worker.ts
  var worker = self;
  var minimaRevision = 0;
  worker.onmessage = (evento) => {
    const mensaje = evento.data;
    if (mensaje.tipo === "olvidar") {
      minimaRevision = Math.max(minimaRevision, mensaje.revision);
      return;
    }
    const { solicitud } = mensaje;
    if (solicitud.revision < minimaRevision) return;
    minimaRevision = solicitud.revision;
    const responder = (respuesta) => {
      worker.postMessage(respuesta);
    };
    try {
      const { design, tiempos } = preparar(solicitud);
      responder({
        revision: solicitud.revision,
        estado: "listo",
        design,
        // `preparation` va suelto además de dentro del diseño para que la UI no
        // tenga que abrir el diseño entero sólo para saber qué avisar.
        preparation: design.preparation ?? {
          profileVersion: design.profileVersion,
          issues: []
        },
        metrics: design.metrics,
        tiempos
      });
    } catch (error) {
      if (error instanceof BordadoRechazado) {
        responder({
          revision: solicitud.revision,
          estado: "rechazado",
          incidencias: error.incidencias,
          tiempos: {}
        });
        return;
      }
      responder({
        revision: solicitud.revision,
        estado: "error",
        mensaje: error instanceof Error ? error.message : "No pudimos preparar el bordado"
      });
    }
  };
})();
