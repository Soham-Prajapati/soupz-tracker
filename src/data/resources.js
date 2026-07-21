// Per-subject YouTube resources. Links are CHANNEL SEARCH urls, not playlist IDs —
// deterministic and won't rot. One click lands you on the right playlist.

const ch = (handle, q) => `https://www.youtube.com/@${handle}/search?query=${encodeURIComponent(q)}`;

export const RESOURCES = [
  {
    code: 'CE301', name: 'Distributed Computing', color: 'var(--dsa)',
    verdict: 'hard',
    summary: 'Your hardest subject to self-study — DC is the weakest-served subject on Indian YouTube. No single channel covers it well. Start earliest.',
    picks: [
      { t: '5 Minutes Engineering — Distributed Computing', u: ch('5MinutesEngineering','distributed computing'), tag: 'BEST AVAILABLE', note: 'The only channel covering the MU DC syllabus close to end-to-end. Lamport/vector clocks, Bully & Ring, Ricart-Agrawala, consistency models, NFS/AFS, MapReduce. ~80% coverage. Shallow but exam-shaped.' },
      { t: 'Sudhakar Atchala — Distributed Systems', u: ch('SudhakarAtchala','distributed systems'), tag: 'BACKUP', note: 'Slower, more rigorous. Better on RPC/RMI and DFS. JNTU framing but good overlap.' },
      { t: 'MIT 6.824 Distributed Systems', u: 'https://www.youtube.com/results?search_query=MIT+6.824+distributed+systems', tag: 'DEPTH ONLY', note: 'World-class but NOT syllabus-matched — Raft/Spanner research material, no Lamport numericals. For placements, not the MU paper.' },
    ],
    gaps: 'MPI, GFS/HDFS internals, distributed deadlock detection — use Tanenbaum textbook.',
  },
  {
    code: 'CE302', name: 'Software Engineering', color: 'var(--contest)',
    picks: [
      { t: 'Knowledge Gate (Sanchit Sir) — Software Engineering', u: ch('KNOWLEDGEGATE_kg','software engineering'), tag: 'BEST', note: 'A single long structured course — process models, SRS, coupling/cohesion, testing, cyclomatic complexity, COCOMO, risk management. ~90% coverage. The best free SE course available.' },
      { t: '5 Minutes Engineering — Software Engineering', u: ch('5MinutesEngineering','software engineering'), tag: 'FOR UML/DFD', note: 'MU-flavoured. Use specifically for DFD and UML diagram drawing, which Knowledge Gate underserves.' },
      { t: 'Christopher Okhravi — Design Patterns', u: 'https://www.youtube.com/@ChristopherOkhravi', tag: 'PATTERNS', note: 'Best free design-patterns explainer anywhere (Head First series). If you want to actually understand Strategy/Observer/Factory rather than memorise them.' },
    ],
    gaps: 'GRASP is poorly served on YouTube — read Larman\'s "Applying UML and Patterns" chapter instead.',
  },
  {
    code: 'CE303', name: 'AI & Soft Computing', color: 'var(--ai)',
    verdict: 'good',
    summary: 'Strongest recommendation on this whole list. Soft computing is a NUMERICAL paper and almost no channel actually solves the problems — Huddar does.',
    picks: [
      { t: 'Mahesh Huddar — Soft Computing', u: ch('MaheshHuddar','soft computing'), tag: 'BEST', note: 'Fully worked numericals for exactly your syllabus: McCulloch-Pitts, perceptron, Adaline/Madaline, backprop step-by-step, Hebbian, Kohonen SOM, LVQ, BAM, Hopfield, fuzzy relations, max-min composition, defuzzification. ~90% coverage.' },
      { t: 'Mahesh Huddar — Artificial Intelligence', u: ch('MaheshHuddar','artificial intelligence'), tag: 'AI HALF', note: 'Intelligent agents, agent types, problem solving.' },
      { t: '5 Minutes Engineering — Soft Computing', u: ch('5MinutesEngineering','soft computing'), tag: 'THEORY', note: 'For definitions and theory where Huddar is numerical-heavy.' },
      { t: 'Karpathy — micrograd (backprop from scratch)', u: 'https://www.youtube.com/watch?v=VMj-3S1tku0', tag: 'GO DEEPER', note: 'Module 2 backprop taught better than any textbook. Also your AI/ML track — one video, two purposes.' },
    ],
    gaps: 'ANFIS is badly covered everywhere free. Budget a paper/blog read instead of hunting for a video.',
  },
  {
    code: 'CE304', name: 'Theory of Computation', color: 'var(--admin)',
    verdict: 'solved',
    summary: 'The one subject that needs no supplement. Neso covers essentially 100% of your syllabus. Solved — do not overthink it.',
    picks: [
      { t: 'Neso Academy — Theory of Computation', u: ch('nesoacademy','theory of computation'), tag: 'BEST · 100%', note: '~130 videos: DFA/NFA, epsilon-NFA conversion, minimisation, regex, pumping lemma (regular AND CFL), CFG, ambiguity, parse trees, PDA, CNF/GNF, Turing machines, decidability, halting problem, Chomsky hierarchy.' },
      { t: 'Gate Smashers — Theory of Computation', u: ch('GateSmashers','theory of computation'), tag: 'REVISION', note: 'Fast, exam-trick oriented. Use the week before the exam, not for first-pass learning.' },
    ],
  },
  {
    code: 'CE305', name: 'Cryptography & Network Security', color: 'var(--lld)',
    summary: 'This subject genuinely splits in two and no single channel does both halves. Pair them rather than choosing.',
    picks: [
      { t: 'Neso Academy — Cryptography & Network Security', u: ch('nesoacademy','cryptography network security'), tag: 'CRYPTO HALF', note: 'Mathematically honest — actually walks DES rounds, AES state transformations, RSA and Diffie-Hellman numericals, modular arithmetic. ~75% coverage, strong on Modules 1-3.' },
      { t: 'Gate Smashers — Cryptography & Network Security', u: ch('GateSmashers','cryptography and network security'), tag: 'NETWORK HALF', note: 'Better on the applied side Neso is thin on: firewalls, IDS, SSL/TLS, digital signatures, Kerberos.' },
      { t: 'Knowledge Gate — Cryptography', u: ch('KNOWLEDGEGATE_kg','cryptography'), tag: 'ALTERNATIVE', note: 'Comprehensive single-course format if you prefer one voice throughout.' },
    ],
    gaps: 'ECC is poorly explained almost everywhere — usually reduced to plugging into point-addition. Use Forouzan\'s chapter if it is weighted in your paper.',
  },
  {
    code: 'M132', name: 'Intermediate UI/UX', color: 'var(--content)',
    summary: 'No Indian academic channel answer here — and you do not want one. The international free content is excellent. Split by topic.',
    picks: [
      { t: 'Figma (official)', u: 'https://www.youtube.com/@Figma', tag: 'BEST', note: 'Config talks + official tutorials. Authoritative on design systems, variables/tokens, auto-layout, advanced prototyping, dev handoff — exactly your Modules 2-4 and 6.' },
      { t: 'NNgroup — usability & heuristics', u: 'https://www.youtube.com/@NNgroup', tag: 'MODULE 5', note: 'THE source for Nielsen\'s 10 heuristics and usability testing — Jakob Nielsen wrote them. Short, research-grounded.' },
      { t: 'Mizko', u: 'https://www.youtube.com/@Mizko', tag: 'POLISH', note: 'Modern intermediate Figma workflow, design systems, micro-interactions. Best for the "make it actually look good" gap.' },
      { t: 'AJ&Smart', u: 'https://www.youtube.com/@AJSmart', tag: 'PROCESS', note: 'Design sprints, workshops, UX process — Module 6 team collaboration.' },
    ],
  },
];

