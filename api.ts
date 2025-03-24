import { Console } from "console";
import "dotenv/config";
import { get } from "http";
import ps from "prompt-sync";
import { formatDateRange } from "./util";
import { ArgReader } from "./command";

export namespace frc {
    export const TODAY = new Date();
    export const YEAR = TODAY.getFullYear();
    export const DATE_FORMAT = {weekday: "long", month: "long", day: "numeric", year: "numeric"} as const satisfies Intl.DateTimeFormatOptions;
    export const DATETIME_FORMAT = {weekday: "short", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"} as const satisfies Intl.DateTimeFormatOptions;

    export const USER_TEAM = +process.env.USER_TEAM;
    export const USER_DISTRICT = process.env.USER_DISTRICT;

    type EI<T extends string> = T | (`${T}` & T[keyof T]);
    
    export enum TournamentLevel {
        None = "None",
        Practice = "Practice",
        Qualification = "Qualification",
        Playoff = "Playoff",
    }
    export enum TournamentType {
        None = "None",
        Regional = "Regional",
        DistrictEvent = "DistrictEvent",
        DistrictChampionship = "DistrictChampionship",
        DistrictChampionshipWithLevels = "DistrictChampionshipWithLevels",
        DistrictChampionshipDivision = "DistrictChampionshipDivision",
        ChampionshipSubdivision = "ChampionshipSubdivision",
        ChampionshipDivision = "ChampionshipDivision",
        Championship = "Championship",
        Offseason = "Offseason",
        OffseasonWithAzureSync = "OffseasonWithAzureSync",
    }
    export const EVENT_CODES = [
        "CMPTX",
        `${USER_DISTRICT}CMP`,
    ]

    type RES<N extends string, T> = { [K in N]: T[]; };

    export interface EventArgs {
        eventCode?: string;
        teamNumber?: number;
        districtCode?: string;
        excludeDistrict?: boolean;
        weekNumber?: number;
        tournamentType?: EI<TournamentType>;
    }
    export interface SeasonData {
        frcChampionship: null | string;
        eventCount: number;
        gameName: string;
        kickoff: string;
        rookieStart: number;
        teamCount: number;
        frcChampionships: LimitedEventData[];
    }
    export interface LimitedEventData {
        name: string;
        startDate: string;
        location: string;
    }
    export interface EventData {
        address: string;
        website: string;
        webcasts: [];
        timezone: string;
        code: string;
        divisionCode: null | string;
        name: string;
        type: string;
        districtCode: string;
        venue: string;
        city: string;
        stateprov: string;
        country: string;
        dateStart: string;
        dateEnd: string;
    }
    export interface ScheduleData {
        Schedule: MatchScheduleData[];
    }
    export interface ScoreData {
        MatchScores: MatchScoreData[];
    }
    export interface ResultData {
        Matches: MatchResultData[];
    }
    export interface MatchScheduleData {
        description: string;
        startTime: string;
        teams: MatchTeamData[];
        matchNumber: number;
        field: string;
        tournamentLevel: TournamentLevel;
    }
    export interface MatchResultData {
        actualStartTime: string,
        tournamentLevel: TournamentLevel,
        postResultTime: string,
        description: string,
        matchNumber: number,
        scoreRedFinal: number,
        scoreRedFoul: number,
        scoreRedAuto: number,
        scoreBlueFinal: number,
        scoreBlueFoul: number,
        scoreBlueAuto: number,
        teams: MatchResultTeamData[];
    }
    export interface MatchScoreData {
        // NOTE: Depends on season
        matchLevel: TournamentLevel;
        matchNumber: number;
        alliances: [MatchAllianceData, MatchAllianceData]; // Red and Blue
        [key: string]: any;
    }
    export interface MatchTeamData {
        teamNumber: number;
        station: string;
        surrogate: boolean;
    }
    export interface MatchResultTeamData {
        teamNumber: number;
        station: string;
        dq: boolean;
    }
    export interface MatchAllianceData {
        // NOTE: Depends on season
        alliance: string; // Red or Blue
        foulCount: number;
        autoPoints: number;
        teleopPoints: number;
        foulPoints: number;
        totalPoints: number;
        [key: string]: any;
    }


    function enumPrompt<T extends string>(enumType: {[key: string]: T}) {
        return ps({ autocomplete(value: string) {
            return Object.values(enumType).filter(v => v.startsWith(value));
        }});
    }

    function arrayPrompt<T extends string>(...array: T[]): ps.Prompt {
        return ps({ autocomplete(value: string) {
            return array.filter(v => v.startsWith(value));
        }});
    }

    let years = Array.from({length: YEAR - 1991}, (_, k) => String(k + 1992)).reverse();

    let promptFunction = ps();
    export function prompt(opts: ps.Option): string;
    export function prompt(ask: string, opts?: ps.Option): string;
    export function prompt(ask: string, value: string, opts?: ps.Option): string;
    export function prompt(...a: [ps.Option] | [string, ps.Option?] | [string, string, ps.Option?]): string {
        return promptFunction(...a as Parameters<ps.Prompt>);
    }
    export namespace prompt {
        export const TournamentType = enumPrompt(frc.TournamentType);
        export const TournamentLevel = enumPrompt(frc.TournamentLevel);
        export const year = arrayPrompt(...years);
        export const team = ps({ autocomplete(value: string) {
            if (parseInt(value)) return [value, USER_TEAM + ''];
            return [USER_TEAM + ''];
        }});
        export const event = ps({ autocomplete(value: string) {
            return data.teamEventCodes.filter(v => v.startsWith(value));
        }});
        export const teamOrType = ps({ autocomplete(value: string) {
            if (parseInt(value)) return [value, USER_TEAM + '', ...Object.values(frc.TournamentLevel)];
            return [USER_TEAM + '', ...Object.values(frc.TournamentLevel)];
        }});
    };
    
    export async function getData<T = object>(year: number, path: string = ""): Promise<T> {
        if (process.env.DEBUG || process.argv.includes("--debug")) console.log(`https://frc-api.firstinspires.org/v3.0/${year}/${path}`);
        const res = await fetch(`https://frc-api.firstinspires.org/v3.0/${year}/${path}`, {
            headers: {
                "Accept": "application/json",
                "Authorization": `Basic ${process.env.FRC_API_TOKEN}`,
            },
        });
        if (ArgReader.argreader.debug) console.debug(await res.text());
        return res.json();
    }

    export async function season(year: number = YEAR): Promise<SeasonData> {
        return getData(year);
    }

    export async function events(year: number, eventCode?: string): Promise<RES<"Events", EventData>>;
    export async function events(year: number, teamNumber?: number): Promise<RES<"Events", EventData>>;
    export async function events(year: number, eventData?: EventArgs): Promise<RES<"Events", EventData>>;
    export async function events(year: number, event?: string | number | EventArgs): Promise<RES<"Events", EventData>> {
        if (!event) return getData(year, "events");
        if (typeof event === "string") return getData(year, `events?eventCode=${event}`);
        if (typeof event === "number") return getData(year, `events?teamNumber=${event}`);
        if (typeof event === "object") {
            const { eventCode = "", teamNumber = "", districtCode = "", excludeDistrict = "", weekNumber = "", tournamentType = "" } = event;
            return getData(year, `events?${eventCode ? `&eventCode=${eventCode}` : ""}${teamNumber ? `&teamNumber=${teamNumber}` : ""}${districtCode ? `&districtCode=${districtCode}` : ""}${excludeDistrict ? `&excludeDistrict=${excludeDistrict}` : ""}${weekNumber ? `&weekNumber=${weekNumber}` : ""}${tournamentType ? `&tournamentType=${tournamentType}` : ""}`);
        }
        return getData(year, "events");
    }

    export async function schedule(year: number, eventCode: string, teamOrType: number | EI<TournamentLevel> | "All" | [number, EI<TournamentLevel>] = "All"): Promise<ScheduleData> {
        if (teamOrType === "All") {
            let schedules = [
                ...(await schedule(year, eventCode, TournamentLevel.Practice)).Schedule,
                ...(await schedule(year, eventCode, TournamentLevel.Qualification)).Schedule,
                ...(await schedule(year, eventCode, TournamentLevel.Playoff)).Schedule
            ];
            return {Schedule: schedules};
        }
        if (typeof teamOrType === "string") return getData<ScheduleData>(year, `schedule/${eventCode}?tournamentLevel=${teamOrType}`);
        else if (typeof teamOrType === "number") return getData<ScheduleData>(year, `schedule/${eventCode}?teamNumber=${teamOrType}`);
        else return getData<ScheduleData>(year, `schedule/${eventCode}?tournamentLevel=${teamOrType[1]}&teamNumber=${teamOrType[0]}`);
    }

    export async function scores(year: number, eventCode: string, teamOrType: EI<TournamentLevel> | "All" = "All"): Promise<ScoreData> {
        if (teamOrType === "All") {
            let scores = [
                ...(await frc.scores(year, eventCode, TournamentLevel.Practice)).MatchScores,
                ...(await frc.scores(year, eventCode, TournamentLevel.Qualification)).MatchScores,
                ...(await frc.scores(year, eventCode, TournamentLevel.Playoff)).MatchScores
            ];
            let s = ArgReader.argreader.getBoolean("--l2s") ? scores.map(m => ({
                ...m,
                Alliances: m.alliances.map(a => `${a.alliance}: ${JSON.stringify(a)}`),
            })) : scores;
            return {MatchScores: s};
        }
        let data = await getData<ScoreData>(year, `scores/${eventCode}?tournamentLevel=${teamOrType}`);
        if (ArgReader.argreader.debug) console.debug(data);
        let d = data.MatchScores;
        let s = ArgReader.argreader.getBoolean("--l2s") ? d.map(m => ({
            ...m,
            Alliances: m.alliances.map(a => `${a.alliance}: ${JSON.stringify(a)}`),
        })) : d;
        return {MatchScores: s};
    }
    export async function results(year: number, eventCode: string, teamOrType: number | EI<TournamentLevel> | "All" | [number, EI<TournamentLevel>] = "All"): Promise<ResultData> {
        if (teamOrType === "All") {
            let matches = [
                ...(await frc.results(year, eventCode, TournamentLevel.Practice)).Matches,
                ...(await frc.results(year, eventCode, TournamentLevel.Qualification)).Matches,
                ...(await frc.results(year, eventCode, TournamentLevel.Playoff)).Matches
            ];
            return {Matches: matches};
        }
        if (typeof teamOrType === "string") return getData<ResultData>(year, `matches/${eventCode}?tournamentLevel=${teamOrType}`);
        else if (typeof teamOrType === "number") return getData<ResultData>(year, `matches/${eventCode}?teamNumber=${teamOrType}`);
        else return getData<ResultData>(year, `matches/${eventCode}?tournamentLevel=${teamOrType[1]}&teamNumber=${teamOrType[0]}`);
    }

    export function orderTeams(teams: {teamNumber: number, station: string, surrogate: boolean}[], l?: number): {red: string[], blue: string[]} {
        let red = teams.filter(team => team.station.startsWith("Red")).sort((a, b) => a.station.localeCompare(b.station)).map(team => (team.surrogate ? '*' + team.teamNumber : '' + team.teamNumber).padStart(l));
        let blue = teams.filter(team => team.station.startsWith("Blue")).sort((a, b) => a.station.localeCompare(b.station)).map(team => (team.surrogate ? '*' + team.teamNumber : '' + team.teamNumber).padStart(l));
        return {red, blue};
    }

    export async function printSchedule(year: number, eventCode: string, teamOrType?: number | EI<TournamentLevel> | "All" | [number, EI<TournamentLevel>]) {
        let event = (await events(year, eventCode)).Events[0];
        let schedule = teamOrType.toString().toLowerCase() === "all" ? [
            // ...(await schedule<{Schedule: any[]}>(year, eventCode, TournamentLevel.None)).Schedule, // Literally just nothing. This has no purpose. Who would ever want this?
            ...(await frc.schedule(year, eventCode, TournamentLevel.Practice)).Schedule,
            ...(await frc.schedule(year, eventCode, TournamentLevel.Qualification)).Schedule,
            ...(await frc.schedule(year, eventCode, TournamentLevel.Playoff)).Schedule
        ] : (await frc.schedule(year, eventCode, teamOrType)).Schedule;
        if (process.env.DEBUG || process.argv.includes("--debug")) {
            console.debug(schedule);
            console.debug(event);
            console.debug(teamOrType);
        }
        console.log(`> FRC Season of ${year} | ${eventCode}`);
        let start = new Date(event.dateStart);
        let end = new Date(event.dateEnd);
        let dateString = formatDateRange(start, end, DATE_FORMAT);
        console.log(`${event.name}\n${event.city}, ${event.stateprov}, ${event.country} | ${dateString}`);
        if (typeof teamOrType === "number") console.log(`Schedule for ${eventCode} team ${teamOrType}`);
        else if (teamOrType.toString().toLowerCase() === "all") console.log(`Schedule for ${eventCode}`);
        else if (typeof teamOrType === "string") console.log(`Schedule for ${eventCode} round ${teamOrType}`);
        else console.log(`Schedule for ${eventCode} round ${teamOrType[1]} team ${teamOrType[0]}`);
        if (schedule.length === 0) {
            console.log(`No matches.`);
            return;
        }
        console.log(`Total matches: ${schedule.length}\n` + '='.repeat(109));
        schedule.map((m) => {
                // This map function is used to fix the year of the match if it is incorrect
                // It will always return the same match, with the date and time fixed if necessary
                // if (Boolean(process.env.DEBUG) || process.argv.includes("--debug")) console.debug(typeof new Date(m.startTime).getFullYear() + ' ' + typeof year);
                if (new Date(m.startTime).getFullYear() !== year) {
                    // Unknown dates default to January 1st, 1970 at 00:00:00 (Unix epoch)
                    // If this is the case, we know the year is wrong and we need to fix it
                    // We can assume the date is the same as the last day of the event, as this is usually the case
                    // The exact time is unknown, so we'll just set it to time the event ends - this will work for sorting
                    m.startTime = end.toISOString();
                }
                return m;
            })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .forEach(match => {
                let startTime = new Date(match.startTime);
                let teams = orderTeams(match.teams, 6);
                let str = `${match.description.padEnd(17)} @ ${startTime.toLocaleString([], DATETIME_FORMAT).padEnd(21)} - Red [ ${teams.red.join(", ")} ] vs Blue [ ${teams.blue.join(", ")} ]`;
                console.log(str);
            });
    }
    export function teamDisplay(team: MatchTeamData | MatchResultTeamData, includeStation: boolean = false) {
        return `${includeStation ? team.station.replace(/\d/, " $1") + ": " : ''}${(team as MatchTeamData).surrogate ? '*' : ''}${(team as MatchResultTeamData).dq ? '!' : ''}${team.teamNumber}`;
    }


    export const data: {
        teamEvents: {Events: EventData[]};
        teamEventCodes: string[];
    } = {} as typeof data;
    const initPromise = (async () => {
        let teamEvents = data.teamEvents = await events(YEAR, USER_TEAM);
        data.teamEventCodes = teamEvents.Events.sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()).map(event => event.code);
        Object.freeze(data);
    })();
    export async function init() {
        
        await initPromise;
    }
}

export default frc;