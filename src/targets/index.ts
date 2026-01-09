import { BaseTarget } from "./base.ts";
import { SvgTarget } from "./svg.ts";

export default {
	base: new BaseTarget(),
	svg: new SvgTarget(),
};
