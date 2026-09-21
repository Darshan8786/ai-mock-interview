import type { KbEntry } from "../types";

/** Core CS + programming fundamentals commonly asked in placement technical rounds. */
export const coreKb: KbEntry[] = [
  // ── OOP ──────────────────────────────────────────────
  {
    id: "oop-pillars",
    topic: "CS · OOP",
    title: "Four pillars of OOP",
    questions: [
      "what are the four pillars of oop",
      "explain oops concepts",
      "what is object oriented programming",
      "encapsulation inheritance polymorphism abstraction",
      "oop interview questions",
    ],
    answer:
      "The four pillars of OOP:\n• Encapsulation — bundle data and the methods that act on it, and hide internals behind access modifiers.\n• Abstraction — expose only what is necessary (interfaces / abstract classes), hide the how.\n• Inheritance — a child class reuses and extends a parent class (is-a relationship).\n• Polymorphism — one interface, many behaviours: compile-time (overloading) and run-time (overriding).\nInterview tip: give one real example for each, e.g. Shape → Circle / Rectangle overriding area().",
  },
  {
    id: "oop-abstraction-vs-encapsulation",
    topic: "CS · OOP",
    title: "Abstraction vs encapsulation",
    questions: [
      "difference between abstraction and encapsulation",
      "abstraction versus encapsulation",
      "encapsulation vs abstraction with example",
    ],
    answer:
      "Abstraction is about design: hiding complexity by showing only essential features (a car's steering wheel, not the engine internals).\nEncapsulation is about implementation: wrapping data and methods together and restricting direct access (private fields with getters/setters).\nAbstraction is achieved with interfaces and abstract classes; encapsulation with access modifiers.",
  },
  {
    id: "oop-overloading-overriding",
    topic: "CS · OOP",
    title: "Overloading vs overriding",
    questions: [
      "difference between method overloading and overriding",
      "overloading versus overriding",
      "what is method overriding",
      "what is compile time and run time polymorphism",
    ],
    answer:
      "Overloading: same method name, different parameter list, in the same class — resolved at compile time (static polymorphism).\nOverriding: a subclass redefines a parent method with the same signature — resolved at run time (dynamic polymorphism) via the virtual table.\nReturn type alone cannot distinguish overloads.",
  },
  {
    id: "oop-interface-abstract",
    topic: "CS · OOP",
    title: "Abstract class vs interface",
    questions: [
      "difference between abstract class and interface",
      "abstract class versus interface in java",
      "when to use interface instead of abstract class",
    ],
    answer:
      "• An abstract class can hold state (fields), constructors and both abstract and concrete methods; a class can extend only one.\n• An interface defines a contract (methods without state); a class can implement many interfaces.\nUse an abstract class for a shared base with common code (is-a); use an interface for a capability (can-do) that unrelated classes may share.",
  },
  // ── OS ───────────────────────────────────────────────
  {
    id: "os-process-thread",
    topic: "CS · Operating Systems",
    title: "Process vs thread",
    questions: [
      "difference between process and thread",
      "process versus thread",
      "what is a thread in operating system",
      "what is a process",
      "what is context switching",
    ],
    answer:
      "A process is a program in execution with its own address space and resources. A thread is a lightweight unit of execution inside a process; threads of one process share code, data and heap but have their own stack and registers.\nThreads are cheaper to create and switch, but shared memory needs synchronisation.\nContext switch = saving one task's state and loading another's; it is overhead, and costlier between processes than threads.",
  },
  {
    id: "os-deadlock",
    topic: "CS · Operating Systems",
    title: "Deadlock",
    questions: [
      "what is deadlock",
      "necessary conditions for deadlock",
      "how to prevent deadlock",
      "coffman conditions",
      "deadlock avoidance bankers algorithm",
    ],
    answer:
      "Deadlock: a set of processes each waiting for a resource held by another, so none can proceed.\nIt needs all four Coffman conditions: mutual exclusion, hold and wait, no preemption, circular wait.\nPrevention breaks one condition (e.g. impose a global lock order to kill circular wait). Avoidance uses the Banker's algorithm to stay in safe states. Detection + recovery kills or rolls back processes.",
  },
  {
    id: "os-scheduling",
    topic: "CS · Operating Systems",
    title: "CPU scheduling algorithms",
    questions: [
      "cpu scheduling algorithms",
      "fcfs sjf round robin priority scheduling",
      "what is round robin scheduling",
      "which scheduling algorithm is best",
      "what is starvation and aging",
    ],
    answer:
      "• FCFS — simple, but short jobs wait behind long ones (convoy effect).\n• SJF / SRTF — minimises average waiting time but can starve long jobs and needs burst-time prediction.\n• Priority — highest priority first; starvation is solved with aging.\n• Round Robin — each process gets a time quantum; fair, good for time-sharing; too small a quantum means too many context switches.",
  },
  {
    id: "os-memory",
    topic: "CS · Operating Systems",
    title: "Paging, segmentation and virtual memory",
    questions: [
      "what is virtual memory",
      "difference between paging and segmentation",
      "what is paging in os",
      "page replacement algorithms",
      "what is thrashing",
      "what is a page fault",
    ],
    answer:
      "Paging splits memory into fixed-size pages/frames (no external fragmentation). Segmentation splits by logical units of variable size (code, stack, data) and can cause external fragmentation.\nVirtual memory lets a program use more memory than physical RAM by keeping only needed pages in RAM; a page fault loads a missing page from disk.\nPage replacement: FIFO, LRU, Optimal. Thrashing = the system spends more time swapping pages than executing.",
  },
  {
    id: "os-sync",
    topic: "CS · Operating Systems",
    title: "Mutex vs semaphore",
    questions: [
      "difference between mutex and semaphore",
      "what is a semaphore",
      "what is a race condition",
      "what is critical section problem",
      "process synchronization",
    ],
    answer:
      "A mutex is a lock owned by one thread at a time — only the thread that locked it can unlock it. A semaphore is a counter that allows up to N concurrent holders (binary semaphore ≈ mutex but with no ownership) and is also used for signalling.\nA race condition occurs when the result depends on the timing of unsynchronised access to shared data; the critical section is the code that must run by one thread at a time.",
  },
  // ── DBMS ─────────────────────────────────────────────
  {
    id: "dbms-acid",
    topic: "CS · DBMS",
    title: "ACID properties",
    questions: [
      "what are acid properties",
      "explain acid in dbms",
      "what is a transaction in database",
      "atomicity consistency isolation durability",
      "what does acid stand for in databases",
      "acid meaning",
    ],
    answer:
      "ACID keeps transactions reliable:\n• Atomicity — all operations happen or none do.\n• Consistency — a transaction moves the database from one valid state to another.\n• Isolation — concurrent transactions do not see each other's partial work.\n• Durability — once committed, changes survive crashes.\nExample: a bank transfer debits and credits together or not at all.",
  },
  {
    id: "dbms-normalization",
    topic: "CS · DBMS",
    title: "Normalization",
    questions: [
      "what is normalization",
      "explain 1nf 2nf 3nf and bcnf",
      "why do we normalize a database",
      "what is denormalization",
    ],
    answer:
      "Normalization organises tables to reduce redundancy and update anomalies.\n• 1NF — atomic values, no repeating groups.\n• 2NF — 1NF and no partial dependency on part of a composite key.\n• 3NF — 2NF and no transitive dependency (non-key → non-key).\n• BCNF — for every dependency X → Y, X is a super key.\nDenormalization deliberately adds redundancy to speed up reads.",
  },
  {
    id: "dbms-keys",
    topic: "CS · DBMS",
    title: "Keys in DBMS",
    questions: [
      "difference between primary key and foreign key",
      "types of keys in dbms",
      "primary key vs unique key",
      "what is candidate key and super key",
    ],
    answer:
      "• Super key — any set of columns that uniquely identifies a row.\n• Candidate key — a minimal super key.\n• Primary key — the chosen candidate key: unique and NOT NULL, one per table.\n• Unique key — unique but allows NULL(s), many per table.\n• Foreign key — a column referencing another table's primary key to enforce referential integrity.",
  },
  {
    id: "dbms-joins",
    topic: "CS · DBMS / SQL",
    title: "SQL joins",
    questions: [
      "types of sql joins",
      "difference between inner join and left join",
      "what is a full outer join",
      "explain joins in sql with example",
      "what is a self join",
    ],
    answer:
      "• INNER JOIN — only rows with a match in both tables.\n• LEFT JOIN — all rows from the left table plus matches from the right (NULL if none).\n• RIGHT JOIN — the mirror of LEFT.\n• FULL OUTER JOIN — all rows from both sides, matched where possible.\n• CROSS JOIN — every combination. SELF JOIN — a table joined to itself (e.g. employee → manager).",
  },
  {
    id: "dbms-sql-misc",
    topic: "CS · DBMS / SQL",
    title: "SQL: WHERE vs HAVING, DELETE vs TRUNCATE",
    questions: [
      "difference between where and having",
      "difference between delete truncate and drop",
      "what is group by in sql",
      "delete vs truncate",
    ],
    answer:
      "• WHERE filters rows before grouping; HAVING filters groups after GROUP BY / aggregates.\n• DELETE removes chosen rows (DML, can be rolled back, fires triggers). TRUNCATE removes all rows quickly and resets identity (DDL, usually not rollback-able). DROP removes the table itself.",
  },
  {
    id: "dbms-index",
    topic: "CS · DBMS",
    title: "Indexing",
    questions: [
      "what is an index in database",
      "how does indexing improve performance",
      "what is a b tree index",
      "clustered vs non clustered index",
    ],
    answer:
      "An index is a separate data structure (usually a B+ tree) that lets the database find rows without scanning the whole table, turning O(n) lookups into O(log n).\nTrade-off: faster reads, slower writes and more storage. A clustered index determines the physical order of rows (one per table); a non-clustered index stores pointers to rows (many allowed).",
  },
  {
    id: "dbms-sql-nosql",
    topic: "CS · DBMS",
    title: "SQL vs NoSQL",
    questions: [
      "difference between sql and nosql",
      "when to use mongodb instead of mysql",
      "sql versus nosql databases",
    ],
    answer:
      "SQL (relational): fixed schema, tables, joins, strong ACID guarantees — good for structured, related data such as payments.\nNoSQL (MongoDB, Redis, Cassandra): flexible schema, horizontal scaling, document / key-value / graph models — good for large, evolving or unstructured data.\nChoose based on data shape and consistency needs, not fashion.",
  },
  // ── Networks ─────────────────────────────────────────
  {
    id: "cn-osi",
    topic: "CS · Computer Networks",
    title: "OSI model",
    questions: [
      "what are the layers of the osi model",
      "explain osi model",
      "difference between osi and tcp ip",
      "seven layers of networking",
    ],
    answer:
      "OSI layers, top to bottom: 7 Application, 6 Presentation, 5 Session, 4 Transport, 3 Network, 2 Data Link, 1 Physical (mnemonic: 'All People Seem To Need Data Processing').\nTCP/IP compresses these into four: Application, Transport, Internet, Network Access. OSI is a reference model; TCP/IP is what the internet actually uses.",
  },
  {
    id: "cn-tcp-udp",
    topic: "CS · Computer Networks",
    title: "TCP vs UDP",
    questions: [
      "difference between tcp and udp",
      "tcp versus udp",
      "what is the tcp three way handshake",
      "when to use udp",
    ],
    answer:
      "TCP is connection-oriented, reliable (acknowledgements, retransmission, ordering) and slower — used for web, email, file transfer.\nUDP is connectionless, best-effort, no ordering guarantee but low latency — used for streaming, gaming, DNS, VoIP.\nTCP three-way handshake: SYN → SYN-ACK → ACK.",
  },
  {
    id: "cn-http-dns",
    topic: "CS · Computer Networks",
    title: "HTTP, HTTPS and DNS",
    questions: [
      "difference between http and https",
      "what is dns and how does it work",
      "what happens when you type a url in the browser",
      "what is ssl tls",
    ],
    answer:
      "HTTPS is HTTP over TLS: traffic is encrypted and the server is authenticated by a certificate.\nDNS translates a domain name to an IP address (browser cache → OS → resolver → root → TLD → authoritative server).\nTyping a URL: DNS lookup → TCP handshake → TLS handshake (for HTTPS) → HTTP request → server response → browser renders the page.",
  },
  {
    id: "cn-ip",
    topic: "CS · Computer Networks",
    title: "IP addressing and devices",
    questions: [
      "ipv4 vs ipv6",
      "what is a subnet mask",
      "difference between hub switch and router",
      "what is arp",
      "what is an ip address",
    ],
    answer:
      "IPv4 addresses are 32-bit (about 4.3 billion); IPv6 are 128-bit. A subnet mask splits an IP into network and host parts.\nHub — repeats to all ports (layer 1). Switch — forwards by MAC address (layer 2). Router — forwards between networks by IP (layer 3).\nARP maps an IP address to a MAC address on the local network.",
  },
  // ── DSA ──────────────────────────────────────────────
  {
    id: "dsa-bigo",
    topic: "DSA · Complexity",
    title: "Big-O notation and common complexities",
    questions: [
      "what is big o notation",
      "time complexity of sorting algorithms",
      "what is time and space complexity",
      "complexity of bubble sort merge sort quick sort",
      "best average worst case complexity",
    ],
    answer:
      "Big-O describes how run time or memory grows with input size n (upper bound, ignoring constants).\n• Bubble/insertion/selection sort: O(n²). Merge sort: O(n log n), stable, O(n) extra space. Quick sort: O(n log n) average, O(n²) worst. Heap sort: O(n log n), in place.\n• Binary search: O(log n) on a sorted array. Hash lookup: O(1) average. BST lookup: O(log n) if balanced, O(n) if skewed.",
  },
  {
    id: "dsa-array-linkedlist",
    topic: "DSA · Data Structures",
    title: "Array vs linked list",
    questions: [
      "difference between array and linked list",
      "array versus linked list",
      "when to use linked list",
      "what is a linked list",
    ],
    answer:
      "Array: contiguous memory, O(1) random access, O(n) insertion/deletion in the middle, fixed size (or amortised resizing).\nLinked list: nodes with pointers, O(1) insertion/deletion when you hold the node, O(n) access by index, extra memory for pointers, poor cache locality.\nUse arrays for lookup-heavy work and linked lists when frequent insertions/deletions matter.",
  },
  {
    id: "dsa-stack-queue",
    topic: "DSA · Data Structures",
    title: "Stack vs queue",
    questions: [
      "difference between stack and queue",
      "stack versus queue",
      "what is lifo and fifo",
      "applications of stack and queue",
      "what is a priority queue",
    ],
    answer:
      "Stack: LIFO (last in, first out) — push/pop at one end. Used for function calls, undo, expression evaluation, DFS.\nQueue: FIFO (first in, first out) — enqueue at rear, dequeue at front. Used for scheduling, buffering, BFS.\nA priority queue serves the highest-priority element first and is usually implemented with a heap (O(log n) insert/remove).",
  },
  {
    id: "dsa-hashing",
    topic: "DSA · Data Structures",
    title: "Hash tables and collisions",
    questions: [
      "how does a hash table work",
      "what is hashing",
      "how are collisions handled in hashing",
      "hashmap internal working",
      "chaining vs open addressing",
    ],
    answer:
      "A hash table maps a key through a hash function to a bucket index, giving O(1) average insert/search/delete.\nCollisions (two keys, one bucket) are handled by chaining (each bucket holds a list) or open addressing (probe for the next free slot: linear, quadratic, double hashing).\nA good hash spreads keys evenly; resizing at a load-factor threshold keeps operations near O(1).",
  },
  {
    id: "dsa-trees",
    topic: "DSA · Trees & Graphs",
    title: "Binary trees and BSTs",
    questions: [
      "what is a binary search tree",
      "tree traversal inorder preorder postorder",
      "what is an avl tree",
      "what is a balanced binary tree",
      "difference between binary tree and bst",
    ],
    answer:
      "A binary tree has at most two children per node. A BST keeps left < node < right, so an inorder traversal yields sorted order and search is O(h).\nTraversals: inorder (L, root, R), preorder (root, L, R), postorder (L, R, root), level-order (BFS).\nAVL and Red-Black trees self-balance so height stays O(log n) even for sorted input.",
  },
  {
    id: "dsa-bfs-dfs",
    topic: "DSA · Trees & Graphs",
    title: "BFS vs DFS",
    questions: [
      "difference between bfs and dfs",
      "breadth first search versus depth first search",
      "what is dijkstra algorithm",
      "shortest path algorithms",
      "graph traversal",
    ],
    answer:
      "BFS explores level by level using a queue — finds the shortest path in unweighted graphs. DFS goes deep first using a stack or recursion — good for cycle detection, topological sort and connected components. Both are O(V + E).\nDijkstra finds shortest paths with non-negative weights using a min-heap in O((V + E) log V); use Bellman-Ford if negative edges exist.",
  },
  {
    id: "dsa-dp",
    topic: "DSA · Algorithms",
    title: "Dynamic programming and recursion",
    questions: [
      "what is dynamic programming",
      "difference between recursion and dynamic programming",
      "memoization vs tabulation",
      "greedy versus dynamic programming",
      "how to identify a dp problem",
    ],
    answer:
      "DP solves a problem by combining solutions of overlapping sub-problems and storing them so each is computed once.\nSigns of DP: optimal substructure + overlapping sub-problems (e.g. Fibonacci, knapsack, LCS).\n• Memoization = top-down recursion with a cache. Tabulation = bottom-up table.\n• Greedy makes the locally best choice and never revisits it — fast, but only correct when the greedy-choice property holds.",
  },
  {
    id: "dsa-prepare",
    topic: "DSA · Preparation",
    title: "How to prepare DSA for placements",
    questions: [
      "how to prepare dsa for placements",
      "dsa roadmap for campus interviews",
      "which data structures should i learn first",
      "how many leetcode problems should i solve",
      "how to start coding practice",
      "where should i begin with data structures",
      "how to start learning dsa from scratch",
    ],
    answer:
      "Order that works: complexity → arrays & strings → hashing → two pointers / sliding window → recursion & backtracking → linked list → stack & queue → trees → heaps → graphs → dynamic programming.\nSolve 2–3 problems daily, spend 20–30 minutes trying before reading a solution, then re-solve it a week later.\n150–250 well-understood problems (easy/medium) beats 500 copied solutions. Practise explaining your approach out loud.",
  },
  // ── Languages / web ──────────────────────────────────
  {
    id: "java-jdk-jvm",
    topic: "Programming · Java",
    title: "JDK, JRE and JVM",
    questions: [
      "difference between jdk jre and jvm",
      "what is jvm",
      "how does java achieve platform independence",
      "what is garbage collection in java",
    ],
    answer:
      "JVM runs Java bytecode and provides memory management; JRE = JVM + core libraries needed to run programs; JDK = JRE + compiler and dev tools (javac).\nJava is platform-independent because source compiles to bytecode that any OS's JVM can execute ('write once, run anywhere').\nThe garbage collector automatically frees objects that are no longer reachable.",
  },
  {
    id: "java-equals-string",
    topic: "Programming · Java",
    title: "== vs equals(), String immutability",
    questions: [
      "difference between equals and == in java",
      "why is string immutable in java",
      "string vs stringbuilder",
      "string pool in java",
    ],
    answer:
      "== compares references (are they the same object?); equals() compares logical content when overridden (String does).\nStrings are immutable, which makes them thread-safe, cacheable in the string pool and safe as hash keys. Use StringBuilder for repeated concatenation (non-thread-safe) or StringBuffer (thread-safe).",
  },
  {
    id: "python-basics",
    topic: "Programming · Python",
    title: "Python: list vs tuple, GIL, decorators",
    questions: [
      "difference between list and tuple in python",
      "what is the gil in python",
      "what are decorators in python",
      "what is a python list comprehension",
      "shallow copy vs deep copy",
    ],
    answer:
      "• Lists are mutable; tuples are immutable (hashable if their items are) and slightly faster.\n• The GIL lets only one thread execute Python bytecode at a time, so CPU-bound work needs multiprocessing while I/O-bound work still benefits from threads.\n• A decorator wraps a function to add behaviour: @decorator above def.\n• Shallow copy duplicates the outer container only; deep copy duplicates nested objects too.",
  },
  {
    id: "js-basics",
    topic: "Programming · JavaScript",
    title: "JavaScript: var/let/const, closures, ===",
    questions: [
      "difference between var let and const",
      "what is a closure in javascript",
      "difference between == and === in javascript",
      "what is hoisting",
      "what is the event loop",
    ],
    answer:
      "• var is function-scoped and hoisted; let/const are block-scoped, and const cannot be reassigned.\n• A closure is a function that remembers variables from the scope where it was created.\n• === compares value and type; == coerces types first, so prefer ===.\n• The event loop lets single-threaded JS run async code: call stack → microtasks (promises) → macrotasks (timers).",
  },
  {
    id: "js-async",
    topic: "Programming · JavaScript",
    title: "Promises and async/await",
    questions: [
      "what is a promise in javascript",
      "async await vs promises",
      "what is callback hell",
      "how does async await work",
    ],
    answer:
      "A Promise represents a future value in one of three states: pending, fulfilled, or rejected. Chain with .then/.catch, or use async/await, which is syntax sugar that makes async code read top-to-bottom; wrap awaits in try/catch for errors.\nUse Promise.all to run independent tasks in parallel. Promises replace deeply nested callbacks ('callback hell').",
  },
  {
    id: "react-basics",
    topic: "Web · React",
    title: "React basics",
    questions: [
      "what is the virtual dom",
      "difference between props and state in react",
      "what are react hooks",
      "usestate and useeffect explained",
      "why use react",
    ],
    answer:
      "• Virtual DOM: React keeps a lightweight copy of the UI, diffs it on updates, and applies only the minimal real-DOM changes.\n• Props are read-only inputs from a parent; state is data a component owns and can change.\n• useState stores state; useEffect runs side effects after render (fetching, subscriptions) — its dependency array controls when it re-runs, and its return function cleans up.\n• Keys help React identify list items across renders.",
  },
  {
    id: "web-rest-jwt",
    topic: "Web · Backend",
    title: "REST, JWT and CORS",
    questions: [
      "what is rest api",
      "what is jwt and how does it work",
      "what is cors",
      "difference between get and post",
      "put vs patch",
      "authentication vs authorization",
    ],
    answer:
      "• REST: resources identified by URLs, manipulated with HTTP verbs — GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE — and stateless requests.\n• JWT: a signed token (header.payload.signature) the client sends on each request so the server can verify identity without a session store.\n• CORS is a browser rule that blocks cross-origin calls unless the server allows them with headers.\n• Authentication = who you are; authorization = what you may do.",
  },
  {
    id: "web-security",
    topic: "Web · Security",
    title: "SQL injection and XSS",
    questions: [
      "what is sql injection",
      "what is xss attack",
      "how to prevent sql injection",
      "what is csrf",
    ],
    answer:
      "• SQL injection: attacker input is interpreted as SQL. Prevent with parameterised queries / ORMs, never string concatenation.\n• XSS: injected script runs in other users' browsers. Prevent by escaping output, using a Content-Security-Policy and HttpOnly cookies.\n• CSRF: tricking a logged-in user's browser into sending an unwanted request; use CSRF tokens and SameSite cookies.",
  },
  {
    id: "git-basics",
    topic: "Tools · Git",
    title: "Git basics",
    questions: [
      "difference between git fetch and git pull",
      "git merge vs rebase",
      "what is a pull request",
      "basic git commands",
      "difference between git and github",
    ],
    answer:
      "• git fetch downloads remote changes without merging; git pull = fetch + merge.\n• merge keeps history and adds a merge commit; rebase replays your commits on top of another branch for a linear history — never rebase shared/public branches.\n• Git is the version-control tool; GitHub hosts repositories and adds pull requests and review.\nEveryday flow: git add → git commit → git push → open a pull request.",
  },
  {
    id: "sdlc-agile",
    topic: "Software Engineering",
    title: "Agile vs Waterfall",
    questions: [
      "difference between agile and waterfall",
      "what is sdlc",
      "what is scrum",
      "software development life cycle phases",
    ],
    answer:
      "SDLC phases: requirements → design → implementation → testing → deployment → maintenance.\nWaterfall is sequential; each phase finishes before the next — good when requirements are fixed. Agile builds in short iterations (sprints), delivers working software often and adapts to feedback. Scrum is an Agile framework with sprints, daily stand-ups, a product owner and a scrum master.",
  },
];
