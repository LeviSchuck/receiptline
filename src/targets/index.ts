import { BaseTarget } from "./base.ts";
import { SvgTarget } from "./svg.ts";
import { HtmlTarget } from "./html.ts";
import { AuditTarget } from "./audit.ts";

export default {
	base: new BaseTarget(),
	svg: new SvgTarget(),
	html: new HtmlTarget(),
	audit: new AuditTarget(),
};
