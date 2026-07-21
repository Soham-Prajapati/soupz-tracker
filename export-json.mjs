import { SCHEDULE } from './src/data/schedule.js';
import { EVENTS } from './src/data/tracks.js';
import fs from 'fs';
fs.writeFileSync('plan.json', JSON.stringify({ schedule: SCHEDULE, events: EVENTS }));
console.log('wrote plan.json', SCHEDULE.length, 'days');
