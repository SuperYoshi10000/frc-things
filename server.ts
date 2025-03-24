import express from "express";
import { ArgReader } from "./command";
import { frc } from "./api";
import { get, OutgoingHttpHeaders } from "http";
import { htmlgen, idToWord } from "./display";

import fs from "fs";
import { filterProperties, formatDateRange, include } from "./util";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

if (ArgReader.argreader.get("--server")) {
    const HTML_BEGIN = `<!DOCTYPE html>\n<html>\n\t<head>\n\t\t<title>`;
    const HTML_MID1 = `</title>\n\t<style>\n`;
    const HTML_DEFAULT_STYLES = include("assets/styles/default.css");
    const HTML_MID2 = `\n</style>\n\t</head>\n\t<body>\n`;
    const HTML_END = `\n\t</body>\n</html>`;

    const SCHEDULE_CSS = `<style>\n${include("assets/styles/schedule.css")}\n</style>`;

    console.log("Starting server...");
    const app = express();
    const port = ArgReader.argreader.get("--port") || 3000;

    app.use((req, res, next) => {
        console.log(`${req.ip} > ${req.method} ${req.url} HTTP/${req.httpVersion}`);
        next();
    });

    app.all("/static/*", async (req, res) => {
        let path = req.url.replace("/static", "");
        console.log(`${req.ip} * Serving static file: ${path}`);
        try {
            let file = fs.readFileSync(`public/static${path}`);
            respond(req, res, 200, file);
        } catch (e) {
            console.error(`Error serving static file: ${path}`);
            respond(req, res, 404, `404 Not Found: ${path}`);
        }
    });

    app.get("/favicon.ico", async (req, res) => {
        console.log(`${req.ip} * Serving favicon...`);
        try {
            let file = fs.readFileSync("public/favicon.ico");
            respond(req, res, 200, file);
        } catch (e) {
            console.error("Error serving favicon.");
            respond(req, res, 404, "404 Not Found: favicon.ico");
        }
    });


    function scheduleMatch({description, field, matchNumber, startTime, tournamentLevel, teams}: frc.MatchScheduleData) {
        return {
            description,
            level: tournamentLevel,
            matchNumber,
            startTime,
            field,
            red1: frc.teamDisplay(teams.find(t => t.station === "Red1")),
            red2: frc.teamDisplay(teams.find(t => t.station === "Red2")),
            red3: frc.teamDisplay(teams.find(t => t.station === "Red3")),
            blue1: frc.teamDisplay(teams.find(t => t.station === "Blue1")),
            blue2: frc.teamDisplay(teams.find(t => t.station === "Blue2")),
            blue3: frc.teamDisplay(teams.find(t => t.station === "Blue3")),
        };
    }
    function resultMatch({
        actualStartTime,
        description,
        matchNumber,
        postResultTime,
        tournamentLevel,
        scoreRedFinal,
        scoreRedAuto,
        scoreRedFoul,
        scoreBlueFinal,
        scoreBlueAuto,
        scoreBlueFoul,
        teams,
    }: frc.MatchResultData) {
        return {
            description,
            level: tournamentLevel,
            matchNumber,
            startTime: actualStartTime,
            resultsPosted: postResultTime,
            red1: frc.teamDisplay(teams.find(t => t.station === "Red1")),
            red2: frc.teamDisplay(teams.find(t => t.station === "Red2")),
            red3: frc.teamDisplay(teams.find(t => t.station === "Red3")),
            blue1: frc.teamDisplay(teams.find(t => t.station === "Blue1")),
            blue2: frc.teamDisplay(teams.find(t => t.station === "Blue2")),
            blue3: frc.teamDisplay(teams.find(t => t.station === "Blue3")),
            redScore: scoreRedFinal,
            redAutoScore: scoreRedAuto,
            redFoulScore: scoreRedFoul,
            blueScore: scoreBlueFinal,
            blueAutoScore: scoreBlueAuto,
            blueFoulScore: scoreBlueFoul,
        };
    }
    function scoreMatch(data: frc.MatchScoreData) {
        
    }

    async function getMatches(req: express.Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: any, mode: "schedule" | "scores" | "results") {
        let requestProperties = getRequestProperties(req);
        if (requestProperties.error) {
            respond(req, res, requestProperties.error.code, requestProperties.error.msg);
        }

        let { year, event: eventCode, team, level, sortKey, includeProps, excludeProps } = requestProperties as RequestProperties;
        
        let eventHeaderHtml = `<header><h1>FRC ${year} ${eventCode}</h1></header>`;
        try {
            let eventData = await frc.events(year, eventCode);
            if (!eventData) {
                respondHtml(req, res, 502, `FRC ${year} ${eventCode} Event - No Response`,
                    `Error fetching event ${year} ${eventCode}. FRC API did not respond.<br/>\nTry checking:` + generateErrorSuggestions(year, eventCode));
                return;
            }
            if (!eventData.Events || eventData.Events.length === 0) {
                console.error(eventData);
                respondHtml(req, res, 502, `FRC ${year} ${eventCode} Event - Event Not Found`,
                    `Error fetching event ${year} ${eventCode}. FRC API did not return an event:\n<pre>${eventData}</pre>\nTry checking:` + generateErrorSuggestions(year, eventCode));
                return;
            }
            
            let event: Partial<frc.EventData> = eventData.Events[0];

            event = excludeProps ? filterProperties(event, excludeProps.filter(p => p.startsWith("Event.")).map(p => p.substring(6)), true)
                : includeProps ? filterProperties(event, includeProps.filter(p => p.startsWith("Event.")).map(p => p.substring(6))) : event;

            // Generate Event HTML
            eventHeaderHtml = `<h1>FRC ${year} ${eventCode}</h1>`;
            if (event.type) event.type = idToWord(event.type);

            let h2s: string[] = [];
            if ("name" in event) h2s.push(event.name + (event.type ? ` (${event.type})` : ""));

            let hasDivisionCode = "divisionCode" in event && event.divisionCode !== null;
            let hasDistrictCode = "districtCode" in event && event.districtCode !== null;
            let codeString = 
                (hasDistrictCode ? "code" in event || hasDivisionCode ? `${event.districtCode} - ` : event.districtCode : "") +
                ("code" in event ? hasDivisionCode ? `${event.code} [Division ${event.divisionCode}]` : event.code : hasDivisionCode ? "Division " + event.divisionCode : "");
            if (codeString) h2s.push(codeString);
            if (h2s.length > 0) eventHeaderHtml += `<h2>${h2s.join("<br/>")}</h2>`;

            let h3s: string[] = [];
            // Date
            let start = new Date(event.dateStart);
            let end = new Date(event.dateEnd);
            let dateString = "dateStart" in event && "dateEnd" in event ? formatDateRange(start, end, frc.DATE_FORMAT) : "dateStart" in event ? event.dateStart : null;
            if ("timezone" in event) if (dateString) dateString += ` (${event.timezone})`; // Timezone is irrelevant if no date is given
            if (dateString) h3s.push(dateString);
            // Location
            if ("venue" in event) h3s.push(event.venue);
            let locationString = [event.address, event.city, event.stateprov, event.country].filter(v => v).join(", ");
            if (locationString) h3s.push(locationString);
            if ("website" in event) h3s.push(`Website: <a href="${event.website}">${event.website}</a>`);

            if (h3s.length > 0) eventHeaderHtml += `<h3>${h3s.join("<br/>")}</h3>`;
            eventHeaderHtml = `<header>${eventHeaderHtml}</header>`;
        } catch(e) {
            console.error(e);
        }

        try {
            let matches: (frc.MatchScheduleData | frc.MatchResultData | frc.MatchScoreData)[];
            switch (mode){
                case "schedule":
                    let schedule = await frc.schedule(year, eventCode, level === "All" ? "All" : team && level ? [team, level] : team || level);
                    if (!schedule) {
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Schedule - No Response`,
                            eventHeaderHtml + `<main>Error fetching schedule ${year} ${eventCode}. FRC API did not respond.<br/>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (!schedule.Schedule) {
                        console.error(schedule);
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Schedule - Schedule Not Found`,
                            eventHeaderHtml + `<main>Error fetching schedule ${year} ${eventCode}. FRC API did not return a schedule:\n<pre>${schedule}</pre>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (schedule.Schedule.length === 0) {
                        respondHtml(req, res, 200, `FRC ${year} ${eventCode} Schedule - No Matches`,
                            eventHeaderHtml + `<main>No matches (yet) for event ${year} ${eventCode}. Check back later for updates.<br>\nFor more information on this event, visit:${generateErrorSuggestions(year, eventCode)}</main>`);
                    }
                    matches = schedule.Schedule;
                    break;
                case "scores":
                    let scores = await frc.scores(year, eventCode, level === "All" ? "All" : level);
                    if (!scores) {
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Scores - No Response`,
                            eventHeaderHtml + `<main>Error fetching scores ${year} ${eventCode}. FRC API did not respond.<br/>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (!scores.MatchScores) {
                        console.error(matches);
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Scores - Scores Not Found`,
                            eventHeaderHtml + `<main>Error fetching scores ${year} ${eventCode}. FRC API did not return scores:\n<pre>${matches}</pre>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (scores.MatchScores.length === 0) {
                        respondHtml(req, res, 200, `FRC ${year} ${eventCode} Scores - No Matches`,
                            eventHeaderHtml + `<main>No matches (yet) for event ${year} ${eventCode}. Check back later for updates.<br>\nFor more information on this event, visit:${generateErrorSuggestions(year, eventCode)}</main>`);
                    }
                    matches = scores.MatchScores;
                    break;
                case "results":
                    let results = await frc.results(year, eventCode, level === "All" ? "All" : team && level ? [team, level] : team || level);
                    if (!results) {
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Results - No Response`,
                            eventHeaderHtml + `<main>Error fetching results ${year} ${eventCode}. FRC API did not respond.<br/>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (!results.Matches) {
                        console.error(matches);
                        respondHtml(req, res, 502, `FRC ${year} ${eventCode} Results - Results Not Found`,
                            eventHeaderHtml + `<main>Error fetching results ${year} ${eventCode}. FRC API did not return results:\n<pre>${matches}</pre>\nTry checking:${generateErrorSuggestions(year, eventCode)}</main>`);
                        return;
                    }
                    if (results.Matches.length === 0) {
                        respondHtml(req, res, 200, `FRC ${year} ${eventCode} Results - No Matches`,
                            eventHeaderHtml + `<main>No matches (yet) for event ${year} ${eventCode}. Check back later for updates.<br>\nFor more information on this event, visit:${generateErrorSuggestions(year, eventCode)}</main>`);
                    }
                    matches = results.Matches;
                    break;
            }
            


            let result = htmlgen.table(matches.map(scheduleMatch));

            result = `<!DOCTYPE html>\n<html>\n\t<head>\n\t\t<title>FRC ${year} ${eventCode} Schedule</title>\n\t\t${SCHEDULE_CSS}\n\t</head>\n\t<body>\n\t\t${eventHeaderHtml}\n\t\t${result}\n\t</body>\n</html>`;
            respond(req, res, 200, result, "text/html");
        } catch (e) {
            console.error(e);
            respondHtml(req, res, 502, `FRC ${year} ${eventCode} Schedule - Request Failed`,
                eventHeaderHtml + `Error fetching schedule ${year} ${eventCode}. FRC API request failed:\n<pre>${e}</pre>\nTry checking:` + generateErrorSuggestions(year, eventCode), "text/html");
        }
    }

    // Event
    app.get("/frc/:year/schedule/:event", async (req, res) => getMatches(req, res, "schedule"));
    app.get("/frc/:year/scores/:event", async (req, res) => getMatches(req, res, "scores"));
    app.get("/frc/:year/results/:event", async (req, res) => getMatches(req, res, "results"));

    type RequestProperties = {
        error: null;
        year: number;
        event: string;
        team: number;
        level: "All" | frc.TournamentLevel;
        sortKey: string[];
        includeProps: string[];
        excludeProps: string[];
    }    

    function getRequestProperties(req: express.Request): RequestProperties | { error: { code: number, msg: string } } {
        let year = +req.params.year;
        let event = req.params.event;
        let team = +req.query.team?.toString();
        let level = req.query.level?.toString().toLowerCase() as "All" | frc.TournamentLevel;

        let sortKey = req.query.sortkey?.toString().split(',');
        let include = req.query.include?.toString().split(',');
        let exclude = req.query.exclude?.toString().split(',');

        if (include && exclude) return { error: { code: 400, msg: "Cannot include and exclude properties at the same time." } };

        return { year, event, team, level, sortKey, includeProps: include, excludeProps: exclude, error: null };
    }
    function respond<T extends express.Response>(req: express.Request, res: T, code = 200, data?: any, headers?: OutgoingHttpHeaders | string) {
        try {
            console.log(`${req.ip} * Sending response... (${code})`);
            if (typeof headers === "string") headers = { "Content-Type": headers };
            if (headers) res.set(headers || { "Content-Type": "text/plain" });
            res.status(code).send(data);
            console.log(`${req.ip} < HTTP/1.1 ${res.statusCode} ${res.statusMessage}`);
        } catch (e) {
            console.error(e);
        }
    }

    function respondHtml<T extends express.Response>(req: express.Request, res: T, code = 200, title: string, data?: any, headers?: OutgoingHttpHeaders | string) {
        try {
            console.log(`${req.ip} * Sending response... (${code})`);
            if (typeof headers === "string") headers = { "Content-Type": headers };
            if (headers) res.set(headers || { "Content-Type": "text/html" });
            res.status(code).send(generateHtml(title, data));
            console.log(`${req.ip} < HTTP/1.1 ${res.statusCode} ${res.statusMessage}`);
        } catch (e) {
            console.error(e);
        }
    }

    function generateHtml(title: string, body: string, styles?: string) {
        return HTML_BEGIN + title + HTML_MID1 + (styles ?? HTML_DEFAULT_STYLES) + HTML_MID2 + body + HTML_END;
    }
    function generateErrorSuggestions(year: number, event: string) {
        return `<ul><li><a href="https://frc-events.firstinspires.org/${year}">FRC ${year} Year Page</a></li><li><a href="https://frc-events.firstinspires.org/${year}/${event}">FRC ${year} ${event} Event Page</a></li><li><a href="https://thebluealliance.com">The Blue Alliance Home Page</a></li><li><a href="https://www.thebluealliance.com/event/${year}${event.toLowerCase()}">The Blue Alliance ${year} ${event} Event Page</a></li></ul>`;
    }

    app.listen(port);
    console.log(`Server started on port ${port}.`);

    module.exports = {
        app
    };
}