export const CHANNEL_VERDICTS = [
  { n: '5 Minutes Engineering', v: 'Your MVP for Distributed Computing — the only channel that really covers it. Also SE and Soft Computing theory. Shallow but MU-syllabus-shaped.', good: true },
  { n: 'Neso Academy', v: 'Highest-quality option this semester. Covers ToC (best in class) and CNS crypto half excellently. Nothing else on your list.', good: true },
  { n: 'Knowledge Gate', v: 'Underrated. Best free Software Engineering course available. Long single-course format, genuinely complete.', good: true },
  { n: 'Mahesh Huddar', v: 'Not on your original list but the strongest single find — worked numericals for Soft Computing that nobody else does.', good: true },
  { n: 'Sudhakar Atchala', v: 'Slow, thorough, JNTU framing. Valuable precisely because he covers Soft Computing and Distributed Systems — the two nobody else does.', good: true },
  { n: 'Gate Smashers', v: 'Excellent for last-week revision and crisp definitions. Too fast for learning a subject you do not know yet.', good: true },
  { n: 'Abdul Bari', v: 'Honestly: not useful for ANY of your 6 subjects this semester. Superb, but his catalog does not overlap Sem 5. Keep him for placement DSA prep.', good: false },
  { n: 'Last Moment Tuitions', v: 'Built for MU syllabus, but a large share is a paid funnel — free videos are often teasers. Good mapping, inconsistent free depth. Check before committing.', good: false },
  { n: 'Education 4u', v: 'Basic no-frills whiteboard. Use only as a third opinion on a ToC topic you are stuck on. Nothing unique.', good: false },
  { n: 'Ekeeda', v: 'Weakest recommendation. MU-mapped but production is lecture-recording quality, teaching varies wildly, much is paywalled. Fallback only.', good: false },
];
