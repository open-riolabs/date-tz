import { DateTz } from './date-tz';

export * from './date-tz';
export * from './idate-tz';

const nowUtc = new DateTz(Date.now(), 'UTC');
console.log(nowUtc.toString("YYYY-MM-DD HH:mm:ss"));

const parse1 = DateTz.parse("2023-11-15 12:00:00", 'YYYY-MM-DD HH:mm:ss', "Africa/Casablanca");
console.log(parse1.timestamp);
console.log(parse1.toString());