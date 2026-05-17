// Custom Fabric.js object that renders text along a circular arc.
//
// curvature range: -100 to 100
//   -100 → máxima curvatura hacia arriba  (arch up)
//      0 → texto plano
//   +100 → máxima curvatura hacia abajo   (arch down)

import { classRegistry, FabricObject } from "fabric";

// ─── conversión curvature % → radio en px ────────────────────────────────────
// |pct|=100 → radio mínimo (muy curvo), |pct|→0 → radio grande (plano)
const MIN_R = 80;
const MAX_R = 1400;

function curvatureToAbsRadius(pct: number): number {
	const absP = Math.abs(pct) / 100;
	return MIN_R + (MAX_R - MIN_R) * (1 - absP);
}

// ─── temp canvas para medir chars sin contexto real ──────────────────────────
const _mc =
	typeof document !== "undefined" ? document.createElement("canvas") : null;

function measureChars(chars: string[], font: string): number[] {
	if (!_mc) return chars.map(() => 8);
	const ctx = _mc.getContext("2d")!;
	ctx.font = font;
	return chars.map((c) => ctx.measureText(c).width);
}

export interface CurvedTextOptions {
	text?: string;
	/** -100 (arch up) … 0 (flat) … +100 (arch down) */
	curvature?: number;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: string | number;
	fontStyle?: string;
	spacing?: number;
	left?: number;
	top?: number;
	angle?: number;
	opacity?: number;
	fill?: string;
	scaleX?: number;
	scaleY?: number;
	clipPath?: FabricObject;
	transparentCorners?: boolean;
	cornerColor?: string;
	cornerStrokeColor?: string;
	borderColor?: string;
	cornerSize?: number;
	cornerStyle?: string;
}

export class CurvedText extends FabricObject {
	static override type = "CurvedText";

	text: string;
	/** -100 (arch up) … 0 (flat) … +100 (arch down) */
	curvature: number;
	fontSize: number;
	fontFamily: string;
	fontWeight: string | number;
	fontStyle: string;
	spacing: number;

	constructor(options: CurvedTextOptions = {}) {
		super(options as never);
		this.text = options.text ?? "Texto";
		this.curvature = options.curvature ?? -50; // arch up por defecto
		this.fontSize = options.fontSize ?? 32;
		this.fontFamily = options.fontFamily ?? "Inter";
		this.fontWeight = options.fontWeight ?? "normal";
		this.fontStyle = options.fontStyle ?? "normal";
		this.spacing = options.spacing ?? 2;
		this._recalcDims();
	}

	// auto-recalc bounding box cuando cambian propiedades relevantes
	override set(key: Record<string, unknown> | string, value?: unknown): this {
		super.set(key as never, value as never);
		const k = typeof key === "string" ? key : Object.keys(key).join(",");
		if (
			/text|fontSize|fontFamily|fontWeight|fontStyle|curvature|spacing/.test(k)
		) {
			this._recalcDims();
		}
		return this;
	}

	private _font() {
		return `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px "${this.fontFamily}"`;
	}

	_recalcDims() {
		const chars = [...this.text];
		if (!chars.length) {
			this.width = 20;
			this.height = this.fontSize * 1.2;
			return;
		}

		const widths = measureChars(chars, this._font());
		const totalWidth =
			widths.reduce((a, b) => a + b, 0) +
			this.spacing * Math.max(0, chars.length - 1);

		if (this.curvature === 0) {
			this.width = totalWidth;
			this.height = this.fontSize * 1.4;
			return;
		}

		const absR = curvatureToAbsRadius(this.curvature);
		const alpha = totalWidth / absR;
		this.width = Math.max(20, 2 * absR * Math.sin(alpha / 2));
		this.height = absR * (1 - Math.cos(alpha / 2)) + this.fontSize * 1.4;
	}

	override _render(ctx: CanvasRenderingContext2D) {
		const chars = [...this.text];
		if (!chars.length) return;

		ctx.font = this._font();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = (this.fill as string) ?? "#000000";

		const charWidths = chars.map((c) => ctx.measureText(c).width);
		const totalWidth =
			charWidths.reduce((a, b) => a + b, 0) +
			this.spacing * Math.max(0, chars.length - 1);

		// ── texto plano ────────────────────────────────────────────────────────
		if (this.curvature === 0) {
			let x = -totalWidth / 2;
			for (let i = 0; i < chars.length; i++) {
				ctx.fillText(chars[i], x + charWidths[i] / 2, 0);
				x += charWidths[i] + this.spacing;
			}
			return;
		}

		// ── texto curvado ──────────────────────────────────────────────────────
		const absR = curvatureToAbsRadius(this.curvature);
		// curvature < 0  → arch up  → s = +1  (arco hacia arriba)
		// curvature > 0  → arch down → s = -1  (arco hacia abajo)
		const s = this.curvature < 0 ? 1 : -1;

		const alpha = totalWidth / absR; // ángulo total del arco (radianes)

		// Posición del centro del arco relativa al centro del objeto (0,0):
		//   s=+1 → centro del arco abajo (+y)
		//   s=−1 → centro del arco arriba (−y)
		const arcCY = (s * absR * (1 + Math.cos(alpha / 2))) / 2;

		ctx.save();
		ctx.translate(0, arcCY);

		let cumAngle = -alpha / 2;

		for (let i = 0; i < chars.length; i++) {
			const charAngle = cumAngle + charWidths[i] / (2 * absR);

			// arch-down es el reflejo vertical de arch-up: mismo glifo, NO se
			// voltea. s controla el lado del arco y el signo del ángulo.
			ctx.save();
			ctx.rotate(s * charAngle);   // rotar sistema de coordenadas
			ctx.translate(0, -s * absR); // moverse al borde del arco
			ctx.fillText(chars[i], 0, 0);
			ctx.restore();

			cumAngle += charWidths[i] / absR + this.spacing / absR;
		}

		ctx.restore();
	}

	override toObject(propertiesToInclude?: string[]) {
		return {
			...super.toObject(propertiesToInclude),
			text: this.text,
			curvature: this.curvature,
			fontSize: this.fontSize,
			fontFamily: this.fontFamily,
			fontWeight: this.fontWeight,
			fontStyle: this.fontStyle,
			spacing: this.spacing,
		};
	}
}

classRegistry.setClass(CurvedText);
