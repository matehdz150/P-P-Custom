import { ActiveSelection } from "fabric";

const SELECCION = "#2b2812";

ActiveSelection.prototype.transparentCorners = false;
ActiveSelection.prototype.cornerColor = "#ffffff";
ActiveSelection.prototype.cornerStrokeColor = SELECCION;
ActiveSelection.prototype.borderColor = SELECCION;
ActiveSelection.prototype.cornerSize = 8;
ActiveSelection.prototype.borderScaleFactor = 1.1;

// color del marco de selección grupal
ActiveSelection.prototype.selectionBackgroundColor = "rgba(43, 40, 18, 0.08)";

const oldRenderControls = ActiveSelection.prototype._renderControls;

ActiveSelection.prototype._renderControls = function (ctx, options) {
	ctx.strokeStyle = SELECCION;
	ctx.lineWidth = 2;
	oldRenderControls.call(this, ctx, options);
};
