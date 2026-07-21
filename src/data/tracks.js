// System Design / LLD, AI/ML, College, and fixed-date events.

export const LLD = {
  name: 'System Design (LLD first)',
  why: 'You are right that placements test this. But Indian campus interviews test LOW-level design — design a parking lot, an elevator, BookMyShow, with classes and OOP. That is what this track is. High-level distributed design (Kafka, sharding, CDNs) is a final-year topic and you get its fundamentals free from CE301 anyway.',
  units: [
    { t: 'OOP foundations: SOLID principles', u: 'https://www.youtube.com/watch?v=HLFbeC78YlU', kind: 'video', note: 'One 45-min video. Everything in LLD builds on this.' },
    { t: 'UML class diagrams (also CE302 Module 3)', u: 'https://www.youtube.com/watch?v=UI6lqHOVHic', kind: 'video', note: 'Doubles as college marks. Watch once, use forever.' },
    { t: 'Design Patterns: Strategy, Observer, Factory, Singleton', u: 'https://refactoring.guru/design-patterns', kind: 'read', note: 'Refactoring Guru is the best free resource. Read these 4 first — they cover 80% of interviews.' },
    { t: 'LLD: Design a Parking Lot', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build', note: 'The canonical first problem. Write actual C++ classes.' },
    { t: 'LLD: Design an Elevator System', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build' },
    { t: 'LLD: Design a Vending Machine', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build' },
    { t: 'LLD: Design BookMyShow', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build', note: 'Concurrency matters here — seat locking.' },
    { t: 'LLD: Design a Rate Limiter', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build' },
    { t: 'LLD: Design Splitwise', u: 'https://github.com/ashishps1/awesome-low-level-design', kind: 'build' },
    { t: 'HLD intro: System Design in a Hurry', u: 'https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction', kind: 'read', note: 'Free. Only after the LLD problems above. December.' },
    { t: 'HLD: Alex Xu — key concepts video summary', u: 'https://www.youtube.com/@ByteByteGo', kind: 'video', note: 'ByteByteGo channel. Watch the top 5 most-viewed. December.' },
  ],
};

export const AI = {
  name: 'AI / ML',
  why: 'You have ~70 usable hours in 5 months. That buys ONE path properly, not four. This is the highest-return one, and it doubles as your CE303 neural networks module.',
  coursera: 'Your friend is right — Coursera Financial Aid gives full free access. Apply on the course page, takes ~15 days to approve, so apply EARLY. Andrew Ng ML Specialization is the one worth applying for.',
  units: [
    { t: 'Python for a C++ programmer', u: 'https://www.youtube.com/watch?v=rfscVS0vtbw', kind: 'video', note: 'You already program. This is syntax + NumPy idiom only. Skim at 1.5x.' },
    { t: '3Blue1Brown — Essence of Linear Algebra', u: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab', kind: 'video', note: 'Videos 1-4 only. Build intuition, do not take notes.' },
    { t: '3Blue1Brown — Neural Networks', u: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi', kind: 'video', note: 'All 4 videos. This is the best explanation of backprop that exists.' },
    { t: 'Karpathy — micrograd (Lecture 1)', u: 'https://www.youtube.com/watch?v=VMj-3S1tku0', kind: 'build', note: 'TYPE EVERY LINE. Do not just watch. This single lecture teaches backprop better than your CE303 textbook.' },
    { t: 'Karpathy — makemore Part 1 (Lecture 2)', u: 'https://www.youtube.com/watch?v=PaCmpygFfXo', kind: 'build' },
    { t: 'Karpathy — makemore Part 2 (Lecture 3)', u: 'https://www.youtube.com/watch?v=TCH_1BHY58I', kind: 'build' },
    { t: 'Karpathy — makemore Part 3 (Lecture 4)', u: 'https://www.youtube.com/watch?v=P6sfmUTpUmc', kind: 'build' },
    { t: 'Karpathy — makemore Part 4 (Lecture 5)', u: 'https://www.youtube.com/watch?v=q8SA3rM6ckI', kind: 'build' },
    { t: 'Karpathy — WaveNet (Lecture 6)', u: 'https://www.youtube.com/watch?v=t3YJ5hKiMQ0', kind: 'build' },
    { t: 'Karpathy — Build GPT from scratch (Lecture 7)', u: 'https://www.youtube.com/watch?v=kCc8FmEb1nY', kind: 'build', note: 'The payoff. After this you understand what an LLM actually is.' },
    { t: 'Write it up publicly (LinkedIn + GitHub)', u: 'https://github.com', kind: 'build', note: 'A from-scratch GPT with a writeup of what broke is a genuine portfolio piece.' },
  ],
};

export const COLLEGE = {
  subjects: [
    { code: 'PR1', name: 'Mini Project I', marks: 200, note: 'Phase I 17 Aug (survey/scoping, NO code marks), Phase II 12 Oct. Highest marks-per-credit on your entire semester.' },
    { code: 'M132', name: 'Intermediate UI/UX', marks: 200, note: 'Studio work, 80 marks lab ISE. Most sellable skill here — this is freelance portfolio with marks attached.' },
    { code: 'CE301', name: 'Distributed Computing', marks: 100, note: 'Your free system design course. M3 = clocks/election, M4 = consistency, M5 = HDFS/Kafka/microservices.' },
    { code: 'CE302', name: 'Software Engineering', marks: 100, note: 'SRS + UML + planning. Its lab work IS your PR1 documentation. Write once, submit twice.' },
    { code: 'CE303', name: 'AI & Soft Computing', marks: 100, note: 'Lab ISE 26 — heaviest of any subject. Never skip these labs. M2 neural nets + M4 fuzzy = 24 of 42 hours.' },
    { code: 'CE305', name: 'Cryptography & Net Sec', marks: 100, note: 'Everything is in Stallings 7e. One of the rare textbooks worth reading directly.' },
    { code: 'CE304', name: 'Theory of Computation', marks: 100, note: 'No lab, pure theory, zero practical use. Your designated bunk target. Sipser + 2 focused weekends before the exam.' },
  ],
};

// Fixed-date items. type: deadline | exam | event | contest
export const EVENTS = [
  { d: '2026-07-22', t: 'Create Codeforces account + set up problem log', type: 'admin', why: 'Rating cannot move until it exists. 10 minutes.' },
  { d: '2026-07-23', t: 'Apply: Microsoft Learn Student Ambassador', type: 'admin', u: 'https://mvp.microsoft.com/en-US/studentambassadors', why: 'Rolling applications, no deadline, no gate. 10 minutes.' },
  { d: '2026-07-24', t: 'Apply: Coursera Financial Aid — Andrew Ng ML Specialization', type: 'admin', u: 'https://www.coursera.org/specializations/machine-learning-introduction', why: 'Takes ~15 days to approve. Apply now so it is ready when you need it.' },
  { d: '2026-07-25', t: 'Check Figma Campus Leader deadline', type: 'deadline', u: 'https://www.figma.com/campus-leaders/', why: 'Prior cycle closed 10 Aug. Pairs directly with your M132 subject.' },
  { d: '2026-07-26', t: 'Apply: Jane Street summer 2027 internship', type: 'deadline', u: 'https://www.janestreet.com/join-jane-street/internships/', why: 'No GPA requirement, no cover letter. Rolling — slots fill by late October.' },
  { d: '2026-07-27', t: 'Form Adobe hackathon team (2-3 people, same college)', type: 'deadline', why: 'Registration closes 8 Aug and Round 1 is 9 Aug. Team first, then register.' },
  { d: '2026-08-01', t: 'Check attendance on ERP (defaulter list published)', type: 'admin', why: 'Published 1st of every month. Monthly checkpoint so October is not a surprise.' },
  { d: '2026-08-03', t: 'Find SPIT SIH SPOC + start 6-person team (needs 1+ female member)', type: 'deadline', u: 'https://sih.gov.in/', why: 'You cannot register directly. The college internal round is the real gate.' },
  { d: '2026-08-05', t: 'Start Optiver 80-in-8 arithmetic training', type: 'admin', u: 'https://www.optiver.com/join-us/locations/mumbai/', why: '80 maths problems in 8 minutes. Top 10% gets interviewed REGARDLESS of college. Train before applying — 8-month lockout if you fail.' },
  { d: '2026-08-08', t: 'DEADLINE: Register for Adobe India Hackathon', type: 'deadline', u: 'https://unstop.com/p/adobe-india-hackathon-2026-adobe-1715333', why: 'Pre-placement interviews restricted to the 2028 batch — that is you. Top 50 get an Adobe internship at Rs 1.1L/month.' },
  { d: '2026-08-09', t: 'Adobe Round 1 — 90 min online assessment, 2-10 PM', type: 'exam' },
  { d: '2026-08-15', t: 'Apply: Optiver summer 2027 internship', type: 'deadline', u: 'https://www.optiver.com/join-us/locations/mumbai/', why: 'Only after 10 days of arithmetic drilling.' },
  { d: '2026-08-17', t: 'PR1 Mini Project Phase I evaluation', type: 'exam', why: 'Marks: survey 15, problem definition 10, presentation 15, planning 10. ZERO for code.' },
  { d: '2026-08-26', t: 'Holiday — Id-E-Milad', type: 'event' },
  { d: '2026-09-01', t: 'Check attendance on ERP', type: 'admin' },
  { d: '2026-09-07', t: 'MID TERM TESTS begin (to 11 Sep)', type: 'exam', why: 'DSA drops to maintenance. Contests only, no new topics.' },
  { d: '2026-09-14', t: 'Holiday — Ganesh Chaturthi', type: 'event' },
  { d: '2026-09-25', t: 'Holiday — Anant Chaturdashi', type: 'event' },
  { d: '2026-10-01', t: 'Check attendance on ERP', type: 'admin' },
  { d: '2026-10-02', t: 'Parent-teacher meeting', type: 'event', why: 'Attendance gets discussed out loud. Be above 75% by now.' },
  { d: '2026-10-12', t: 'PR1 Mini Project Phase II evaluation', type: 'exam', why: 'Full implementation, results, report. The heavier half.' },
  { d: '2026-10-19', t: 'Holiday — Gandhi Jayanti compensatory', type: 'event' },
  { d: '2026-10-20', t: 'Holiday — Dussehra', type: 'event' },
  { d: '2026-11-01', t: 'Check attendance on ERP', type: 'admin' },
  { d: '2026-11-02', t: 'PRACTICAL EXAMS begin (to 6 Nov)', type: 'exam' },
  { d: '2026-11-06', t: 'Academic term ends', type: 'event' },
  { d: '2026-11-23', t: 'THEORY EXAMS begin (to 30 Nov)', type: 'exam' },
  { d: '2026-12-01', t: 'OPEN GROUND begins — 5 weeks, nothing scheduled', type: 'event', why: 'The single most valuable block of your year. ~150 free hours. This is where the rating actually moves.' },
  { d: '2026-12-15', t: 'Watch: SPIT Hackathon + HackFusion registrations open', type: 'deadline', why: 'Both land in Feb 2027. Registrations open late Dec to late Jan.' },
];

export const PHASES = [
  { start: '2026-07-22', end: '2026-08-17', name: 'Foundation', pd: 2, note: 'Gaps first. Adobe + applications. 2 problems/day.' },
  { start: '2026-08-18', end: '2026-09-11', name: 'Mid Terms', pd: 1, note: 'MAINTENANCE ONLY. 1 problem/day. Do not fight this.' },
  { start: '2026-09-12', end: '2026-10-12', name: 'Build & Compete', pd: 2, note: 'Middle game. Trees, graphs. 2/day.' },
  { start: '2026-10-13', end: '2026-11-30', name: 'Exams', pd: 1, note: 'Contests only, no new topics. Protect the streak, not the volume.' },
  { start: '2026-12-01', end: '2027-01-04', name: 'Open Ground', pd: 4, note: 'The big push. DP + advanced. 4/day, 3-4 contests a week.' },
];
