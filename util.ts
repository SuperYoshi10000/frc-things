import fs from "fs";
import crypto from "crypto";

type KEYOF<O extends object, T extends PropertyKey[]> = T extends [infer K, ...infer R extends PropertyKey[]] ? K extends keyof O ? O[K] extends object ? KEYOF<O[K], R> : never : never : O;
export function getProperty<T extends object, K extends keyof T>(obj: T, prop: K): T[K];
export function getProperty<T extends object, K extends keyof T, L extends keyof T[K]>(obj: T, prop: [K, L]): T[K][L];
export function getProperty<T extends object, K extends keyof T, L extends keyof T[K], M extends keyof T[K][L]>(obj: T, prop: [K, L, M]): T[K][L][M];
export function getProperty<T extends object, K extends PropertyKey[]>(obj: T, properties: K): KEYOF<T, K>;
export function getProperty<T extends object>(obj: T, prop: PropertyKey | PropertyKey[]): any;
export function getProperty<T extends object>(obj: T, prop: PropertyKey | PropertyKey[]) {
    if (!Array.isArray(prop)) prop = [prop];
    return prop.reduce((o, p) => o[p], obj);
}
export function setProperty<T extends object>(obj: T, prop: PropertyKey | PropertyKey[], value: any) {
    if (!Array.isArray(prop)) prop = [prop];
    let last = prop.pop();
    let o = getProperty(obj, prop);
    o[last] = value;
}
export function deleteProperty<T extends object>(obj: T, prop: PropertyKey | PropertyKey[]) {
    if (!Array.isArray(prop)) prop = [prop];
    let last = prop.pop();
    let o = getProperty(obj, prop);
    delete o[last];
}
export function hasProperty<T extends object>(obj: T, prop: PropertyKey | PropertyKey[]) {
    if (!Array.isArray(prop)) prop = [prop];
    let last = prop.pop();
    let o = getProperty(obj, prop);
    return last in o;
}

export function compare<T>(a: T, b: T): number;
export function compare<T>(a: T, b: T, keys: string[]): number;
export function compare<T>(a: T, b: T, keys: ((t: T) => any)[]): number;
export function compare<T>(a: T, b: T, keys: (string | ((t: T) => any))[]): number;
export function compare<T extends object>(a: T, b: T, keys?: (string | ((t: T) => any))[]): number {
    if (keys) for (let key of keys) {
        let av = typeof key === "function" ? key(a) : getProperty(a, key);
        let bv = typeof key === "function" ? key(b) : getProperty(b, key);
        if (av < bv) return -1;
        if (av > bv) return 1;
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// export function sort<T>(a: T[], f?: ((a: T, b: T) => number), copy?: boolean): T[];
// export function sort<T extends object>(a: T[], f: (string[] | ((t: T) => any))[], copy?: boolean): T[];
export function sort<T extends object>(a: T[], f: ((a: T, b: T) => number) | (string[] | ((t: T) => any))[] = compare, copy: boolean = false): T[] {
    if (copy) a = a.slice();
    return a.sort(typeof f === "function" ? f : (a, b) => {
        for (let p of f) {
            let av = typeof p === "function" ? p(a) : getProperty(a, p);
            let bv = typeof p === "function" ? p(b) : getProperty(b, p);
            if (av < bv) return -1;
            if (av > bv) return 1;
        }
        return 0;
    });
}

export function filterProperties<T extends object>(obj: T, properties: string[], exclude: boolean = false): Partial<T> {
    let result: Partial<T> = {};
    for (let key in obj) if (exclude !== properties.includes(key)) result[key] = obj[key];
    return result;
}

export function hash(content: string | ArrayBuffer | ArrayBufferView) {
    }

const cache: { [key: string]: {
    name: string;
    content: string;
    hash: string;
} } = {};
export function include(name: string) {
    if (cache[name]) {
        return cache[name].content;
    }
    let content = fs.readFileSync(`public/static/${name}`).toString();
    let hash = crypto.createHash('sha256').update(content).digest('hex');
    cache[name] = { name, content, hash };
    return content;
}

export function getDateStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
export function getDateStartTime(date: Date) {
    return getDateStart(date).getTime();
}

export function formatDateRange(start: Date, end: Date, options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }) {
    if (getDateStartTime(start) === getDateStartTime(end)) return start.toLocaleDateString([], options);
    return `${start.toLocaleDateString([], options)} - ${end.toLocaleDateString([], options)}`;
}