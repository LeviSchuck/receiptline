import { BaseTarget } from "./base.ts";
import { SvgTarget } from "./svg.ts";
import { HtmlTarget } from "./html.ts";

export default {
	base: new BaseTarget(),
	svg: new SvgTarget(),
	html: new HtmlTarget(),
};
