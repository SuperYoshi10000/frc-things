import frc from "./api";
import { display, htmlgen } from "./display";
import { compare, getProperty, sort } from "./util";

export class ArgReader {
    static argreader = new ArgReader(...process.argv);
    #args = process.argv;

    #n = 0;
    readonly p: Readonly<{
        [key: string]: string | number | boolean,
        year: number,
        team: number,
        p?: string, // properties
        sp?: string, // sub property
        sk?: string, // sort key
        xp?: string, // exclude properties
        "--debug": boolean,
        "--server": boolean,
    }>;
    #next: string;

    static readonly END_CHARS = {
        '+': true,
        '!': false,
        '-': false,
        '=': '',
        '/': true,
        '\\': false
    } as const;
    readonly debug: boolean;

    constructor(...args: string[]) {
        const p = {
            year: frc.YEAR,
            team: frc.USER_TEAM,
            "--debug": Boolean(process.env.DEBUG) || process.argv.includes("--debug"),
            "--server": process.argv.includes("--server")
        };
        const debug = this.debug = p["--debug"];
        this.#n = 2;
        let a = this.#next = args[this.#n++];
        if (debug) console.debug(args);
        while (a && (a.includes('=') || a.at(-1) in (ArgReader.END_CHARS??{}) || a.startsWith('-'))) {
            if (a.includes('=')) {
                if (a.startsWith('/')) break; // path was passed as an argument
                let [key, value] = a.split('=', 2);
                p[key] = value;
            } else if (a.at(-1) in (ArgReader.END_CHARS??{})) {
                let key = a.slice(0, -1);
                let value = ArgReader.END_CHARS[a.at(-1)];
                p[key] = value;
            } else if (a.startsWith('-')) {
                p[a] = true;
            }
            if (this.debug) console.debug(this.#n + ":", a);
            a = this.#next = args[this.#n++];
        }
        this.p = Object.freeze(p);
        if (this.debug) console.debug(this.p);
        if (this.debug) console.debug(this.#next);
    }

    all() {
        return this.p;
    }
    at(i, f = s => s) {
        return f(process.argv[i]);
    }
    count() {
        return process.argv.length;
    }
    next(f = s => s) {
        if (this.debug) console.debug(this.#n + ":", this.#next);
        let v = f(this.#next);
        this.#next = this.#args[this.#n++];
        return v;
    }

    peek(): string | number | boolean;
    peek<T>(f: (s: string | number | boolean) => T): T;
    peek<T>(f: (s: string | number | boolean) => T | string | number | boolean = s => s) {
        if (this.debug) console.debug(this.#n + ":", this.#next);
        return f(this.#next);
    }
    has(a: string) {
        return a in this.p;
    }

    get(a: string) {
        return this.p[a];
    }
    getString(a: string) {
        return String(this.get(a));
    }
    getNumber(a: string) {
        return Number(this.get(a));
    }
    getBoolean(a: string) {
        return Boolean(this.get(a));
    }
    getMapped<T>(a: string, f: (s: string | number | boolean) => T) {
        return f(this.get(a));
    }

    getArray(a: string) {
        return String(this.get(a)).split(',');
    }
    getStringArray(a: string) {
        return String(this.get(a)).split(',').map(String);
    }
    getNumberArray(a: string) {
        return String(this.get(a)).split(',').map(Number);
    }
    getBooleanArray(a: string) {
        return String(this.get(a)).split(',').map(Boolean);
    }
    getMappedArray<T>(a: string, f: (s: string | number | boolean) => T) {
        return String(this.get(a)).split(',').map(f);
    }

    getTable(a: string) {
        return String(this.get(a)).split(';').map(r => r.split(','));
    }
    getStringTable(a: string) {
        return String(this.get(a)).split(';').map(r => r.split(',').map(String));
    }
    getNumberTable(a: string) {
        return String(this.get(a)).split(';').map(r => r.split(',').map(Number));
    }
    getBooleanTable(a: string) {
        return String(this.get(a)).split(';').map(r => r.split(',').map(Boolean));
    }
    getMappedTable<T>(a: string, f: (s: string | number | boolean) => T) {
        return String(this.get(a)).split(';').map(r => r.split(',').map(f));
    }

    getMap(a: string) {
        return Object.fromEntries(String(this.get(a)).split(',').map(r => r.split(':'))) as Record<string, any>;
    }
    getStringMap(a: string) {
        return Object.fromEntries(String(this.get(a)).split(',').map(r => r.split(':').map(String))) as Record<string, string>;
    }
    getNumberMap(a: string) {
        return Object.fromEntries(String(this.get(a)).split(',').map(r => r.split(':').map(Number))) as Record<string, number>;
    }
    getBooleanMap(a: string) {
        return Object.fromEntries(String(this.get(a)).split(',').map(r => r.split(':').map(Boolean))) as Record<string, boolean>;
    }
    getMappedMap<T>(a: string, f: (s: string | number | boolean) => T) {
        return Object.fromEntries(String(this.get(a)).split(',').map(r => r.split(':').map(f))) as Record<string, T>;
    }
}

export async function execute(...args: string[]) {
    if (args.length > 2) {
        let argreader: ArgReader = this instanceof ArgReader ? this : new ArgReader(...args);
        let p = argreader.all();
        let a = argreader.next();
        await frc.init();
        if (argreader.debug) console.debug(a);
        if (argreader.debug) console.debug(p);
        if (argreader.getBoolean("--server")) {
            let server = require("./server");
        } else if (/^\d/.test(a)) {
            let [year, data] = a.split(';', 2)[0];
            frc.getData(+year, data).then(console.log, console.error);
        } else if (a?.startsWith('.')) {
            if (argreader.debug) console.log("using . mode");
            switch (a) {
                case ".events":
                    let mode = argreader.next()?.toLowerCase();
                    if ("p" in p) {
                        let events = await frc.events(p.year, mode === "all" ? null : p.team);
                        let props = p.p.split(',');
                        let sortKey = p.sk.split(',');
                        let inverse = sortKey[0].startsWith('-');
                        if (inverse || sortKey[0].startsWith('+')) sortKey[0] = sortKey[0].slice(1);
                        if (argreader.debug) console.debug(sortKey, inverse);
                        sort(events.Events, inverse ? (a, b) => -compare(a, b, sortKey) : [sortKey]);
                        let data = events.Events.map(e => {
                            let obj = {};
                            for (let prop of props) obj[prop] = getProperty(e, prop.split('.'));
                            return obj;
                        });
                        console.log(display.table(data));
                    } else if ("xp" in p) {
                        let events = await frc.events(p.year, mode === "all" ? null : p.team);
                        let exclude = p.xp.split(',');
                        let sortKey = p.sk.split(',');
                        let inverse = sortKey[0].startsWith('-');
                        if (inverse || sortKey[0].startsWith('+')) sortKey[0] = sortKey[0].slice(1);
                        if (argreader.debug) console.debug(sortKey, inverse);
                        let data = events.Events.map(e => {
                            let obj = {};
                            for (let key in e) if (!exclude.includes(key)) obj[key] = e[key];
                            return obj;
                        });
                        console.log(display.table(data));
                    } else {
                        let events = await frc.events(p.year, mode === "all" ? null : p.team);
                        console.log(display.table(events.Events));
                    }
                    break;
                case ".season":
                    let season = await frc.season(p.year);
                    if (argreader.debug) console.debug(season);
                    sort(season.frcChampionships, [c => new Date(c.startDate), c => c.name]);
                    console.log(display.list(season, p.p?.split(',') ?? p.sp));
                    break;
                case ".schedule":
                    let b = argreader.next();
                    let eventCode;
                    let teamOrType;
                    if (/^\d+$/.test(b)) teamOrType = b;
                    else {
                        eventCode = b || frc.prompt.event("Event: ");
                        teamOrType = argreader.next() || frc.prompt.teamOrType("Team/Level: ");
                        if (typeof teamOrType === 'string' && /[\s,;/-]/.test(teamOrType)) teamOrType = teamOrType.split(/[\s,;/-]/, 2);
                    }
                    if ("p" in p) {
                        let schedule = await frc.schedule(p.year, eventCode ?? '', Array.isArray(teamOrType) ? [+teamOrType[0], teamOrType[1]] : /^\d+$/.test(teamOrType) ? +teamOrType : teamOrType);
                        if ("sk" in p) {
                            let sortKey = p.sk.split(',');
                            let inverse = sortKey.some(k => k.startsWith('-'));
                            if (inverse) sortKey[0] = sortKey[0].slice(1);
                            if (argreader.debug) console.debug(sortKey, inverse, '~~~~~~~~');
                            sort(schedule.Schedule, inverse ? (a, b) => -compare(a, b, sortKey) : [sortKey]);
                        }
                        let props = p.p.split(',');
                        let data = schedule.Schedule.map(e => {
                            let obj = {};
                            for (let prop of props) obj[prop] = getProperty(e, prop.split('.'));
                            return obj;
                        });
                        let table = htmlgen.table(data);
                        console.log(table);
                    } else frc.printSchedule(+p.year, eventCode ?? '', Array.isArray(teamOrType) ? [+teamOrType[0], teamOrType[1]] : /^\d+$/.test(teamOrType) ? +teamOrType : teamOrType);
                    break;
                case ".scores_1":
                    let c = argreader.next();
                    let eventCode_1;
                    let teamOrType_1;
                    if (/^\d+$/.test(c)) teamOrType_1 = c;
                    else {
                        eventCode_1 = c || frc.prompt.event("Event: ");
                        teamOrType_1 = argreader.next() || frc.prompt.teamOrType("Level: ");
                    }
                    console.log(await frc.scores(p.year, eventCode_1 ?? '', teamOrType_1));
            }
        } else frc.getData(p.year, a.replace(/^\//, '')).then(console.log, console.error);
    } else {
        let year = +frc.prompt.year("Year: ") || frc.YEAR;
        let team = +frc.prompt.team("Team: ") || frc.USER_TEAM;
        await frc.init();
        let eventCode = frc.prompt.event("Event: ") || "CMPTX";
        frc.printSchedule(year, eventCode, team);
    }
}

export default {
    ArgReader,
    execute
};
