// Lab experiments, from the CE 2024 syllabus. One per subject per week from 27 Jul 2026.
// Viva is asked in-lab and carries ISE marks — the "viva" field is what they actually ask.

export const LAB_START = '2026-07-27'; // Monday of week 1

export const LABS = {
  CE301: {
    name: 'Distributed Computing',
    color: 'var(--dsa)',
    exps: [
      { t: 'RPC / Java RMI client-server', viva: 'Difference between RPC and RMI. What is a stub and a skeleton? Marshalling vs unmarshalling.' },
      { t: 'Multithreading in distributed systems', viva: 'Thread vs process. User-level vs kernel-level threads. Why threads help a server scale.' },
      { t: 'Clock synchronization (Cristian / Berkeley)', viva: 'Why physical clocks drift. Cristian vs Berkeley — which needs a time server? Round-trip estimation.' },
      { t: 'Bully and Ring election algorithms', viva: 'Message complexity of Bully vs Ring. What happens if the coordinator recovers?' },
      { t: 'Consistency and replication models', viva: 'Strict vs sequential vs causal vs eventual consistency. What is a quorum? Read/write quorum condition.' },
      { t: 'Load balancing', viva: 'Static vs dynamic load balancing. Sender-initiated vs receiver-initiated.' },
      { t: 'MapReduce on Hadoop / Spark', viva: 'Map and reduce phases. What is the shuffle? Why Spark is faster than Hadoop MapReduce.' },
      { t: 'Primary-backup fault tolerance', viva: 'Failure types — crash, omission, Byzantine. What is failover? Cold vs warm vs hot standby.' },
      { t: 'MPI collectives — broadcast, scatter, gather', viva: 'Difference between scatter and broadcast. What is MPI_Barrier? Blocking vs non-blocking.' },
      { t: 'Parallel matrix multiplication with MPI', viva: 'How you partitioned the matrix. Speedup and efficiency. Amdahl\'s law.' },
    ],
  },
  CE302: {
    name: 'Software Engineering',
    color: 'var(--contest)',
    note: 'Every one of these doubles as PR1 Mini Project documentation. Write once, submit twice.',
    exps: [
      { t: 'Requirements gathering + project proposal', viva: 'Functional vs non-functional requirements. Elicitation techniques.' },
      { t: 'SRS in IEEE template', viva: 'Sections of IEEE 830. What makes a requirement testable? Traceability.' },
      { t: 'UML use case diagram', viva: 'Include vs extend. What is an actor? Use case vs user story.' },
      { t: 'UML class diagram', viva: 'Association vs aggregation vs composition. Multiplicity notation.' },
      { t: 'UML interaction (sequence) diagram', viva: 'Sequence vs collaboration diagram. Lifeline, activation bar, synchronous vs async message.' },
      { t: 'UML activity diagram', viva: 'Fork/join vs decision/merge. Swimlanes.' },
      { t: 'DFD level 0 and level 1', viva: 'Context diagram vs level 1. Rules of DFD balancing. DFD vs flowchart.' },
      { t: 'WBS + activity scheduling (Gantt/PERT)', viva: 'Critical path. Slack/float. PERT vs CPM.' },
      { t: 'RMMM plan', viva: 'Risk identification, projection, refinement. Risk exposure = probability x impact.' },
      { t: 'Implement one module + unit test cases', viva: 'Equivalence partitioning, boundary value analysis. Cyclomatic complexity formula.' },
    ],
  },
  CE303: {
    name: 'AI & Soft Computing',
    color: 'var(--ai)',
    note: 'Lab ISE here is 26 marks — the heaviest of any subject. Never miss one.',
    exps: [
      { t: 'Prolog: temperature conversion, monkey-banana, Fibonacci', viva: 'Facts vs rules vs queries. What is backtracking in Prolog? Unification.' },
      { t: 'Simple intelligent agent in Python', viva: 'PEAS description. Simple reflex vs model-based vs goal-based vs utility-based agent.' },
      { t: 'Activation functions + ANN design', viva: 'Sigmoid vs tanh vs ReLU. Why non-linearity is needed. Vanishing gradient.' },
      { t: 'Single Layer Perceptron', viva: 'Linear separability. Why SLP cannot solve XOR. Perceptron learning rule.' },
      { t: 'Supervised learning algorithm', viva: 'Backpropagation steps. Learning rate. Epoch vs iteration vs batch.' },
      { t: 'Unsupervised learning algorithm', viva: 'Winner-take-all. SOM/Kohonen topology. LVQ vs SOM.' },
      { t: 'Associative memory network', viva: 'Auto vs hetero-associative. BAM energy function. Hopfield network capacity.' },
      { t: 'Fuzzy sets and relations', viva: 'Crisp vs fuzzy set. Membership function types. Max-min composition.' },
      { t: 'Fuzzy logic controller', viva: 'Fuzzification, inference, defuzzification. Centroid method. Mamdani vs Sugeno.' },
      { t: 'ANFIS model', viva: 'Why hybrid neuro-fuzzy. ANFIS 5-layer architecture.' },
    ],
  },
  CE305: {
    name: 'Cryptography & Network Security',
    color: 'var(--lld)',
    exps: [
      { t: 'Number theory programs', viva: 'Euclidean algorithm. Fermat vs Euler theorem. Chinese Remainder Theorem.' },
      { t: 'Symmetric ciphers (DES/AES)', viva: 'Feistel structure. DES key size and why it is weak. AES rounds for 128/192/256.' },
      { t: 'Asymmetric ciphers (RSA)', viva: 'RSA key generation steps. Why factoring is hard. What is e and d?' },
      { t: 'Hash functions (SHA)', viva: 'Collision resistance vs preimage resistance. Birthday attack. MD5 vs SHA-256.' },
      { t: 'MACs and digital signatures', viva: 'MAC vs digital signature. HMAC construction. Non-repudiation.' },
      { t: 'X.509 certificates', viva: 'Certificate fields. What is a CA? Certificate chain and revocation (CRL/OCSP).' },
      { t: 'Web / mobile application security', viva: 'OWASP Top 10. SQL injection, XSS, CSRF — and their fixes.' },
      { t: 'Kerberos / IDS / firewall', viva: 'Kerberos ticket flow (AS, TGS). Signature vs anomaly IDS. Packet filter vs stateful firewall.' },
      { t: 'PGP / S-MIME', viva: 'PGP key ring. Web of trust vs PKI. How PGP does confidentiality + authentication.' },
      { t: 'SSL / TLS / IPSec', viva: 'TLS handshake steps. AH vs ESP. Transport vs tunnel mode.' },
      { t: 'Access control — MAC, DAC, RBAC', viva: 'Difference between the three. Bell-LaPadula (no read up, no write down) vs Biba.' },
    ],
  },
  M132: {
    name: 'Intermediate UI/UX',
    color: 'var(--content)',
    note: 'Studio/project based rather than fixed experiments — 80 marks of lab ISE. Deliverables follow the module order.',
    exps: [
      { t: 'Micro-interactions in Figma', viva: 'What makes an interaction feel responsive? Trigger, rules, feedback, loops.' },
      { t: 'Build a UI kit / design system', viva: 'Components vs variants. Why a design system reduces inconsistency. Material vs Fluent.' },
      { t: 'Responsive layout with breakpoints', viva: 'Adaptive vs responsive. Common breakpoints. Auto-layout in Figma.' },
      { t: 'High-fidelity interactive prototype', viva: 'Lo-fi vs hi-fi. Smart animate. Prototype flows and overlays.' },
      { t: 'Usability testing + heuristic evaluation', viva: "Nielsen's 10 heuristics. How many users to find most issues. Severity rating." },
      { t: 'Team project + developer handoff', viva: 'What a developer needs in handoff. Design tokens. Version history.' },
      { t: 'Final presentation', viva: 'Justify every design decision with a heuristic or a test finding.' },
    ],
  },
};

export const LAB_ORDER = ['CE301', 'CE302', 'CE303', 'CE305', 'M132'];
