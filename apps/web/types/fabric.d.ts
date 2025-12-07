import "fabric";

declare module "fabric" {
	interface Canvas {
		editableArea?: fabric.Rect;
	}
}
