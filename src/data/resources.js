// Per-subject YouTube resources.
//
// Every video count and duration on this page was verified with yt-dlp on 21 Jul 2026,
// not estimated. Where an earlier version of this file made a claim that turned out to be
// wrong, the correction is stated plainly rather than quietly edited out — you made study
// decisions on those claims, so you should know which ones were false.

export const RESOURCES = [
  {
    code: 'CE301', name: 'Distributed Computing', color: 'var(--dsa)',
    verdict: 'hard',
    summary: 'Still your hardest subject to self-study, but the recommendation has changed completely after checking the actual playlists. The channel this app used to send you to has under two hours of material on the subject.',
    picks: [
      { t: 'Education 4u — Distributed Systems', u: 'https://www.youtube.com/playlist?list=PLrjkTql3jnm9FEOXHA_qjR-TMODlaIk-W', tag: 'BEST · 77 videos · 7h 27m', verified: true, note: 'Lec-01 to Lec-77, a genuine end-to-end course: architecture, client-server and peer-to-peer, RPC (Lec 18-22), RMI (Lec 23-25), Bully (Lec 28-29) and Ring (Lec 30-31) election, Cristian and Berkeley clock sync (Lec 53-54), Lamport logical clocks (Lec 56-57), mutual exclusion (Lec 58), two-phase commit (Lec 59-61), then distributed databases. Four videos in the playlist are unavailable and have been skipped in your schedule.' },
      { t: 'Last Moment Tuitions — Distributed Systems', u: 'https://www.youtube.com/playlist?list=PL0s3O6GgLL5eEC3Ej6odS3TugjgdsYOr9', tag: 'REVISION · 17 videos · 1h 55m', verified: true, note: 'Hindi, covers Lamport clocks, Bully and Ring, RPC, RMI, DNS, load balancing. Too thin to learn from, useful for a fast revision pass.' },
      { t: '5 Minutes Engineering — Distributed Systems', u: 'https://www.youtube.com/playlist?list=PLYwpaL_SFmcBYjBnbZdSS9xQ7KrGTxdlY', tag: 'ONLY 12 VIDEOS · 1h 44m', verified: true, note: 'CORRECTION: this app previously called this channel the best available and claimed roughly 80% syllabus coverage. That was wrong. The playlist is 12 videos and 1 hour 44 minutes in total, which cannot carry a four-credit subject. It is a supplement, not a course.' },
      { t: 'MIT 6.824 Distributed Systems', u: 'https://www.youtube.com/results?search_query=MIT+6.824+distributed+systems', tag: 'DEPTH ONLY', note: 'World-class but not syllabus-matched — Raft and Spanner research material, no Lamport numericals. For placements, not the Mumbai University paper.' },
    ],
    gaps: 'CORRECTION: this app previously listed a "Sudhakar Atchala — Distributed Systems" playlist as your backup. No such playlist exists. His channel has 28 playlists and none of them cover distributed systems; the only related video is one tangential clip inside his Operating Systems course. MPI, GFS/HDFS internals and distributed deadlock detection remain thin everywhere — use Tanenbaum for those.',
  },
  {
    code: 'CE302', name: 'Software Engineering', color: 'var(--contest)',
    summary: 'Well served. One structured course covers the subject, and your schedule uses the per-topic videos rather than the marathon version.',
    picks: [
      { t: 'Knowledge Gate (Sanchit Sir) — Software Engineering', u: 'https://www.youtube.com/playlist?list=PLmXKhU9FNesTrw7n8ouPsSLEcduRlENHr', tag: 'BEST · 34 usable videos · 5h 19m', verified: true, note: 'Process models, SRS, coupling and cohesion, design, cost estimation, testing. The playlist is listed as 38 videos, but one is a 5h 58m "complete in one shot" video that simply repeats the other lectures, two are coaching adverts and one is unavailable. Your schedule uses the 34 real per-topic lectures.' },
      { t: '5 Minutes Engineering — Software Engineering and Project Management', u: 'https://www.youtube.com/playlist?list=PLYwpaL_SFmcCB7zUM0YSDR-1mM4KoiyLM', tag: 'FOR UML/DFD · 40 videos · 8h 56m', verified: true, note: 'Mumbai University flavoured. Use specifically for DFD and UML diagram drawing, which Knowledge Gate underserves.' },
      { t: 'Christopher Okhravi — Design Patterns', u: 'https://www.youtube.com/@ChristopherOkhravi', tag: 'PATTERNS', note: 'Best free design-patterns explainer anywhere. If you want to actually understand Strategy, Observer and Factory rather than memorise them.' },
    ],
    gaps: 'GRASP is poorly served on YouTube — read Larman\'s "Applying UML and Patterns" chapter instead.',
  },
  {
    code: 'CE303', name: 'AI & Soft Computing', color: 'var(--ai)',
    verdict: 'good',
    summary: 'The strongest recommendation on this list, and it survived verification intact. Soft computing is a numerical paper and almost no channel actually solves the problems. Huddar does.',
    picks: [
      { t: 'Mahesh Huddar — Soft Computing Tutorial', u: 'https://www.youtube.com/playlist?list=PL4gu8xQu0_5JK6KmQi-Qx5hI3W13RJbDY', tag: 'BEST · 62 videos · 8h 11m', verified: true, note: 'Fully worked numericals: McCulloch-Pitts (AND, ANDNOT, XOR), Hebb net, perceptron learning rule, Adaline and Madaline, backpropagation weight updates, associative memory, Maxnet, Hamming net, Kohonen SOM with three solved examples, LVQ, counter-propagation, genetic algorithms, fuzzy sets and relations, lambda-cuts and defuzzification.' },
      { t: 'Mahesh Huddar — Artificial Intelligence', u: 'https://www.youtube.com/playlist?list=PL4gu8xQu0_5JrWjrWNMmXNx4zFwRrpqCR', tag: 'AI HALF · 103 videos · 13h 12m', verified: true, note: 'Intelligent agents, agent types, problem solving and search. Large playlist — dip into the modules your lectures are on rather than working through it linearly.' },
      { t: '5 Minutes Engineering — Soft Computing and Optimization Algorithms', u: 'https://www.youtube.com/playlist?list=PLYwpaL_SFmcCPUl8mAnb4g1oExKd0n4Gw', tag: 'THEORY · 49 videos · 6h 07m', verified: true, note: 'For definitions and theory where Huddar is numerical-heavy.' },
      { t: 'Karpathy — micrograd (backprop from scratch)', u: 'https://www.youtube.com/watch?v=VMj-3S1tku0', tag: 'GO DEEPER', note: 'Module 2 backprop taught better than any textbook. Also your AI/ML track — one video, two purposes.' },
    ],
    gaps: 'ANFIS is badly covered everywhere free. Budget a paper or blog read instead of hunting for a video.',
  },
  {
    code: 'CE304', name: 'Theory of Computation', color: 'var(--admin)',
    verdict: 'solved',
    summary: 'The one subject that needs no supplement. Neso covers essentially the whole syllabus. Solved — do not overthink it.',
    picks: [
      { t: 'Neso Academy — Theory of Computation & Automata Theory', u: 'https://www.youtube.com/playlist?list=PLBlnK6fEyqRgp46KUv4ZY69yXmpwKOIev', tag: 'BEST · 114 videos · 19h 49m', verified: true, note: 'DFA and NFA, epsilon-NFA conversion, minimisation and Myhill-Nerode, Mealy and Moore, regular expressions, pumping lemma for regular and context-free languages, CFG and ambiguity, CNF and GNF, pushdown automata, Turing machines, decidability and the halting problem. Previously described here as "~130 videos" — the real count is 114.' },
      { t: 'Gate Smashers — Theory of Computation', u: 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiFM9Lj5G9G_76adtyb4ef7i', tag: 'REVISION · 69 videos · 10h 46m', verified: true, note: 'Fast and exam-trick oriented. Use the week before the exam, not for first-pass learning.' },
    ],
  },
  {
    code: 'CE305', name: 'Cryptography & Network Security', color: 'var(--lld)',
    verdict: 'hard',
    summary: 'This subject needs three channels, not one. The single most important correction on this page is here — the source this app recommended does not cover half the syllabus.',
    picks: [
      { t: 'Neso Academy — Cryptography & Network Security', u: 'https://www.youtube.com/playlist?list=PLBlnK6fEyqRgJU3EsOYDTW7m6SUmW6kII', tag: 'FIRST HALF ONLY · 83 videos · 14h 45m', verified: true, note: 'Genuinely excellent on classical ciphers, modular arithmetic and number theory, Feistel structure, DES, AES, triple DES, block cipher modes and PRNG. This is modules 1 to 6 of your schedule and it is the best treatment available.' },
      { t: 'Sundeep Saradhi Kanthety — Cryptography & Network Security', u: 'https://www.youtube.com/playlist?list=PLLOxZwkBK52Ch0y2lLtfepy4Lt_SVkwo3', tag: 'SECOND HALF · 30 videos · 24h 45m', verified: true, note: 'Covers everything Neso does not: RSA step-by-step, Diffie-Hellman, public key distribution, message authentication, MD5, SHA-512, HMAC, DSA digital signatures, Kerberos, X.509, PGP, IPSec (AH and ESP), SSL record and handshake protocols, and SET. Your modules 7 to 10 come from here.' },
      { t: '5 Minutes Engineering — Cyber Security', u: 'https://www.youtube.com/playlist?list=PLYwpaL_SFmcArHtWmbs_vXX6soTK3WEJw', tag: 'FIREWALLS & IDS · 71 videos · 11h 02m', verified: true, note: 'The only verified source for firewall types, packet filtering, proxy gateways, signature versus anomaly IDS, and NIDS versus HIDS. That is module 11.' },
    ],
    gaps: 'CORRECTION: this app previously claimed the Neso playlist walks you through "RSA and Diffie-Hellman numericals" at roughly 75% coverage. It does not. Its last four videos (80-83) are one-to-two-minute chapter-introduction stubs — about five minutes in total for public key cryptography, hashing, system security and web security combined. If you had trusted that claim you would have walked into the exam having never seen RSA worked through. ECC remains poorly explained everywhere; use Forouzan if it is weighted in your paper.',
  },
  {
    code: 'M132', name: 'Intermediate UI/UX', color: 'var(--content)',
    summary: 'No Indian academic channel answer here, and you do not want one. The international free content is excellent. Note that this subject is 200 marks of studio work — watching videos is the smallest part of passing it.',
    picks: [
      { t: 'NNgroup — The 10 Usability Heuristics', u: 'https://www.youtube.com/playlist?list=PLJOFJ3Ok_idtb2YeifXlG1-TYoMBLoG6I', tag: 'MODULE 5 · 12 videos · 34m', verified: true, note: 'The source for Nielsen\'s heuristics, because Jakob Nielsen wrote them. Short and research-grounded. This is the only part of M132 in your daily schedule — the rest of the subject is studio work, not lectures.' },
      { t: 'Figma (official)', u: 'https://www.youtube.com/@Figma', tag: 'BEST', note: 'Config talks and official tutorials. Authoritative on design systems, variables and tokens, auto-layout, advanced prototyping and dev handoff.' },
      { t: 'Mizko', u: 'https://www.youtube.com/@Mizko', tag: 'POLISH', note: 'Modern intermediate Figma workflow, design systems, micro-interactions. Best for the "make it actually look good" gap.' },
      { t: 'AJ&Smart', u: 'https://www.youtube.com/@AJSmart', tag: 'PROCESS', note: 'Design sprints, workshops, UX process — team collaboration.' },
    ],
  },
];

export const CHANNEL_VERDICTS = [
  { n: 'Neso Academy', v: 'Highest-quality option this semester, with one sharp caveat. Theory of Computation is best in class and complete at 114 videos. Cryptography is excellent but stops dead after symmetric crypto — it does not cover RSA, Diffie-Hellman, hashing or network security at all.', good: true },
  { n: 'Mahesh Huddar', v: 'The strongest single find of this whole exercise. Worked soft computing numericals that nobody else does, and the claim held up under checking.', good: true },
  { n: 'Sundeep Saradhi Kanthety', v: 'New, and the reason CE305 is survivable. Thirty long-form lectures covering the entire second half of cryptography with step-by-step worked examples.', good: true },
  { n: 'Education 4u', v: 'REVERSED. This app previously wrote this channel off as "basic, nothing unique". Its 77-lecture Distributed Systems course is in fact the best CE301 resource found anywhere, and it is now your primary source for that subject.', good: true },
  { n: 'Knowledge Gate', v: 'Best free Software Engineering course available. Long single-course format, genuinely complete. Ignore the marathon one-shot video and the coaching adverts in the playlist.', good: true },
  { n: 'Gate Smashers', v: 'Excellent for last-week revision on Theory of Computation at 69 videos. Its Network Security playlist is only 8 videos and 1h 05m, so do not plan CE305 around it.', good: true },
  { n: '5 Minutes Engineering', v: 'DOWNGRADED for Distributed Computing — its playlist there is 12 videos and 1h 44m, not the near-complete course this app used to claim. Still genuinely useful for Software Engineering UML/DFD, Soft Computing theory, and it is the only verified source for firewalls and IDS.', good: true },
  { n: 'Sudhakar Atchala', v: 'REMOVED. This app listed a Distributed Systems playlist of his as your backup for CE301. It does not exist — his channel has 28 playlists and none cover the subject. Nothing else here depended on him.', good: false },
  { n: 'Last Moment Tuitions', v: 'Built for the Mumbai University syllabus and its Distributed Systems playlist is real at 17 videos, but a large share of the channel is a paid funnel. Fine for revision, not for learning.', good: false },
  { n: 'Abdul Bari', v: 'Honestly: not useful for any of your six subjects this semester. Superb, but his catalog does not overlap Sem 5. Keep him for placement DSA prep.', good: false },
  { n: 'Ekeeda', v: 'Weakest recommendation. Mumbai University mapped but production is lecture-recording quality, teaching varies wildly, and much is paywalled. Fallback only.', good: false },
];
