import { ActiveSelection } from "fabric";

const ORANGE = "#fe6241";

ActiveSelection.prototype.transparentCorners = false;
ActiveSelection.prototype.cornerColor = "#ffffff";
ActiveSelection.prototype.cornerStrokeColor = ORANGE;
ActiveSelection.prototype.borderColor = ORANGE;
ActiveSelection.prototype.cornerSize = 8;
ActiveSelection.prototype.borderScaleFactor = 1.1;

// color del marco de selección grupal
ActiveSelection.prototype.selectionBackgroundColor = "rgba(254, 98, 65, 0.08)";

const oldRenderControls = ActiveSelection.prototype._renderControls;

ActiveSelection.prototype._renderControls = function (ctx, options) {
	ctx.strokeStyle = ORANGE;
	ctx.lineWidth = 2;
	oldRenderControls.call(this, ctx, options);
};
