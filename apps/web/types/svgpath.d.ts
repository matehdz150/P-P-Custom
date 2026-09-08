declare module "svgpath" {
	export type SvgPath = {
		transform(value: string): SvgPath;
		translate(x: number, y?: number): SvgPath;
		scale(x: number, y?: number): SvgPath;
		round(precision: number): SvgPath;
		toString(): string;
	};
	export default function svgpath(path: string): SvgPath;
}
