// Aptitude — the round most people fail before anyone reads their code.
// Indian placement drives almost always open with quant + logical + verbal,
// and it is a pure-elimination round: no partial credit for being a good engineer.
// It also doubles as Optiver 80-in-8 arithmetic training (see Career page).

export const APTITUDE = {
  why: 'Almost every Indian placement drive opens with an aptitude round, and it is pure elimination — you either clear the cutoff or nobody looks at your DSA. It is also the most trainable thing on your whole plan: the question types repeat, so speed comes from pattern recognition, not cleverness. Twenty minutes a day from now means you never revise it in placement season.',
  topics: [
    { n: 'Percentages, profit & loss', tag: 'quant', note: 'Highest-frequency quant topic in Indian drives.' },
    { n: 'Ratio, proportion, mixtures & alligation', tag: 'quant' },
    { n: 'Time, speed & distance; trains, boats', tag: 'quant' },
    { n: 'Time & work, pipes & cisterns', tag: 'quant' },
    { n: 'Averages, ages', tag: 'quant' },
    { n: 'Simple & compound interest', tag: 'quant' },
    { n: 'Permutations, combinations & probability', tag: 'quant', note: 'Overlaps directly with quant-firm interviews.' },
    { n: 'Number system, HCF/LCM, remainders', tag: 'quant', note: 'You already have this from your LeetCode maths problems.' },
    { n: 'Mensuration & geometry basics', tag: 'quant' },
    { n: 'Series & progressions', tag: 'quant' },
    { n: 'Data interpretation — tables, bar, pie, line', tag: 'logical', note: 'Heavily weighted at TCS, Infosys, Wipro, Capgemini.' },
    { n: 'Blood relations, directions', tag: 'logical' },
    { n: 'Seating arrangement & puzzles', tag: 'logical', note: 'The biggest time sink — practise under a timer.' },
    { n: 'Syllogisms, statements & conclusions', tag: 'logical' },
    { n: 'Coding-decoding, series completion', tag: 'logical' },
    { n: 'Clocks & calendars', tag: 'logical' },
    { n: 'Reading comprehension', tag: 'verbal' },
    { n: 'Sentence correction, para jumbles', tag: 'verbal' },
    { n: 'Vocabulary — synonyms, antonyms, idioms', tag: 'verbal' },
    { n: 'Mental arithmetic speed drills', tag: 'quant', note: 'Doubles as Optiver 80-in-8 training: 80 sums in 8 minutes, no calculator. Top 10% gets interviewed regardless of college.' },
  ],
  resources: [
    { t: 'IndiaBIX — topic-wise practice', u: 'https://www.indiabix.com/', note: 'Free, the standard bank of Indian placement aptitude questions. Work topic by topic, not randomly.' },
    { t: 'PrepInsta — company-specific patterns', u: 'https://prepinsta.com/', note: 'Shows the actual paper pattern per company (TCS NQT, Infosys, Wipro, Accenture). Use once you know which drives you are sitting.' },
    { t: 'Careerride / Freshersworld mocks', u: 'https://www.freshersworld.com/placement-papers', note: 'Full-length timed mocks. One a week from October.' },
    { t: 'Zetamac arithmetic trainer', u: 'https://arithmetic.zetamac.com/', note: 'The tool quant candidates actually use for the Optiver-style speed test. Default settings, 2 minutes, every day.' },
    { t: 'R.S. Aggarwal — Quantitative Aptitude', u: 'https://www.indiabix.com/', note: 'The book everyone uses. Worth owning a physical copy for the worked solutions.' },
  ],
  plan: 'Ten minutes of Zetamac plus one IndiaBIX topic set per day, five days a week. That is roughly 20 minutes and it fits in a lecture. From October, add one full-length timed mock every Sunday.',
};
