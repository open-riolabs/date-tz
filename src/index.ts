import { DateTz } from './date-tz';

export * from './date-tz';
export * from './idate-tz';

// const nowUtc = new DateTz(Date.now(), 'UTC');
// console.log(nowUtc.toString("YYYY-MM-DD HH:mm:ss"));

const parse1 = DateTz.parse("2025-03-30 02:00:00", 'YYYY-MM-DD HH:mm:ss', "Europe/Rome");
console.log(parse1.timestamp);
console.log(parse1.toString());