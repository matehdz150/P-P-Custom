import type { CurvedTextConfig } from "./curvedTextEngine";

export type CurvedTextTemplate = CurvedTextConfig & {
	id?: string;
	curved?: number;
};
