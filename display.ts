import { ArgReader } from "./command";
import { getProperty } from "./util";

export function idToWord(s: string) {
    return s?.replace(/(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])/g, ' ').replace(/\b[a-z]/g, m => m.toUpperCase()).replace(/(?<=[a-z])(?=[A-Z])/g, ' ');
}

export namespace htmlgen {
    export function list(json: Record<string, any>) {
        let keys = Object.keys(json);
        let listHtml = keys.map(k => `\t<dt>${idToWord(k)}</dt><dd>${json[k]}</dd>`).join('\n');
        return `<dl>\n${listHtml}\n</dl>`;
    }
    export function table<T = any>(json: Record<string, any>[]) {
        let rows: string[][] = [];
        if (ArgReader.argreader.debug) console.debug(json);
        let keys = json
            .reduce<string[]>((a, b) => a.concat(Object.keys(b)), [])
            .filter((v, i, a) => a.indexOf(v) === i);
        for (let item of json) {
            let row: string[] = [];
            for (let key of keys) row.push(item[key]);
            rows.push(row);
        }

        let headerHtml = keys.map(k => `\t\t<th class="k-${k}">${idToWord(k)}</th>`).join('\n');
        let rowHtml = rows.map(r => `\t<tr>\n${r.map((c, i) => `\t\t<td class="v-${keys[i]}">${c}</td>`).join('\n')}</tr>`).join('\n');
        return `<table id="frc-schedule"><thead>\n\t<tr>\n${headerHtml}\n\t</tr>\n</thead><tbody>\n${rowHtml}\n</tbody></table>`;
    }
}

export function display(value: any, indent = 0, skipFirstIndent = false, xf: (k: string, v: any) => string = (k, v) => v): string {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return new Date(value).toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    //if (value instanceof Document) return value.documentElement.outerHTML;
    //if (value instanceof Element) return value.outerHTML;
    //if (value instanceof Node) return value.textContent;
    if (value instanceof URL/* || value instanceof Location*/) return value.href;
    if (typeof value === "object") return display.list(value, null, indent, skipFirstIndent);
    return value.toString();

}
export namespace display {
    export function list(json: Record<string, any>, properties: string | string[] = null, indent = 0, skipFirstIndent = false, xf: (k: string, v: any) => string = (k, v) => v) {
        if (ArgReader.argreader.debug) console.debug(json);
        if (typeof properties === "string") return display(getProperty(json, properties.split('.')));
        if (Array.isArray(json)) {
            if (json.length === 0) return "none";
            return json
                .filter((_, i) => !properties || properties.includes(i.toString()))
                .map((v, i) => {
                    let prefix = `${skipFirstIndent && !i ? '' : "  ".repeat(indent)}* `;
                    return prefix + display(v, indent + 1, true);
                }).join('\n');
        }
        let keys = Object.keys(json);
        if (keys.length === 0) return "none";
        return keys
            .filter(k => !properties || properties.includes(k))
            .map((k, i) => {
                let v = json[k];
                if (v && typeof v === "object") v = '\n' + list(v, null, indent + 1);
                return `${skipFirstIndent && !i ? '' : "  ".repeat(indent)}- ${idToWord(k)}: ${v}`;
            }).join('\n');
    }
    export function table(json: Record<string, any>[], properties: string | string[] = null, indent = 0) {
        let rows: string[][] = [];
        let keys = json
            .reduce<string[]>((a, b) => a.concat(Object.keys(b)), [])
            .filter((v, i, a) => a.indexOf(v) === i && (!properties || properties.includes(v)));
        for (let item of json) {
            let row: string[] = [];
            for (let key of keys) row.push(item[key]?.toString());
            rows.push(row);
        }

        let headers = keys.map(idToWord);
        // if (ArgReader.DEBUG) console.debug(headers);
        let headerSizes = headers.map(k => Math.max(k.length, ...rows.map(r => r[headers.indexOf(k)]?.length ?? -1)));
        // if (ArgReader.DEBUG) console.debug(headerSizes);
        let headerStr = headers.map((k, i) => k.padEnd(headerSizes[i])).join(" │ ");
        let rowStr = rows.map(r => r.map((c, i) => (c ?? '').padEnd(headerSizes[i])).join(" │ ")).join(" │\n│ ");
        let headerLine = headerSizes.map(s => '─'.repeat(s)).join("─┬─");
        let separatorLine = headerSizes.map(s => '─'.repeat(s)).join("─┼─");
        let footerLine = headerSizes.map(s => '─'.repeat(s)).join("─┴─");
        return `┌─${headerLine}─┐\n│ ${headerStr} │\n├─${separatorLine}─┤\n│ ${rowStr} │\n└─${footerLine}─┘`;
    }
}

function printAndReturn<T>(value: T) {
    console.log(`> [${typeof value}] ${value}`);
    return value;
}