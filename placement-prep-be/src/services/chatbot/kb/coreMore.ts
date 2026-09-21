import type { KbEntry } from "../types";

/** Additional CS, programming and system-design topics for technical rounds. */
export const coreMoreKb: KbEntry[] = [
  {
    id: "mem-stack-heap",
    topic: "CS · Memory",
    title: "Stack vs heap memory",
    questions: [
      "difference between stack and heap memory",
      "what is stack memory",
      "what is heap memory",
      "where are local variables stored",
      "stack overflow versus memory leak",
    ],
    answer:
      "Stack: holds function call frames and local variables; allocation is automatic and LIFO, very fast, but the size is limited (too-deep recursion causes a stack overflow).\nHeap: holds dynamically allocated objects (new / malloc); it is larger and flexible but slower, must be freed manually in C/C++ (or by the garbage collector in Java/Python), and can suffer fragmentation and leaks.",
  },
  {
    id: "lang-compiler-interpreter",
    topic: "CS · Programming Basics",
    title: "Compiler vs interpreter",
    questions: [
      "difference between compiler and interpreter",
      "what is a compiler",
      "what is an interpreter",
      "is python compiled or interpreted",
      "what is jit compilation",
    ],
    answer:
      "A compiler translates the whole program to machine code (or bytecode) before it runs — fast execution, errors reported up front (C, C++). An interpreter executes the program line by line — easier debugging and portability, slower (classic Python, JavaScript).\nMany languages mix both: Java compiles to bytecode, then the JVM interprets it and uses JIT compilation to turn hot code into machine code.",
  },
  {
    id: "lang-pointers",
    topic: "CS · C / C++",
    title: "Pointers and memory management",
    questions: [
      "what is a pointer in c",
      "what is a dangling pointer",
      "what is a memory leak",
      "difference between malloc and calloc",
      "what is a null pointer",
      "pointer versus reference in c plus plus",
    ],
    answer:
      "A pointer is a variable that stores a memory address. malloc allocates uninitialised heap memory; calloc allocates and zeroes it; free releases it.\n• Dangling pointer: points to memory that was already freed.\n• Memory leak: heap memory that is allocated but never freed.\n• Null pointer: points to nothing; dereferencing it crashes.\nIn C++, a reference is an alias that must be initialised and cannot be reseated, whereas a pointer can change and be null.",
  },
  {
    id: "algo-recursion",
    topic: "DSA · Algorithms",
    title: "Recursion vs iteration",
    questions: [
      "what is recursion",
      "difference between recursion and iteration",
      "what is a base case",
      "what causes stack overflow in recursion",
      "what is tail recursion",
    ],
    answer:
      "Recursion: a function solves a problem by calling itself on a smaller input. It needs a base case (stop condition) and a recursive case; without a base case the call stack overflows.\nIteration uses loops, needs no extra call frames and is usually faster and lighter on memory; recursion is often clearer for trees, backtracking and divide-and-conquer. Tail recursion (the recursive call is the last step) can be optimised into a loop in some languages.",
  },
  {
    id: "oop-constructors-static",
    topic: "CS · OOP",
    title: "Constructors, destructors and static",
    questions: [
      "what is a constructor",
      "types of constructors",
      "what is a destructor",
      "what does the static keyword mean",
      "what is the this keyword",
      "what is a copy constructor",
    ],
    answer:
      "• A constructor initialises a new object; it has the class name and no return type. Types: default, parameterised and (in C++) copy constructor.\n• A destructor (C++) cleans up when an object is destroyed; Java relies on the garbage collector instead.\n• static members belong to the class, not an instance — shared by all objects; static methods cannot use instance fields directly.\n• this refers to the current object.",
  },
  {
    id: "oop-virtual-diamond",
    topic: "CS · OOP",
    title: "Virtual functions and multiple inheritance",
    questions: [
      "what is a virtual function",
      "what is a vtable",
      "what is a pure virtual function",
      "what is the diamond problem",
      "does java support multiple inheritance",
    ],
    answer:
      "A virtual function (C++) is resolved at run time through the object's vtable so the derived class's version is called via a base pointer (dynamic polymorphism). A pure virtual function (= 0) makes a class abstract.\nThe diamond problem: a class inherits from two classes that share a common base, making members ambiguous. C++ solves it with virtual inheritance; Java avoids it by allowing multiple inheritance of interfaces only, not classes.",
  },
  {
    id: "oop-solid-patterns",
    topic: "CS · Design",
    title: "SOLID principles and design patterns",
    questions: [
      "what are solid principles",
      "what is the singleton pattern",
      "what is the factory design pattern",
      "what is the observer pattern",
      "common design patterns asked in interviews",
    ],
    answer:
      "SOLID: Single responsibility (one reason to change), Open/closed (open to extension, closed to modification), Liskov substitution (subtypes must be usable as their base), Interface segregation (small focused interfaces), Dependency inversion (depend on abstractions).\nPatterns: Singleton — exactly one instance; Factory — creates objects without exposing the concrete class; Observer — subscribers get notified when a subject changes.",
  },
  {
    id: "java-collections",
    topic: "Programming · Java",
    title: "Java collections",
    questions: [
      "difference between arraylist and linkedlist",
      "difference between hashmap and hashset",
      "difference between hashmap and hashtable",
      "what is the java collections framework",
      "how does hashmap work internally",
    ],
    answer:
      "• ArrayList: dynamic array, O(1) index access, slow middle inserts. LinkedList: doubly linked, O(1) add/remove at the ends, O(n) access.\n• HashMap stores key–value pairs; HashSet stores unique elements (backed by a HashMap).\n• HashMap is unsynchronised and allows one null key; Hashtable is legacy, synchronised and forbids nulls (use ConcurrentHashMap instead).\nHashMap hashes the key to a bucket; collisions form a linked list or tree.",
  },
  {
    id: "java-exceptions-threads",
    topic: "Programming · Java",
    title: "Exceptions and multithreading in Java",
    questions: [
      "difference between checked and unchecked exceptions",
      "difference between final finally and finalize",
      "how to create a thread in java",
      "what is the synchronized keyword",
      "what is the volatile keyword",
    ],
    answer:
      "• Checked exceptions (e.g. IOException) must be handled or declared at compile time; unchecked ones (RuntimeException such as NullPointerException) need not be.\n• final = constant / no override / no inheritance; finally = block that always runs after try; finalize = deprecated pre-GC hook.\n• Create a thread by extending Thread, implementing Runnable, or using an ExecutorService.\n• synchronized gives mutual exclusion on a lock; volatile guarantees visibility of a variable's latest value across threads (not atomicity).",
  },
  {
    id: "sql-query-patterns",
    topic: "CS · SQL",
    title: "Common SQL interview queries",
    questions: [
      "find the second highest salary in sql",
      "how to find duplicate records in a table",
      "difference between subquery and join",
      "how to get top n rows in sql",
      "group by and aggregate functions",
    ],
    answer:
      "• Second highest: SELECT MAX(salary) FROM emp WHERE salary < (SELECT MAX(salary) FROM emp); or ORDER BY salary DESC LIMIT 1 OFFSET 1 (use DISTINCT when ties exist).\n• Duplicates: SELECT col, COUNT(*) FROM t GROUP BY col HAVING COUNT(*) > 1;\n• Top N: ORDER BY … LIMIT n (TOP n in SQL Server).\n• A subquery is a query nested in another; a join combines rows from tables and is often faster and easier to optimise.\nAggregates: COUNT, SUM, AVG, MIN, MAX with GROUP BY.",
  },
  {
    id: "sql-objects",
    topic: "CS · DBMS / SQL",
    title: "Views, triggers, procedures and constraints",
    questions: [
      "what is a view in sql",
      "what is a stored procedure",
      "what is a trigger in database",
      "types of constraints in sql",
      "difference between procedure and function in sql",
    ],
    answer:
      "• View: a virtual table defined by a query, used to simplify or restrict access.\n• Stored procedure: a saved, reusable block of SQL run on demand. A function returns a value and can be used inside queries.\n• Trigger: code that runs automatically on INSERT, UPDATE or DELETE.\n• Constraints: NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, CHECK, DEFAULT.",
  },
  {
    id: "dbms-isolation",
    topic: "CS · DBMS",
    title: "Isolation levels and concurrency",
    questions: [
      "what are transaction isolation levels",
      "what is a dirty read",
      "what is a phantom read",
      "how does a database handle concurrent transactions",
      "what is mvcc",
    ],
    answer:
      "Isolation levels, weakest to strongest: Read Uncommitted, Read Committed, Repeatable Read, Serializable.\nAnomalies they prevent: dirty read (reading uncommitted data), non-repeatable read (a row changes between two reads), phantom read (new rows appear between two range reads).\nDatabases control concurrency with locking or MVCC (multi-version concurrency control), where readers see a consistent snapshot without blocking writers.",
  },
  {
    id: "sys-caching",
    topic: "CS · Systems",
    title: "Caching",
    questions: [
      "what is caching",
      "what is a cache hit and cache miss",
      "what is lru cache",
      "why is cache faster",
      "what is redis used for",
    ],
    answer:
      "A cache is a small, fast store holding recently or frequently used data so it need not be fetched from a slower source (CPU cache, browser cache, Redis in front of a database).\nHit = data found in the cache; miss = must fetch and usually store it. When full, an eviction policy such as LRU (least recently used) removes an entry. It works because of locality: recently used data tends to be used again.",
  },
  {
    id: "algo-sorting",
    topic: "DSA · Algorithms",
    title: "How quick sort and merge sort work",
    questions: [
      "how does quick sort work",
      "how does merge sort work",
      "what is a stable sorting algorithm",
      "which sorting algorithms are in place",
      "quick sort versus merge sort",
    ],
    answer:
      "• Quick sort: pick a pivot, partition so smaller items go left and larger go right, then recurse on both sides. In place, average O(n log n), worst O(n²) with bad pivots.\n• Merge sort: split the array in half, sort each half, merge the sorted halves. Always O(n log n), stable, needs O(n) extra space.\nStable sorts keep equal elements in original order (merge, insertion, bubble); quick, heap and selection sort are not stable.",
  },
  {
    id: "algo-binary-search",
    topic: "DSA · Algorithms",
    title: "Binary search",
    questions: [
      "how does binary search work",
      "binary search time complexity",
      "binary search on an unsorted array",
      "binary search implementation tips",
    ],
    answer:
      "Binary search finds a target in a SORTED array by comparing with the middle element and discarding half each step — O(log n) time, O(1) space iteratively.\nCompute mid = low + (high − low) / 2 to avoid integer overflow, and be careful with loop conditions (low ≤ high). It also works on the 'answer space' (e.g. minimum capacity to ship in D days).",
  },
  {
    id: "dsa-heap",
    topic: "DSA · Data Structures",
    title: "Heaps",
    questions: [
      "what is a heap data structure",
      "difference between min heap and max heap",
      "what is heapify",
      "how does heap sort work",
      "how to find the kth largest element",
    ],
    answer:
      "A heap is a complete binary tree where each parent is ≥ its children (max-heap) or ≤ (min-heap), usually stored in an array. Insert and remove-top are O(log n); building a heap is O(n).\nHeap sort builds a max-heap and repeatedly removes the top. For the k-th largest element, keep a min-heap of size k — O(n log k).",
  },
  {
    id: "algo-patterns",
    topic: "DSA · Algorithms",
    title: "Two pointers and sliding window",
    questions: [
      "what is the two pointer technique",
      "what is the sliding window technique",
      "longest substring without repeating characters approach",
      "how to solve subarray sum problems",
      "common coding interview patterns",
    ],
    answer:
      "• Two pointers: move two indices through a (usually sorted) array — pair sum, removing duplicates, reversing — turning O(n²) into O(n).\n• Sliding window: maintain a window [left, right] over an array/string, expanding right and shrinking left to keep a condition (longest substring without repeats, max sum of size k).\nOther staple patterns: hashing for lookups, prefix sums for subarray sums, fast/slow pointers, BFS/DFS, DP.",
  },
  {
    id: "dsa-linkedlist-ops",
    topic: "DSA · Data Structures",
    title: "Linked list interview problems",
    questions: [
      "how to reverse a linked list",
      "how to detect a cycle in a linked list",
      "how to find the middle of a linked list",
      "floyd cycle detection algorithm",
    ],
    answer:
      "• Reverse: walk the list keeping prev, curr and next; point curr.next to prev each step — O(n) time, O(1) space.\n• Detect a cycle (Floyd's tortoise and hare): move slow by 1 and fast by 2; if they meet there is a cycle; if fast reaches null there is none.\n• Middle: when the fast pointer reaches the end, slow is at the middle.",
  },
  {
    id: "dsa-graph-algos",
    topic: "DSA · Trees & Graphs",
    title: "Graph representation, MST and topological sort",
    questions: [
      "adjacency list versus adjacency matrix",
      "what is a minimum spanning tree",
      "difference between prim and kruskal",
      "what is topological sort",
      "how to detect a cycle in a graph",
    ],
    answer:
      "• Adjacency matrix: O(V²) space, O(1) edge check; adjacency list: O(V + E) space, best for sparse graphs.\n• MST connects all vertices with minimum total edge weight. Kruskal sorts edges and adds the smallest that makes no cycle (union-find); Prim grows a tree from a start vertex by picking the cheapest edge out.\n• Topological sort orders a DAG so every edge goes forward (Kahn's algorithm with in-degrees, or DFS) — used for task scheduling.\n• Cycle detection: DFS with a recursion stack (directed) or union-find (undirected).",
  },
  {
    id: "dsa-choose-structure",
    topic: "DSA · Data Structures",
    title: "Choosing the right data structure",
    questions: [
      "which data structure should i use",
      "what is a trie",
      "which data structure is used for undo",
      "when to use hash map versus tree",
      "data structure for prefix search",
    ],
    answer:
      "• Fast lookup by key → hash map. Sorted order / range queries → balanced BST (TreeMap).\n• Undo, parsing, DFS → stack. FIFO, BFS, scheduling → queue.\n• Top-k, min/max repeatedly → heap. Prefix search / autocomplete → trie (a tree where each edge is a character; lookup O(L)).\n• Connectivity questions → union-find.",
  },
  {
    id: "sys-design-basics",
    topic: "System Design",
    title: "Scalability, load balancing and CAP",
    questions: [
      "what is scalability",
      "horizontal versus vertical scaling",
      "what is a load balancer",
      "what is the cap theorem",
      "what is database sharding",
      "what is replication in databases",
    ],
    answer:
      "• Vertical scaling = a bigger machine; horizontal scaling = more machines behind a load balancer, which spreads requests across servers.\n• Replication copies data to several nodes for availability and read throughput; sharding splits data across nodes to scale writes and storage.\n• CAP theorem: during a network partition a distributed system can guarantee only one of consistency or availability.",
  },
  {
    id: "sys-microservices",
    topic: "System Design",
    title: "Monolith vs microservices",
    questions: [
      "difference between monolith and microservices",
      "what are microservices",
      "advantages of microservices architecture",
      "what is an api gateway",
    ],
    answer:
      "A monolith is one deployable application: simple to build and test, but it scales and deploys as a single unit. Microservices split the system into small independently deployable services that communicate over APIs: independent scaling and releases, but more operational complexity (networking, monitoring, data consistency).\nAn API gateway is the single entry point that routes requests, handles auth and rate limiting.",
  },
  {
    id: "tools-docker-cloud",
    topic: "Tools · DevOps & Cloud",
    title: "Docker and cloud basics",
    questions: [
      "what is docker",
      "difference between docker and virtual machine",
      "what is a container",
      "what are iaas paas and saas",
      "what is cloud computing",
      "what is ci cd",
    ],
    answer:
      "• Docker packages an app with its dependencies into an image; a container is a running instance. Containers share the host OS kernel, so they are lighter and faster to start than VMs, which each run a full guest OS.\n• Cloud service models: IaaS (raw VMs/storage, e.g. AWS EC2), PaaS (managed platform, e.g. Heroku), SaaS (finished software, e.g. Gmail).\n• CI/CD automatically builds, tests and deploys code on every change.",
  },
  {
    id: "web-api-graphql",
    topic: "Web · Backend",
    title: "API, REST vs GraphQL, status codes",
    questions: [
      "what is an api",
      "difference between rest and graphql",
      "common http status codes",
      "what does 404 and 500 mean",
      "difference between 401 and 403",
    ],
    answer:
      "An API is a contract that lets one program use another's functionality. REST exposes many resource endpoints with fixed responses; GraphQL exposes one endpoint where the client asks for exactly the fields it needs (avoids over/under-fetching).\nStatus codes: 200 OK, 201 Created, 204 No Content, 301/302 redirect, 400 Bad Request, 401 Unauthorized (not authenticated), 403 Forbidden (not allowed), 404 Not Found, 500 Internal Server Error, 503 Service Unavailable.",
  },
  {
    id: "web-storage-mvc",
    topic: "Web · Frontend & Backend",
    title: "Cookies, sessions, storage and MVC",
    questions: [
      "difference between cookies and local storage",
      "difference between session and cookie",
      "what is mvc architecture",
      "localstorage versus sessionstorage",
      "what is a middleware",
    ],
    answer:
      "• Cookies (~4 KB) are sent to the server on every request and can be HttpOnly/Secure; localStorage (~5–10 MB) stays in the browser until cleared; sessionStorage lasts one tab. A session is server-side state identified by a cookie.\n• MVC: Model (data and rules), View (UI), Controller (handles input, updates the model and view).\n• Middleware is code that runs between request and response (auth, logging, parsing).",
  },
  {
    id: "js-more",
    topic: "Programming · JavaScript",
    title: "JavaScript: this, arrow functions, map/filter/reduce",
    questions: [
      "how does the this keyword work in javascript",
      "difference between arrow function and normal function",
      "map filter reduce in javascript",
      "difference between null and undefined",
      "what is prototype in javascript",
    ],
    answer:
      "• this depends on how a function is called; arrow functions have no own this and use the surrounding one.\n• map transforms each item into a new array, filter keeps items that pass a test, reduce folds an array into a single value.\n• undefined = declared but no value; null = intentionally empty.\n• JavaScript inheritance is prototype-based: objects delegate property lookups up their prototype chain.",
  },
  {
    id: "python-more",
    topic: "Programming · Python",
    title: "Python: is vs ==, args/kwargs, generators",
    questions: [
      "difference between is and == in python",
      "what are args and kwargs",
      "what is a generator in python",
      "what is a lambda function",
      "mutable default argument problem",
    ],
    answer:
      "• == compares values; is compares object identity.\n• *args collects extra positional arguments into a tuple; **kwargs collects keyword arguments into a dict.\n• A generator uses yield to produce values lazily, saving memory.\n• lambda creates a small anonymous function.\n• Mutable default arguments (def f(x=[])) are created once and shared between calls — use None and create the list inside.",
  },
  {
    id: "web-css-layout",
    topic: "Web · Frontend",
    title: "CSS layout basics",
    questions: [
      "difference between flexbox and grid",
      "what is the css box model",
      "difference between margin and padding",
      "what is responsive design",
    ],
    answer:
      "Flexbox lays items out along one axis (row or column); CSS Grid handles two dimensions (rows and columns).\nBox model, inside out: content → padding → border → margin. Padding is space inside the border; margin is space outside it.\nResponsive design adapts the layout to screen size using fluid units and media queries.",
  },
  {
    id: "test-basics",
    topic: "Software Engineering",
    title: "Software testing types",
    questions: [
      "difference between unit testing and integration testing",
      "black box versus white box testing",
      "what is regression testing",
      "what is test driven development",
    ],
    answer:
      "• Unit tests check one function/class in isolation; integration tests check that modules work together; system/end-to-end tests check the whole flow.\n• Black-box testing checks behaviour without seeing the code; white-box testing uses knowledge of the internals.\n• Regression testing re-runs tests after a change to make sure nothing broke.\n• TDD: write a failing test first, then the code to pass it, then refactor.",
  },
  {
    id: "ml-basics",
    topic: "AI / ML Basics",
    title: "Machine learning basics",
    questions: [
      "difference between supervised and unsupervised learning",
      "what is overfitting",
      "what is machine learning",
      "what is the difference between classification and regression",
      "what is a train test split",
    ],
    answer:
      "Machine learning lets a model learn patterns from data. Supervised learning uses labelled data (classification predicts a category, regression predicts a number); unsupervised learning finds structure in unlabelled data (clustering).\nOverfitting = the model memorises training data and fails on new data; reduce it with more data, regularisation, simpler models or cross-validation. Always evaluate on a held-out test set.",
  },
  {
    id: "os-kernel-interrupts",
    topic: "CS · Operating Systems",
    title: "Kernel, system calls and interrupts",
    questions: [
      "what is the kernel in an operating system",
      "what is a system call",
      "difference between user mode and kernel mode",
      "what is an interrupt",
      "what is a monolithic kernel",
    ],
    answer:
      "The kernel is the OS core with full access to hardware: process, memory, file and device management. User programs run in user mode and request kernel services through system calls, which switch to kernel mode.\nAn interrupt is a signal that makes the CPU pause its work and run a handler for an event (I/O completion, timer). Monolithic kernels run all services in kernel space; microkernels keep only essentials there.",
  },
  {
    id: "cn-misc",
    topic: "CS · Computer Networks",
    title: "DHCP, NAT, firewall and ping",
    questions: [
      "what is dhcp",
      "what is nat in networking",
      "what is a firewall",
      "how does ping work",
      "what is a proxy server",
    ],
    answer:
      "• DHCP automatically assigns IP addresses to devices on a network.\n• NAT lets many private-IP devices share one public IP by translating addresses at the router.\n• A firewall filters traffic by rules to block unwanted connections.\n• ping sends ICMP echo requests to test reachability and round-trip time.\n• A proxy server relays requests between client and server for caching, filtering or anonymity.",
  },
];
