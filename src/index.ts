/*
Copyright 2019 Open Foodservice System Consortium

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { createLine, parseLine, parseOption, type ParseState } from './parse.ts';
import type { Printer } from './types.ts';

// Export target classes
export { BaseTarget } from './targets/base.ts';
export { SvgTarget } from './targets/svg.ts';
export { HtmlTarget } from './targets/html.ts';
export { AuditTarget } from './targets/audit.ts';

/**
 * Transform ReceiptLine document to printer commands or SVG/HTML output.
 * This is an async function to support targets that need async operations (e.g., PNG generation).
 * @param {string} doc ReceiptLine document
 * @param {object} [printer] printer configuration
 * @returns {Promise<{content: string, width: number, height: number}>} result with output string, width, and height
 */
export async function transform(doc: string, printer: Printer): Promise<{content: string, width: number, height: number}> {
	// validate printer configuration
	const ptr = parseOption(printer);

	// Lock the target (wait with timeout if already locked)
	await ptr.target.lock();

	try {
		// initialize state variables
		const state = {
			wrap: true,
			border: 1,
			width: [],
			align: 1,
			option: { type: 'code128', width: 2, height: 72, hri: false, cell: 3, level: 'l', quietZone: false },
			line: 'waiting',
			rules: { left: 0, width: 0, right: 0, widths: [] }
		} as ParseState;
		// append commands to start printing
		let result = await ptr.target.open(ptr);
		// strip bom
		if (doc[0] === '\ufeff') {
			doc = doc.slice(1);
		}
		// parse each line and generate commands (sequential to maintain state order)
		const lines = doc.normalize().split(/\n|\r\n|\r/);
		const res: string[] = [];
		for (const line of lines) {
			res.push(await createLine(parseLine(line, state), ptr, state));
		}
		// if rules is not finished
		switch (state.line) {
			case 'ready':
				// set state to cancel rules
				state.line = 'waiting';
				break;
			case 'running':
			case 'horizontal':
				// append commands to stop rules
				res.push(
					await ptr.target.normal() +
					await ptr.target.area(state.rules.left, state.rules.width, state.rules.right) +
					await ptr.target.align(0) +
					await ptr.target.vrstop(state.rules.widths) +
					await ptr.target.vrlf(false)
				);
				state.line = 'waiting';
				break;
			default:
				break;
		}
		// append commands
		result += res.join('');
		// append commands to end printing (await in case target has async close)
		result += await ptr.target.close();
		return {
			content: result,
			width: ptr.target.calculatedWidth(),
			height: Math.round(ptr.target.calculatedHeight())
		};
	} finally {
		// Always unlock the target
		ptr.target.unlock();
	}
}
