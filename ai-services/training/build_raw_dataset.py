"""
Builds the raw, hand-curated interview-question dataset used to train the
local question-generation model.

This is the single source of truth for training content: every question below
was written by hand (not templated/duplicated) so the dataset stays small and
high-quality rather than being padded with near-identical filler. To add new
training data, extend RAW_QUESTIONS below (see docs/MODEL_TRAINING.md) and
re-run this script, then re-run prepare_dataset.py.

Usage:
    python training/build_raw_dataset.py
Writes:
    training/data/interview_questions/raw_dataset.json
"""

import json
import os

# skill -> topic -> difficulty -> [questions]
RAW_QUESTIONS = {
    "Python": {
        "Functions": {
            "Easy": [
                "What is the difference between a parameter and an argument in a Python function?",
                "How do you define a function with default parameter values in Python?",
                "What does the return statement do in a Python function?",
            ],
            "Medium": [
                "Explain the difference between a normal function and a lambda function in Python.",
                "What are *args and **kwargs used for in Python function definitions?",
                "Explain the difference between positional arguments and keyword arguments.",
            ],
            "Hard": [
                "Explain how Python closures work and give an example use case.",
                "What is a decorator in Python, and how would you write one that logs a function's execution time?",
                "Explain the pitfall of using a mutable default argument in a Python function.",
            ],
        },
        "OOP": {
            "Easy": [
                "What is a class and an object in Python?",
                "How do you create a constructor in a Python class?",
                "What is the purpose of the self keyword in Python classes?",
            ],
            "Medium": [
                "Explain the difference between instance variables and class variables in Python.",
                "What is method overriding in Python, and how is it implemented?",
                "Explain the concept of encapsulation in Python and how it is enforced by convention.",
            ],
            "Hard": [
                "Explain Python's Method Resolution Order (MRO) and how it applies to multiple inheritance.",
                "What are metaclasses in Python and when would you use one?",
                "Explain the difference between __new__ and __init__ in Python.",
            ],
        },
        "Data Structures": {
            "Easy": [
                "What is the difference between a list and a tuple in Python?",
                "How do you remove duplicate elements from a Python list?",
                "What is a dictionary in Python and how do you access its values?",
            ],
            "Medium": [
                "Explain the time complexity of common operations on a Python list versus a dictionary.",
                "What is a set in Python, and when would you use it over a list?",
                "How does Python implement dictionaries internally to achieve fast lookups?",
            ],
            "Hard": [
                "Explain how Python's list implementation handles dynamic resizing internally.",
                "What is the difference between deepcopy and copy when working with nested data structures in Python?",
                "How would you implement an LRU cache using Python's built-in data structures?",
            ],
        },
        "Exception Handling": {
            "Easy": [
                "What is the purpose of a try-except block in Python?",
                "How do you raise a custom exception in Python?",
                "What does the finally block do in Python exception handling?",
            ],
            "Medium": [
                "Explain the difference between catching a specific exception versus a bare except clause.",
                "How do you create a custom exception class in Python?",
                "What is the difference between except Exception as e and a bare except?",
            ],
            "Hard": [
                "Explain how exception chaining works in Python using raise ... from ...",
                "How would you design a robust error-handling strategy for a Python app calling multiple external services?",
                "Explain the difference between exceptions and errors in Python's exception hierarchy.",
            ],
        },
        "Decorators and Generators": {
            "Easy": [
                "What is a generator in Python?",
                "What keyword is used to create a generator function in Python?",
                "What is the benefit of using a generator instead of returning a list?",
            ],
            "Medium": [
                "Explain how the yield keyword changes the behavior of a function in Python.",
                "What is a decorator in Python and how do you apply one to a function?",
                "Explain the difference between an iterator and a generator in Python.",
            ],
            "Hard": [
                "How would you write a decorator that accepts arguments in Python?",
                "Explain how generator expressions differ from list comprehensions in terms of memory usage.",
                "How would you implement a context manager using a generator and the contextmanager decorator?",
            ],
        },
    },
    "Java": {
        "OOP": {
            "Easy": [
                "What is the difference between a class and an object in Java?",
                "What is a constructor in Java?",
                "What is the this keyword used for in Java?",
            ],
            "Medium": [
                "Explain the difference between method overloading and method overriding in Java.",
                "What is the difference between an abstract class and an interface in Java?",
                "Explain encapsulation in Java with an example.",
            ],
            "Hard": [
                "Explain how Java's garbage collector interacts with object references, and what causes a memory leak despite garbage collection.",
                "What is the difference between composition and inheritance in Java, and why might you prefer composition?",
                "Explain how Java achieves runtime polymorphism internally using the virtual method table concept.",
            ],
        },
        "Collections": {
            "Easy": [
                "What is the difference between an ArrayList and an array in Java?",
                "What is the Java Collections Framework?",
                "How do you iterate over a HashMap in Java?",
            ],
            "Medium": [
                "Explain the difference between HashMap, LinkedHashMap, and TreeMap in Java.",
                "What is the difference between ArrayList and LinkedList in terms of performance?",
                "Explain the difference between Comparable and Comparator in Java.",
            ],
            "Hard": [
                "Explain how HashMap resolves hash collisions internally in Java.",
                "What is the difference between fail-fast and fail-safe iterators in Java collections?",
                "Explain how ConcurrentHashMap achieves thread safety without locking the entire map.",
            ],
        },
        "Exception Handling": {
            "Easy": [
                "What is the difference between checked and unchecked exceptions in Java?",
                "What is the purpose of the finally block in Java?",
                "How do you create a custom exception in Java?",
            ],
            "Medium": [
                "Explain the exception hierarchy in Java starting from Throwable.",
                "What happens if an exception is thrown inside a finally block in Java?",
                "Explain try-with-resources and why it is preferred for handling closeable resources.",
            ],
            "Hard": [
                "Explain the performance implications of using exceptions for control flow in Java.",
                "How would you design a custom exception hierarchy for a multi-module Java application?",
                "Explain the difference between exception chaining and suppressed exceptions in Java.",
            ],
        },
        "Multithreading": {
            "Easy": [
                "What is a thread in Java and how do you create one?",
                "What is the difference between Runnable and Thread in Java?",
                "What does the synchronized keyword do in Java?",
            ],
            "Medium": [
                "Explain the difference between wait() and sleep() in Java.",
                "What is a race condition and how does Java's synchronized keyword help prevent it?",
                "What is the Java Executor framework used for?",
            ],
            "Hard": [
                "Explain the differences between synchronized blocks, ReentrantLock, and atomic variables in Java concurrency.",
                "How does the Java Memory Model guarantee visibility of variables across threads?",
                "Explain how deadlocks can occur in Java and strategies to prevent them.",
            ],
        },
        "JVM and Memory Management": {
            "Easy": [
                "What is the JVM and what is its role in running Java programs?",
                "What is the difference between JDK, JRE, and JVM?",
                "What is garbage collection in Java?",
            ],
            "Medium": [
                "Explain the difference between the stack and the heap in Java memory management.",
                "What are the different memory areas within the JVM?",
                "What is the difference between String, StringBuilder, and StringBuffer in Java?",
            ],
            "Hard": [
                "Explain how the Java garbage collector distinguishes between young and old generation objects.",
                "What is a memory leak in Java despite having automatic garbage collection, and how can it occur?",
                "Explain class loading in the JVM and the role of the ClassLoader hierarchy.",
            ],
        },
    },
    "C": {
        "Pointers": {
            "Easy": [
                "What is a pointer in C?",
                "How do you declare a pointer variable in C?",
                "What does the & operator do in C?",
            ],
            "Medium": [
                "Explain the difference between a pointer to a constant and a constant pointer in C.",
                "What is a NULL pointer, and why is it used?",
                "Explain pointer arithmetic with an example.",
            ],
            "Hard": [
                "Explain the difference between a pointer to an array and an array of pointers in C.",
                "What is a dangling pointer, and how can it be avoided?",
                "Explain how function pointers work in C and give a use case.",
            ],
        },
        "Memory Management": {
            "Easy": [
                "What is the difference between malloc and calloc in C?",
                "What does the free() function do in C?",
                "What is a memory leak in C?",
            ],
            "Medium": [
                "Explain the difference between stack memory and heap memory in C.",
                "What is the difference between malloc and realloc in C?",
                "What happens if you forget to free dynamically allocated memory in a long-running C program?",
            ],
            "Hard": [
                "Explain how double free errors occur in C and how to prevent them.",
                "How would you detect memory leaks in a C program?",
                "Explain how memory fragmentation occurs with repeated malloc/free calls.",
            ],
        },
        "Structures and Unions": {
            "Easy": [
                "What is a structure in C?",
                "What is the difference between a structure and a union in C?",
                "How do you access a structure member using a pointer in C?",
            ],
            "Medium": [
                "Explain structure padding and alignment in C.",
                "What is a nested structure in C?",
                "Explain the use of typedef with structures in C.",
            ],
            "Hard": [
                "Explain how you would implement a linked list using structures and pointers in C.",
                "How does the compiler decide the size of a union versus a structure?",
                "Explain how bit-fields work inside a structure in C.",
            ],
        },
        "Arrays and Strings": {
            "Easy": [
                "How is a string represented in C?",
                "What is the difference between an array and a string in C?",
                "How do you find the length of a string in C without using strlen?",
            ],
            "Medium": [
                "Explain the difference between a 2D array and an array of pointers in C.",
                "What is the difference between passing an array by value and by reference in C?",
                "How would you reverse a string in C without using a library function?",
            ],
            "Hard": [
                "Explain how multidimensional arrays are stored in memory in C.",
                "How would you implement your own version of strcpy in C?",
                "Explain the risks of buffer overflow with fixed-size character arrays in C.",
            ],
        },
        "Preprocessor and Compilation": {
            "Easy": [
                "What is the role of the C preprocessor?",
                "What is a macro in C?",
                "What is the difference between #define and const in C?",
            ],
            "Medium": [
                "Explain the difference between a macro and a function in C.",
                "What are header guards and why are they needed in C?",
                "Explain the compilation stages of a C program from source code to executable.",
            ],
            "Hard": [
                "Explain the pitfalls of using macros with side-effect arguments in C, and how parentheses help avoid them.",
                "What is the difference between static linking and dynamic linking in C?",
                "Explain how conditional compilation works using #ifdef and #ifndef.",
            ],
        },
    },
    "C++": {
        "OOP": {
            "Easy": [
                "What is the difference between a class and a struct in C++?",
                "What is a constructor and a destructor in C++?",
                "What is the purpose of the this pointer in C++?",
            ],
            "Medium": [
                "Explain the difference between function overloading and function overriding in C++.",
                "What is a virtual function in C++ and why is it used?",
                "Explain the difference between public, private, and protected inheritance.",
            ],
            "Hard": [
                "Explain how virtual function dispatch works internally using a vtable in C++.",
                "What is the diamond problem in multiple inheritance, and how does C++ resolve it with virtual inheritance?",
                "Explain the Rule of Three/Five in modern C++ and why it matters.",
            ],
        },
        "STL": {
            "Easy": [
                "What is the STL in C++?",
                "What is the difference between a vector and an array in C++?",
                "What is an iterator in C++?",
            ],
            "Medium": [
                "Explain the difference between std::vector and std::list in terms of performance.",
                "What is the difference between std::map and std::unordered_map?",
                "What is the difference between std::set and std::multiset?",
            ],
            "Hard": [
                "Explain how std::unordered_map achieves average O(1) lookup internally.",
                "What is the time complexity of inserting into the middle of a std::vector versus a std::list, and why?",
                "Explain move semantics and how std::move improves STL container performance.",
            ],
        },
        "Memory Management": {
            "Easy": [
                "What is the difference between stack and heap memory allocation in C++?",
                "What does the new and delete operator do in C++?",
                "What is a memory leak in C++?",
            ],
            "Medium": [
                "Explain the difference between a raw pointer and a smart pointer in C++.",
                "What is the difference between std::unique_ptr and std::shared_ptr?",
                "What is RAII in C++ and why is it important?",
            ],
            "Hard": [
                "Explain how std::shared_ptr manages reference counting internally, and what causes a circular reference issue.",
                "How does std::weak_ptr solve the circular reference problem in C++?",
                "Explain how custom deleters work with smart pointers in C++.",
            ],
        },
        "Templates": {
            "Easy": [
                "What is a template in C++?",
                "What is the difference between a function template and a class template?",
                "Why are templates used in C++?",
            ],
            "Medium": [
                "Explain template specialization in C++ with an example.",
                "What is the difference between templates and generics conceptually?",
                "Explain how the compiler handles template instantiation in C++.",
            ],
            "Hard": [
                "Explain SFINAE in C++ templates and a practical use case.",
                "What are variadic templates in C++ and when would you use them?",
                "Explain the difference between compile-time polymorphism using templates and runtime polymorphism using virtual functions.",
            ],
        },
        "Operator Overloading": {
            "Easy": [
                "What is operator overloading in C++?",
                "Can you overload the + operator for a custom class in C++? How?",
                "What is the difference between overloading == and < for a class?",
            ],
            "Medium": [
                "Explain the difference between overloading an operator as a member function versus a friend function.",
                "Why can't you overload certain operators like :: or . in C++?",
                "Explain how overloading the assignment operator helps prevent shallow copy issues.",
            ],
            "Hard": [
                "Explain how overloading the << and >> operators works for custom stream I/O in C++.",
                "What are the pitfalls of overloading the && and || operators regarding short-circuit evaluation?",
                "Explain how move assignment operator overloading improves performance for classes managing dynamic resources.",
            ],
        },
    },
    "JavaScript": {
        "Closures and Scope": {
            "Easy": [
                "What is a closure in JavaScript?",
                "What is the difference between var, let, and const?",
                "What is variable hoisting in JavaScript?",
            ],
            "Medium": [
                "Explain how closures are used to create private variables in JavaScript.",
                "What is the difference between function scope and block scope in JavaScript?",
                "Explain the concept of the temporal dead zone in JavaScript.",
            ],
            "Hard": [
                "Explain how closures can lead to memory leaks in JavaScript if not handled carefully.",
                "How would you use closures to implement a memoization function in JavaScript?",
                "Explain lexical scoping and how it affects closures created inside loops.",
            ],
        },
        "Asynchronous JavaScript": {
            "Easy": [
                "What is a callback function in JavaScript?",
                "What is a Promise in JavaScript?",
                "What does the async keyword do in JavaScript?",
            ],
            "Medium": [
                "Explain the difference between Promise.all and Promise.race.",
                "What is callback hell, and how do Promises help solve it?",
                "Explain how async/await works under the hood with Promises.",
            ],
            "Hard": [
                "Explain the JavaScript event loop and how the call stack, microtask queue, and macrotask queue interact.",
                "What is the difference between Promise.allSettled and Promise.all in error handling scenarios?",
                "How would you implement a simple debounce function using closures and timers in JavaScript?",
            ],
        },
        "Prototypes and OOP": {
            "Easy": [
                "What is a prototype in JavaScript?",
                "How do you create an object in JavaScript?",
                "What is the difference between == and === in JavaScript?",
            ],
            "Medium": [
                "Explain prototypal inheritance in JavaScript.",
                "What is the difference between a class and a constructor function in JavaScript?",
                "What does the Object.create() method do in JavaScript?",
            ],
            "Hard": [
                "Explain the prototype chain lookup process when accessing a property on a JavaScript object.",
                "How does JavaScript's class syntax translate to the underlying prototype-based model?",
                "Explain the difference between Object.freeze() and Object.seal() in JavaScript.",
            ],
        },
        "DOM and Events": {
            "Easy": [
                "What is the DOM in JavaScript?",
                "How do you select an element from the DOM using JavaScript?",
                "What is an event listener in JavaScript?",
            ],
            "Medium": [
                "Explain event bubbling and event capturing in the DOM.",
                "What is event delegation and why is it useful?",
                "What is the difference between preventDefault() and stopPropagation()?",
            ],
            "Hard": [
                "Explain how the browser's rendering pipeline is affected by frequent DOM manipulations.",
                "How would you optimize a page that adds thousands of event listeners to individual DOM elements?",
                "Explain the difference between synthetic events, as in React, and native DOM events.",
            ],
        },
        "ES6+ Features": {
            "Easy": [
                "What are template literals in JavaScript?",
                "What is destructuring in JavaScript?",
                "What is the spread operator used for in JavaScript?",
            ],
            "Medium": [
                "Explain the difference between the spread operator and the rest parameter in JavaScript.",
                "What are arrow functions, and how do they handle this differently from regular functions?",
                "What is a JavaScript module, and what is the difference between default and named exports?",
            ],
            "Hard": [
                "Explain how arrow functions' lexical this binding can cause bugs when used as object methods.",
                "What are generators and iterators in ES6, and how do they relate to the for...of loop?",
                "Explain optional chaining and nullish coalescing, and how they differ from traditional falsy checks.",
            ],
        },
    },
    "SQL": {
        "Joins": {
            "Easy": [
                "What is a JOIN in SQL?",
                "What is the difference between INNER JOIN and OUTER JOIN?",
                "What does a CROSS JOIN do in SQL?",
            ],
            "Medium": [
                "Explain the difference between LEFT JOIN and RIGHT JOIN with an example.",
                "What is a self-join, and when would you use one?",
                "How would you write a query to find rows that exist in one table but not another using joins?",
            ],
            "Hard": [
                "Explain how the query optimizer decides between a nested loop join, hash join, and merge join.",
                "How would you optimize a query with multiple joins across large tables?",
                "Explain the difference between a natural join and joining explicitly on a condition, and why natural joins are risky.",
            ],
        },
        "Aggregation and Grouping": {
            "Easy": [
                "What does the GROUP BY clause do in SQL?",
                "What is the difference between COUNT(*) and COUNT(column_name)?",
                "What are aggregate functions in SQL? Name a few.",
            ],
            "Medium": [
                "Explain the difference between WHERE and HAVING clauses in SQL.",
                "How would you find the second-highest salary from an employee table using SQL?",
                "Explain how GROUP BY interacts with NULL values in SQL.",
            ],
            "Hard": [
                "Explain the difference between window functions and GROUP BY aggregation in SQL.",
                "How would you compute a running total using SQL window functions?",
                "Explain how RANK(), DENSE_RANK(), and ROW_NUMBER() differ in SQL.",
            ],
        },
        "Subqueries": {
            "Easy": [
                "What is a subquery in SQL?",
                "What is the difference between a subquery and a JOIN?",
                "Can a subquery return multiple rows in SQL? Give an example clause where it's used.",
            ],
            "Medium": [
                "Explain the difference between a correlated and a non-correlated subquery.",
                "What is the difference between EXISTS and IN when used with subqueries?",
                "How would you use a subquery to find employees earning more than the average salary?",
            ],
            "Hard": [
                "Explain the performance implications of correlated subqueries on large datasets.",
                "How would you rewrite a correlated subquery as a JOIN to improve performance?",
                "Explain how Common Table Expressions can replace complex nested subqueries for readability.",
            ],
        },
        "Indexing and Performance": {
            "Easy": [
                "What is an index in a database?",
                "What is a primary key, and does it automatically create an index?",
                "What is the trade-off of adding too many indexes to a table?",
            ],
            "Medium": [
                "Explain the difference between a clustered index and a non-clustered index.",
                "What is a composite index, and when would you use one?",
                "How does an index affect INSERT and UPDATE performance?",
            ],
            "Hard": [
                "Explain how a B-tree index structure enables efficient range queries.",
                "How would you use EXPLAIN ANALYZE to diagnose a slow SQL query?",
                "Explain covering indexes and how they can eliminate the need for a table lookup.",
            ],
        },
        "Transactions": {
            "Easy": [
                "What is a transaction in SQL?",
                "What does COMMIT and ROLLBACK do in SQL?",
                "What are the ACID properties of a transaction?",
            ],
            "Medium": [
                "Explain the difference between transaction isolation levels Read Committed and Repeatable Read.",
                "What is a dirty read, and which isolation level prevents it?",
                "What is a deadlock in the context of database transactions?",
            ],
            "Hard": [
                "Explain how two-phase locking ensures serializability in database transactions.",
                "What is the difference between optimistic and pessimistic concurrency control?",
                "Explain how MVCC allows readers and writers to avoid blocking each other.",
            ],
        },
    },
    "DBMS": {
        "Normalization": {
            "Easy": [
                "What is normalization in a database?",
                "What is the difference between 1NF and 2NF?",
                "Why do we normalize database tables?",
            ],
            "Medium": [
                "Explain the difference between 2NF and 3NF with an example.",
                "What is a partial dependency, and which normal form removes it?",
                "What is denormalization, and when might you use it?",
            ],
            "Hard": [
                "Explain Boyce-Codd Normal Form and how it differs from 3NF.",
                "What are the trade-offs between normalization and query performance in a high-read system?",
                "Explain multivalued dependency and its role in 4NF.",
            ],
        },
        "ER Modeling": {
            "Easy": [
                "What is an Entity-Relationship diagram?",
                "What is the difference between an entity and an attribute?",
                "What is a relationship in an ER diagram?",
            ],
            "Medium": [
                "Explain the difference between one-to-many and many-to-many relationships in ER modeling.",
                "What is a weak entity, and how is it represented in an ER diagram?",
                "How do you resolve a many-to-many relationship when converting an ER diagram to relational tables?",
            ],
            "Hard": [
                "Explain the difference between generalization and specialization in ER modeling.",
                "How would you model a recursive relationship, such as an employee managing another employee, in an ER diagram?",
                "Explain how aggregation is used in ER modeling to represent a relationship between relationships.",
            ],
        },
        "Transactions and Concurrency": {
            "Easy": [
                "What is concurrency control in a database?",
                "What problem does locking solve in a database?",
                "What is a shared lock versus an exclusive lock?",
            ],
            "Medium": [
                "Explain the lost update problem in database concurrency.",
                "What is the difference between lock-based and timestamp-based concurrency control?",
                "Explain the phantom read problem and which isolation level prevents it.",
            ],
            "Hard": [
                "Explain how a database detects and resolves deadlocks between transactions.",
                "What is the difference between strict two-phase locking and basic two-phase locking?",
                "Explain how distributed transactions maintain consistency using the two-phase commit protocol.",
            ],
        },
        "Indexing and Storage": {
            "Easy": [
                "What is a database index used for?",
                "What is the difference between a primary index and a secondary index?",
                "What is the difference between a heap file and a sorted file organization?",
            ],
            "Medium": [
                "Explain the difference between a clustered and a non-clustered index at the storage level.",
                "What is a hash index, and when is it preferable to a B-tree index?",
                "Explain how a full table scan differs from an index scan.",
            ],
            "Hard": [
                "Explain how B+ trees are used for database indexing and why they are preferred over binary search trees.",
                "What is the impact of index fragmentation on database performance, and how is it resolved?",
                "Explain how database buffer pools and page caching interact with indexing to improve performance.",
            ],
        },
        "Keys and Constraints": {
            "Easy": [
                "What is a primary key in a database table?",
                "What is a foreign key, and what does it enforce?",
                "What is the difference between a unique key and a primary key?",
            ],
            "Medium": [
                "Explain the difference between a candidate key and a super key.",
                "What is a composite key, and when would you use one?",
                "Explain referential integrity and how foreign key constraints enforce it.",
            ],
            "Hard": [
                "Explain the cascading actions CASCADE, SET NULL, and RESTRICT on foreign key constraints and when to use each.",
                "How would you design keys for a table with no natural unique attribute?",
                "Explain the trade-offs of using a surrogate key versus a natural key as a primary key.",
            ],
        },
    },
    "OOP": {
        "Encapsulation and Abstraction": {
            "Easy": [
                "What is encapsulation in object-oriented programming?",
                "What is abstraction in OOP, and how does it differ from encapsulation?",
                "Why do we use access modifiers like private and public in OOP?",
            ],
            "Medium": [
                "Explain how encapsulation improves maintainability of a codebase.",
                "What is the difference between abstraction achieved through interfaces versus abstract classes?",
                "Give an example of how abstraction hides implementation complexity from the user of a class.",
            ],
            "Hard": [
                "Explain how encapsulation and abstraction work together to support the open-closed principle.",
                "What are the risks of breaking encapsulation, for example by exposing mutable internal collections?",
                "How would you refactor a class with public fields and scattered logic to properly encapsulate its state?",
            ],
        },
        "Inheritance and Polymorphism": {
            "Easy": [
                "What is inheritance in OOP?",
                "What is polymorphism in OOP?",
                "What is the difference between a parent class and a child class?",
            ],
            "Medium": [
                "Explain the difference between compile-time and runtime polymorphism.",
                "What is the difference between 'is-a' and 'has-a' relationships in OOP design?",
                "Explain method overriding and how it enables polymorphism.",
            ],
            "Hard": [
                "Explain why favoring composition over inheritance often leads to more flexible designs.",
                "What is the Liskov Substitution Principle, and how does violating it break polymorphism?",
                "Explain how multiple inheritance can cause the diamond problem, and how different languages address it.",
            ],
        },
        "SOLID and Design Principles": {
            "Easy": [
                "What does the S in SOLID stand for, and what does it mean?",
                "What is the Single Responsibility Principle?",
                "Why are design principles like SOLID important in software development?",
            ],
            "Medium": [
                "Explain the Open-Closed Principle with an example.",
                "What is the Dependency Inversion Principle, and how does it reduce coupling?",
                "Explain the Interface Segregation Principle and why large interfaces are discouraged.",
            ],
            "Hard": [
                "How would you refactor a class that violates the Single Responsibility Principle by handling both business logic and logging?",
                "Explain how the Dependency Inversion Principle enables easier unit testing through mocking.",
                "Give an example of a design that violates the Liskov Substitution Principle and explain how to fix it.",
            ],
        },
        "Interfaces vs Abstract Classes": {
            "Easy": [
                "What is an interface in object-oriented programming?",
                "What is an abstract class?",
                "Can you create an instance of an abstract class directly?",
            ],
            "Medium": [
                "Explain the key differences between an interface and an abstract class.",
                "When would you choose an interface over an abstract class in a design?",
                "Can an abstract class have both implemented and unimplemented methods? Explain.",
            ],
            "Hard": [
                "Explain how default methods in interfaces blur the line between interfaces and abstract classes.",
                "How would you design a plugin system using interfaces to allow multiple independent implementations?",
                "Explain the diamond problem in the context of multiple interface inheritance and how it's resolved.",
            ],
        },
        "Design Patterns Basics": {
            "Easy": [
                "What is a design pattern in software engineering?",
                "What is the Singleton design pattern used for?",
                "What is the Factory design pattern used for?",
            ],
            "Medium": [
                "Explain the difference between the Factory pattern and the Abstract Factory pattern.",
                "What problem does the Observer design pattern solve?",
                "Explain the Strategy design pattern with a real-world example.",
            ],
            "Hard": [
                "Explain the drawbacks of the Singleton pattern, particularly in multithreaded or testable systems.",
                "How would you use the Decorator pattern to add behavior to an object without modifying its class?",
                "Explain the difference between the Adapter and Facade design patterns.",
            ],
        },
    },
    "Data Structures": {
        "Arrays and Linked Lists": {
            "Easy": [
                "What is the difference between an array and a linked list?",
                "What is a singly linked list?",
                "What is the time complexity of accessing an element in an array by index?",
            ],
            "Medium": [
                "Explain the difference between a singly linked list and a doubly linked list.",
                "How would you reverse a singly linked list?",
                "What is the time complexity of inserting an element at the beginning of an array versus a linked list?",
            ],
            "Hard": [
                "How would you detect and remove a cycle in a linked list?",
                "Explain how a circular linked list works and a scenario where it's useful.",
                "How would you merge two sorted linked lists into one sorted linked list?",
            ],
        },
        "Stacks and Queues": {
            "Easy": [
                "What is a stack, and what does LIFO mean?",
                "What is a queue, and what does FIFO mean?",
                "Name a real-world example each of a stack and a queue.",
            ],
            "Medium": [
                "How would you implement a queue using two stacks?",
                "What is a circular queue, and why is it used over a simple queue?",
                "Explain how a stack is used to check for balanced parentheses in an expression.",
            ],
            "Hard": [
                "How would you design a stack that supports retrieving the minimum element in O(1) time?",
                "Explain how a priority queue differs from a regular queue and how it's typically implemented.",
                "How would you implement an LRU cache using a combination of a queue and a hash map?",
            ],
        },
        "Trees": {
            "Easy": [
                "What is a tree data structure?",
                "What is a binary tree?",
                "What is the difference between a binary tree and a binary search tree?",
            ],
            "Medium": [
                "Explain in-order, pre-order, and post-order tree traversal.",
                "What is the difference between a balanced and an unbalanced binary search tree?",
                "What is the height of a binary tree, and how do you calculate it?",
            ],
            "Hard": [
                "Explain how an AVL tree maintains balance after insertions and deletions.",
                "How would you find the lowest common ancestor of two nodes in a binary tree?",
                "Explain how a B-tree differs from a binary search tree and why it's used in databases.",
            ],
        },
        "Hashing": {
            "Easy": [
                "What is a hash table?",
                "What is a hash function?",
                "What is a hash collision?",
            ],
            "Medium": [
                "Explain the difference between chaining and open addressing for handling hash collisions.",
                "What is the average time complexity of insert, delete, and search in a hash table?",
                "What makes a good hash function?",
            ],
            "Hard": [
                "Explain how load factor affects hash table performance and when rehashing occurs.",
                "How would you design a hash map that also supports O(1) retrieval of a random key?",
                "Explain how consistent hashing works and why it's used in distributed systems.",
            ],
        },
        "Graphs": {
            "Easy": [
                "What is a graph data structure?",
                "What is the difference between a directed and an undirected graph?",
                "What is the difference between representing a graph using an adjacency matrix versus an adjacency list?",
            ],
            "Medium": [
                "Explain the difference between BFS and DFS traversal of a graph.",
                "What is a weighted graph, and when would you use one?",
                "How would you detect a cycle in a directed graph?",
            ],
            "Hard": [
                "Explain how Dijkstra's algorithm finds the shortest path in a weighted graph.",
                "What is topological sorting, and in what scenarios is it used?",
                "Explain the difference between Prim's and Kruskal's algorithms for finding a minimum spanning tree.",
            ],
        },
    },
    "Algorithms": {
        "Sorting": {
            "Easy": [
                "What is the difference between bubble sort and selection sort?",
                "What is the time complexity of bubble sort in the worst case?",
                "What does it mean for a sorting algorithm to be stable?",
            ],
            "Medium": [
                "Explain how merge sort works and its time complexity.",
                "Explain how quicksort works and why its worst-case time complexity is O(n^2).",
                "What is the difference between merge sort and quicksort in terms of space complexity?",
            ],
            "Hard": [
                "How would you choose a pivot in quicksort to avoid worst-case behavior on already sorted data?",
                "Explain how counting sort achieves linear time complexity and its limitations.",
                "Explain how you would sort a very large dataset that doesn't fit into memory.",
            ],
        },
        "Searching": {
            "Easy": [
                "What is linear search, and what is its time complexity?",
                "What is binary search, and what precondition does it require?",
                "What is the time complexity of binary search?",
            ],
            "Medium": [
                "How would you find the first and last occurrence of a target value in a sorted array using binary search?",
                "Explain how binary search can be applied to a rotated sorted array.",
                "What is the difference between binary search on an array versus a binary search tree?",
            ],
            "Hard": [
                "How would you search for an element in a 2D matrix that is sorted row-wise and column-wise?",
                "Explain how exponential search works and when it's useful.",
                "How would you find the k-th smallest element in an unsorted array efficiently?",
            ],
        },
        "Recursion and Backtracking": {
            "Easy": [
                "What is recursion, and what is a base case?",
                "What is the difference between recursion and iteration?",
                "What can happen if a recursive function has no base case?",
            ],
            "Medium": [
                "Explain how recursion is used to solve the factorial and Fibonacci problems, and their time complexities.",
                "What is tail recursion, and how does it differ from regular recursion?",
                "Explain how the call stack is used during recursive function execution.",
            ],
            "Hard": [
                "Explain how backtracking is used to solve the N-Queens problem.",
                "How would you generate all permutations of a string using backtracking?",
                "Explain how memoization can optimize a naive recursive solution and give an example.",
            ],
        },
        "Dynamic Programming": {
            "Easy": [
                "What is dynamic programming?",
                "What is the difference between overlapping subproblems and optimal substructure?",
                "What is memoization?",
            ],
            "Medium": [
                "Explain the difference between top-down and bottom-up dynamic programming approaches.",
                "How would you solve the 0/1 knapsack problem using dynamic programming?",
                "Explain how dynamic programming solves the longest common subsequence problem.",
            ],
            "Hard": [
                "How would you optimize a dynamic programming solution from O(n^2) space to O(n) space?",
                "Explain how dynamic programming is used to solve the edit distance problem.",
                "How would you solve the coin change problem to find the minimum number of coins, using dynamic programming?",
            ],
        },
        "Greedy Algorithms": {
            "Easy": [
                "What is a greedy algorithm?",
                "How does a greedy algorithm differ from dynamic programming?",
                "Give an example of a problem that can be solved using a greedy approach.",
            ],
            "Medium": [
                "Explain how the greedy approach solves the activity selection problem.",
                "Why does a greedy approach fail for the 0/1 knapsack problem but work for the fractional knapsack problem?",
                "Explain how Huffman coding uses a greedy algorithm for data compression.",
            ],
            "Hard": [
                "Explain why Dijkstra's algorithm is considered a greedy algorithm and under what condition it fails.",
                "How would you prove that a greedy algorithm produces an optimal solution for a given problem?",
                "Explain how the greedy approach is used in Kruskal's algorithm and why it always produces a minimum spanning tree.",
            ],
        },
    },
    "Computer Networks": {
        "OSI and TCP/IP Model": {
            "Easy": [
                "What is the OSI model, and how many layers does it have?",
                "What is the TCP/IP model, and how does it differ from the OSI model?",
                "What layer does IP operate at in the OSI model?",
            ],
            "Medium": [
                "Explain the role of the transport layer in the OSI model.",
                "What is encapsulation in the context of network protocol layers?",
                "Explain the difference between the data link layer and the network layer.",
            ],
            "Hard": [
                "Explain how data flows through each OSI layer when a browser sends an HTTP request.",
                "What is the difference between a router and a switch in terms of the OSI layers they operate on?",
                "Explain how NAT works at the network layer.",
            ],
        },
        "TCP vs UDP": {
            "Easy": [
                "What is the difference between TCP and UDP?",
                "Is TCP connection-oriented or connectionless?",
                "Give an example application that uses UDP and explain why.",
            ],
            "Medium": [
                "Explain the TCP three-way handshake process.",
                "What is the sliding window mechanism in TCP used for?",
                "Why is UDP preferred for real-time applications like video calls over TCP?",
            ],
            "Hard": [
                "Explain how TCP congestion control algorithms like slow start and congestion avoidance work.",
                "What is the TCP four-way termination process, and what is the TIME_WAIT state for?",
                "Explain how TCP ensures reliable delivery despite packet loss and reordering.",
            ],
        },
        "HTTP and HTTPS": {
            "Easy": [
                "What is the difference between HTTP and HTTPS?",
                "What is a status code in HTTP? Give an example of a 4xx and a 5xx code.",
                "What is the difference between GET and POST HTTP methods?",
            ],
            "Medium": [
                "Explain what happens during an HTTPS/TLS handshake at a high level.",
                "What is the difference between HTTP/1.1 and HTTP/2?",
                "What are HTTP cookies, and how are they used to maintain session state?",
            ],
            "Hard": [
                "Explain how HTTPS achieves both encryption and authentication using certificates and public key cryptography.",
                "What is HTTP/2 multiplexing, and how does it solve the head-of-line blocking problem in HTTP/1.1?",
                "Explain how a man-in-the-middle attack is prevented by proper TLS certificate validation.",
            ],
        },
        "DNS and Routing": {
            "Easy": [
                "What is DNS, and what problem does it solve?",
                "What is an IP address?",
                "What is the difference between a public and a private IP address?",
            ],
            "Medium": [
                "Explain the DNS resolution process from typing a domain name to getting an IP address.",
                "What is the difference between a recursive and an iterative DNS query?",
                "What is the purpose of a default gateway in a network?",
            ],
            "Hard": [
                "Explain how DNS caching and TTL values affect how quickly DNS changes propagate.",
                "What is the difference between static and dynamic routing protocols, and give an example of each?",
                "Explain how a CDN uses DNS to route users to the nearest edge server.",
            ],
        },
        "Network Security": {
            "Easy": [
                "What is a firewall, and what does it do?",
                "What is the difference between authentication and authorization in networking?",
                "What is a VPN, and why is it used?",
            ],
            "Medium": [
                "Explain the difference between symmetric and asymmetric encryption.",
                "What is a DDoS attack, and how does it differ from a DoS attack?",
                "What is the purpose of SSL/TLS certificates in network communication?",
            ],
            "Hard": [
                "Explain how public key infrastructure establishes trust between parties on the internet.",
                "What is an SQL injection attack, and how can it be prevented at the network/application boundary?",
                "Explain how a reverse proxy can help mitigate certain types of network attacks.",
            ],
        },
    },
    "Operating Systems": {
        "Process and Threads": {
            "Easy": [
                "What is a process in an operating system?",
                "What is a thread, and how does it differ from a process?",
                "What is the difference between multitasking and multithreading?",
            ],
            "Medium": [
                "Explain the different states a process can be in during its lifecycle.",
                "What is context switching, and why does it have overhead?",
                "What is the difference between a user-level thread and a kernel-level thread?",
            ],
            "Hard": [
                "Explain how inter-process communication mechanisms like pipes, shared memory, and message queues differ.",
                "What is a zombie process, and how does it differ from an orphan process?",
                "Explain how the operating system schedules threads versus processes.",
            ],
        },
        "Scheduling": {
            "Easy": [
                "What is CPU scheduling, and why is it needed?",
                "What is the difference between preemptive and non-preemptive scheduling?",
                "What is the First-Come-First-Served scheduling algorithm?",
            ],
            "Medium": [
                "Explain the Round Robin scheduling algorithm and the effect of time quantum size.",
                "What is the difference between Shortest Job First and Shortest Remaining Time First?",
                "What is priority scheduling, and what problem, starvation, can it cause?",
            ],
            "Hard": [
                "Explain how aging is used to prevent starvation in priority scheduling.",
                "What is a multilevel feedback queue scheduler, and how does it adapt to process behavior?",
                "Explain how real-time scheduling algorithms differ from general-purpose scheduling algorithms.",
            ],
        },
        "Memory Management": {
            "Easy": [
                "What is virtual memory?",
                "What is paging in an operating system?",
                "What is the difference between internal and external fragmentation?",
            ],
            "Medium": [
                "Explain how paging solves the problem of external fragmentation.",
                "What is a page fault, and what happens when one occurs?",
                "Explain the difference between paging and segmentation.",
            ],
            "Hard": [
                "Explain the working set model and how it relates to thrashing.",
                "What is the difference between the FIFO, LRU, and Optimal page replacement algorithms?",
                "Explain how a translation lookaside buffer speeds up virtual-to-physical address translation.",
            ],
        },
        "Deadlocks": {
            "Easy": [
                "What is a deadlock in an operating system?",
                "What are the four necessary conditions for a deadlock to occur?",
                "What is the difference between deadlock prevention and deadlock avoidance?",
            ],
            "Medium": [
                "Explain how the Banker's algorithm is used for deadlock avoidance.",
                "What is a resource allocation graph, and how is it used to detect deadlocks?",
                "Explain the difference between deadlock detection and deadlock recovery.",
            ],
            "Hard": [
                "Explain how breaking the circular wait condition can prevent deadlocks.",
                "Compare the trade-offs between deadlock prevention, avoidance, and detection-and-recovery strategies.",
                "Explain how a distributed system detects deadlocks across multiple nodes.",
            ],
        },
        "File Systems": {
            "Easy": [
                "What is a file system, and what does it manage?",
                "What is the difference between a file and a directory?",
                "What is an inode in a file system?",
            ],
            "Medium": [
                "Explain the difference between contiguous, linked, and indexed file allocation methods.",
                "What is the difference between a hard link and a symbolic link?",
                "Explain how journaling file systems help recover from crashes.",
            ],
            "Hard": [
                "Explain how a file system uses indexed allocation with multi-level index blocks for large files.",
                "What is the difference between FAT, NTFS, and ext4 file systems in terms of design goals?",
                "Explain how file system caching and write-back policies affect data durability after a crash.",
            ],
        },
    },
    "Machine Learning": {
        "Supervised vs Unsupervised": {
            "Easy": [
                "What is the difference between supervised and unsupervised learning?",
                "What is a labeled dataset?",
                "Give an example each of a classification and a regression problem.",
            ],
            "Medium": [
                "Explain the difference between classification and clustering.",
                "What is semi-supervised learning, and when is it useful?",
                "Explain the difference between regression and classification evaluation metrics.",
            ],
            "Hard": [
                "Explain how self-supervised learning differs from traditional supervised learning.",
                "What are the challenges of applying supervised learning when labeled data is scarce?",
                "Explain how transfer learning can help when you have limited labeled data for a new task.",
            ],
        },
        "Overfitting and Regularization": {
            "Easy": [
                "What is overfitting in machine learning?",
                "What is underfitting in machine learning?",
                "What is the purpose of a validation set?",
            ],
            "Medium": [
                "Explain the difference between L1 and L2 regularization.",
                "What is dropout, and how does it help prevent overfitting in neural networks?",
                "Explain the bias-variance tradeoff.",
            ],
            "Hard": [
                "Explain how early stopping acts as a form of regularization during training.",
                "How would you diagnose whether a model is overfitting or underfitting using learning curves?",
                "Explain how cross-validation helps in selecting a model that generalizes well.",
            ],
        },
        "Model Evaluation Metrics": {
            "Easy": [
                "What is accuracy as an evaluation metric?",
                "What is the difference between precision and recall?",
                "What is a confusion matrix?",
            ],
            "Medium": [
                "Explain what the F1 score represents and why it's useful when classes are imbalanced.",
                "What is the ROC curve, and what does the AUC value represent?",
                "Explain the difference between mean squared error and mean absolute error for regression.",
            ],
            "Hard": [
                "Explain why accuracy can be a misleading metric on an imbalanced dataset, and what metrics you would use instead.",
                "How would you choose an evaluation metric for a fraud detection model?",
                "Explain the difference between micro-averaged and macro-averaged F1 scores in multi-class classification.",
            ],
        },
        "Feature Engineering": {
            "Easy": [
                "What is feature engineering in machine learning?",
                "What is feature scaling, and why is it needed?",
                "What is one-hot encoding used for?",
            ],
            "Medium": [
                "Explain the difference between normalization and standardization of features.",
                "What is feature selection, and why is it important?",
                "Explain how you would handle missing values in a dataset before training a model.",
            ],
            "Hard": [
                "Explain how dimensionality reduction techniques like PCA help with the curse of dimensionality.",
                "How would you engineer features from a timestamp column for a machine learning model?",
                "Explain how target leakage can occur during feature engineering and how to prevent it.",
            ],
        },
        "Common Algorithms": {
            "Easy": [
                "What is linear regression used for?",
                "What is a decision tree?",
                "What is k-nearest neighbors used for?",
            ],
            "Medium": [
                "Explain how a decision tree decides where to split, using concepts like Gini impurity or entropy.",
                "What is the difference between bagging and boosting?",
                "Explain how a random forest reduces overfitting compared to a single decision tree.",
            ],
            "Hard": [
                "Explain how gradient boosting builds an ensemble of weak learners sequentially.",
                "What is the kernel trick in support vector machines, and why is it useful?",
                "Explain how the choice of k affects the bias-variance tradeoff in a k-nearest neighbors model.",
            ],
        },
    },
    "Artificial Intelligence": {
        "Search Algorithms": {
            "Easy": [
                "What is a search problem in AI?",
                "What is the difference between uninformed and informed search?",
                "What is breadth-first search used for in AI?",
            ],
            "Medium": [
                "Explain how the A* search algorithm uses heuristics to find an optimal path.",
                "What is the difference between depth-first search and iterative deepening search?",
                "Explain the concept of an admissible heuristic in A* search.",
            ],
            "Hard": [
                "Explain how minimax search works for two-player games like chess or tic-tac-toe.",
                "What is alpha-beta pruning, and how does it improve minimax search efficiency?",
                "Explain how local search algorithms like hill climbing can get stuck in local optima, and how simulated annealing addresses this.",
            ],
        },
        "Knowledge Representation": {
            "Easy": [
                "What is knowledge representation in AI?",
                "What is a rule-based system?",
                "What is a semantic network used for in AI?",
            ],
            "Medium": [
                "Explain the difference between propositional logic and first-order logic.",
                "What is a knowledge graph, and how is it used in AI systems?",
                "Explain what an ontology is in the context of AI knowledge representation.",
            ],
            "Hard": [
                "Explain how forward chaining and backward chaining differ in rule-based inference systems.",
                "What are the limitations of purely symbolic knowledge representation compared to learned representations?",
                "Explain how description logics balance expressiveness and computational tractability in knowledge representation.",
            ],
        },
        "AI vs Machine Learning": {
            "Easy": [
                "What is the difference between AI and machine learning?",
                "What is the difference between machine learning and deep learning?",
                "Give an example of an AI application that does not rely on machine learning.",
            ],
            "Medium": [
                "Explain the difference between narrow AI and general AI.",
                "What role does machine learning play as a subset of artificial intelligence?",
                "Explain the difference between rule-based AI systems and learning-based AI systems.",
            ],
            "Hard": [
                "Explain why achieving Artificial General Intelligence is considered fundamentally harder than narrow AI tasks.",
                "How do symbolic AI and connectionist neural network approaches differ philosophically and practically?",
                "Explain how neuro-symbolic AI attempts to combine the strengths of symbolic reasoning and deep learning.",
            ],
        },
        "Neural Networks Basics": {
            "Easy": [
                "What is a neural network?",
                "What is a perceptron?",
                "What is an activation function used for in a neural network?",
            ],
            "Medium": [
                "Explain the difference between the sigmoid, ReLU, and tanh activation functions.",
                "What is backpropagation, and what is it used for?",
                "Explain the vanishing gradient problem in deep neural networks.",
            ],
            "Hard": [
                "Explain how batch normalization helps stabilize and speed up training of deep neural networks.",
                "What is the difference between a convolutional neural network and a recurrent neural network, and when would you use each?",
                "Explain how the attention mechanism improves upon traditional RNN-based sequence models.",
            ],
        },
        "Ethics and Bias in AI": {
            "Easy": [
                "What is bias in an AI system?",
                "Why is fairness important when deploying AI systems?",
                "What is a black-box model in AI?",
            ],
            "Medium": [
                "Explain how biased training data can lead to a biased AI model.",
                "What is explainable AI, and why is it important?",
                "Explain the difference between individual fairness and group fairness in AI systems.",
            ],
            "Hard": [
                "Explain how techniques like adversarial debiasing attempt to reduce bias in trained models.",
                "What are the trade-offs between model accuracy and interpretability in high-stakes AI applications like healthcare or criminal justice?",
                "Explain how data privacy concerns intersect with training large-scale AI models on user data.",
            ],
        },
    },
    "Web Development": {
        "HTML and CSS Fundamentals": {
            "Easy": [
                "What is the difference between HTML and CSS?",
                "What is the box model in CSS?",
                "What is the difference between a block-level and an inline element in HTML?",
            ],
            "Medium": [
                "Explain the difference between Flexbox and CSS Grid layout.",
                "What is the difference between position relative, absolute, and fixed in CSS?",
                "Explain CSS specificity and how conflicting styles are resolved.",
            ],
            "Hard": [
                "Explain how the browser's critical rendering path works from HTML/CSS parsing to painting the page.",
                "How would you implement a fully responsive layout without using a CSS framework?",
                "Explain how CSS containment and will-change can improve rendering performance.",
            ],
        },
        "REST APIs": {
            "Easy": [
                "What is a REST API?",
                "What is the difference between a GET and a POST request?",
                "What does the term stateless mean in the context of REST APIs?",
            ],
            "Medium": [
                "Explain the difference between PUT and PATCH HTTP methods.",
                "What are the key constraints that make an API RESTful?",
                "Explain how HTTP status codes are used to communicate the outcome of an API request.",
            ],
            "Hard": [
                "Explain how you would design pagination for a REST API returning a large dataset.",
                "What is HATEOAS in REST, and why is it rarely fully implemented in practice?",
                "Explain how you would version a REST API without breaking existing clients.",
            ],
        },
        "Frontend Frameworks": {
            "Easy": [
                "What is a component in React?",
                "What is JSX in React?",
                "What is the difference between props and state in React?",
            ],
            "Medium": [
                "Explain the React component lifecycle or the equivalent hooks in functional components.",
                "What is the virtual DOM, and how does it improve rendering performance?",
                "Explain the difference between controlled and uncontrolled components in React.",
            ],
            "Hard": [
                "Explain how React's reconciliation algorithm decides what to re-render when state changes.",
                "What is the difference between useMemo and useCallback, and when would you use each?",
                "Explain how React Context can lead to unnecessary re-renders, and how you would mitigate it.",
            ],
        },
        "Authentication and Security": {
            "Easy": [
                "What is the difference between authentication and authorization in a web application?",
                "What is a session in web development?",
                "What is HTTPS, and why is it important for a web application?",
            ],
            "Medium": [
                "Explain how JWT-based authentication works in a web application.",
                "What is Cross-Site Scripting, and how can it be prevented?",
                "What is CSRF, and how do CSRF tokens help prevent it?",
            ],
            "Hard": [
                "Explain the security trade-offs of storing JWTs in localStorage versus HttpOnly cookies.",
                "How would you implement secure password storage using hashing and salting?",
                "Explain how OAuth 2.0's authorization code flow works for third-party login.",
            ],
        },
        "Performance and Caching": {
            "Easy": [
                "What is caching in the context of a web application?",
                "What is the purpose of a CDN?",
                "What is lazy loading in web development?",
            ],
            "Medium": [
                "Explain the difference between browser caching and server-side caching.",
                "What is the difference between cache-first and network-first caching strategies?",
                "Explain how HTTP cache headers like Cache-Control and ETag work.",
            ],
            "Hard": [
                "Explain how you would design a caching strategy for an API with frequently changing but read-heavy data.",
                "What is cache invalidation, and why is it considered a hard problem?",
                "Explain how service workers enable offline-first web applications through caching.",
            ],
        },
    },
}


# Second hand-written batch (one new, genuinely distinct question per
# skill/topic/difficulty bucket) - grows the dataset from 675 to 900
# examples so the fine-tuned model sees more per-topic vocabulary and
# generalizes better instead of bleeding vocabulary between topics.
ADDITIONAL_QUESTIONS = {
    "Python": {
        "Functions": {
            "Easy": ["How do you use a lambda function in Python, and when is it useful?"],
            "Medium": ["Explain the difference between mutable and immutable default arguments in Python functions."],
            "Hard": ["How would you implement a simple memoization decorator for a Python function?"],
        },
        "OOP": {
            "Easy": ["What is inheritance in Python and how do you implement it?"],
            "Medium": ["Explain the difference between a classmethod and a staticmethod in Python."],
            "Hard": ["Explain how Python's __slots__ can be used to optimize memory usage in a class."],
        },
        "Data Structures": {
            "Easy": ["How do you check if a key exists in a Python dictionary?"],
            "Medium": ["Explain how Python's list comprehension differs from a generator expression."],
            "Hard": ["How would you implement a custom hashable class to use as a dictionary key in Python?"],
        },
        "Exception Handling": {
            "Easy": ["What is the difference between an error and an exception in Python?"],
            "Medium": ["How do you chain exceptions in Python using the 'raise ... from' syntax?"],
            "Hard": ["Explain how context managers relate to exception handling and how to write one using the 'with' statement."],
        },
        "Decorators and Generators": {
            "Easy": ["What does the @staticmethod decorator do in Python?"],
            "Medium": ["How would you write a decorator that accepts its own arguments in Python?"],
            "Hard": ["Explain the difference between a coroutine and a generator in Python."],
        },
    },
    "Java": {
        "OOP": {
            "Easy": ["What is the purpose of the 'this' keyword in Java?"],
            "Medium": ["Explain the difference between an interface and an abstract class in Java."],
            "Hard": ["Explain how Java achieves runtime polymorphism through dynamic method dispatch."],
        },
        "Collections": {
            "Easy": ["What is the difference between an ArrayList and a LinkedList in Java?"],
            "Medium": ["Explain the difference between HashMap and TreeMap in Java."],
            "Hard": ["How does a ConcurrentHashMap achieve thread safety without locking the entire map?"],
        },
        "Exception Handling": {
            "Easy": ["What is the difference between throw and throws in Java?"],
            "Medium": ["Explain the difference between a checked and an unchecked exception in Java with examples."],
            "Hard": ["How would you design a custom exception hierarchy for a banking application in Java?"],
        },
        "Multithreading": {
            "Easy": ["What is a thread in Java and how do you create one?"],
            "Medium": ["Explain the difference between wait() and sleep() in Java."],
            "Hard": ["Explain how the Java Memory Model ensures visibility of changes across threads."],
        },
        "JVM and Memory Management": {
            "Easy": ["What is the Java Virtual Machine (JVM) and why is Java called platform-independent?"],
            "Medium": ["Explain the difference between the stack and heap memory in the JVM."],
            "Hard": ["Explain how the G1 garbage collector differs from the older CMS collector in the JVM."],
        },
    },
    "C": {
        "Pointers": {
            "Easy": ["What is a pointer in C and how do you declare one?"],
            "Medium": ["Explain the difference between a pointer to a constant and a constant pointer in C."],
            "Hard": ["Explain how function pointers can be used to implement callbacks in C."],
        },
        "Memory Management": {
            "Easy": ["What is the difference between stack and heap memory allocation in C?"],
            "Medium": ["What is a memory leak in C, and how can you detect one?"],
            "Hard": ["Explain how a custom memory pool allocator could improve performance in a C application."],
        },
        "Structures and Unions": {
            "Easy": ["How do you access members of a structure in C?"],
            "Medium": ["Explain how structure padding affects the size of a struct in C."],
            "Hard": ["Explain how you would implement a tagged union in C to safely store multiple data types."],
        },
        "Arrays and Strings": {
            "Easy": ["How are strings represented in C?"],
            "Medium": ["Explain the difference between an array of pointers and a pointer to an array in C."],
            "Hard": ["How would you implement your own version of strcpy(), and what edge cases must you handle?"],
        },
        "Preprocessor and Compilation": {
            "Easy": ["What is the purpose of the #include directive in C?"],
            "Medium": ["Explain the difference between a macro and an inline function in C."],
            "Hard": ["Explain the four stages of C compilation, from preprocessing to linking."],
        },
    },
    "C++": {
        "OOP": {
            "Easy": ["What is a constructor in C++ and when is it called?"],
            "Medium": ["Explain the difference between shallow copy and deep copy in C++."],
            "Hard": ["Explain how virtual destructors prevent memory leaks in C++ class hierarchies."],
        },
        "STL": {
            "Easy": ["What is the difference between a vector and a plain array in C++?"],
            "Medium": ["Explain the difference between std::map and std::unordered_map in C++."],
            "Hard": ["Explain how iterator invalidation can occur when modifying a std::vector in C++."],
        },
        "Memory Management": {
            "Easy": ["What is the difference between the new and delete operators in C++?"],
            "Medium": ["Explain the difference between a unique_ptr and a shared_ptr in C++."],
            "Hard": ["Explain how a circular reference between two shared_ptr objects can cause a memory leak."],
        },
        "Templates": {
            "Easy": ["What is a function template in C++?"],
            "Medium": ["Explain the difference between function templates and class templates in C++."],
            "Hard": ["Explain how template specialization works in C++ with an example."],
        },
        "Operator Overloading": {
            "Easy": ["Why would you overload the + operator for a custom class in C++?"],
            "Medium": ["Explain the difference between overloading an operator as a member versus a friend function."],
            "Hard": ["Explain the pitfalls of overloading the assignment operator without following the rule of three."],
        },
    },
    "JavaScript": {
        "Closures and Scope": {
            "Easy": ["What is variable hoisting in JavaScript?"],
            "Medium": ["Explain how closures can be used to create private variables in JavaScript."],
            "Hard": ["Explain a common pitfall with closures inside a loop in JavaScript and how to fix it."],
        },
        "Asynchronous JavaScript": {
            "Easy": ["What is a callback function in JavaScript?"],
            "Medium": ["Explain the difference between Promise.all and Promise.race in JavaScript."],
            "Hard": ["Explain how the JavaScript event loop handles microtasks versus macrotasks."],
        },
        "Prototypes and OOP": {
            "Easy": ["What is a constructor function in JavaScript?"],
            "Medium": ["Explain how prototypal inheritance differs from classical inheritance."],
            "Hard": ["Explain how the 'class' keyword in JavaScript relates to the underlying prototype chain."],
        },
        "DOM and Events": {
            "Easy": ["How do you select an HTML element using JavaScript?"],
            "Medium": ["Explain the difference between event bubbling and event capturing."],
            "Hard": ["Explain how event delegation improves performance when handling events on many child elements."],
        },
        "ES6+ Features": {
            "Easy": ["What is destructuring assignment in JavaScript?"],
            "Medium": ["Explain the difference between map() and forEach() in JavaScript."],
            "Hard": ["Explain how optional chaining and nullish coalescing simplify handling of undefined values."],
        },
    },
    "SQL": {
        "Joins": {
            "Easy": ["What is the purpose of a JOIN clause in SQL?"],
            "Medium": ["Explain the difference between a self join and a cross join in SQL."],
            "Hard": ["Explain how you would write a query to find rows in one table but not another using joins."],
        },
        "Aggregation and Grouping": {
            "Easy": ["What does the COUNT() function do in SQL?"],
            "Medium": ["Explain the difference between the WHERE and HAVING clauses in SQL."],
            "Hard": ["Explain how window functions differ from GROUP BY aggregation in SQL."],
        },
        "Subqueries": {
            "Easy": ["What is a subquery in SQL?"],
            "Medium": ["Explain the difference between a correlated and a non-correlated subquery."],
            "Hard": ["Explain when you would prefer a subquery over a JOIN for performance reasons."],
        },
        "Indexing and Performance": {
            "Easy": ["What is an index in SQL and why is it used?"],
            "Medium": ["Explain the difference between a clustered and a non-clustered index."],
            "Hard": ["Explain how a composite index's column order affects query performance in SQL."],
        },
        "Transactions": {
            "Easy": ["What is a transaction in SQL?"],
            "Medium": ["Explain the difference between COMMIT and ROLLBACK in SQL."],
            "Hard": ["Explain the difference between the READ COMMITTED and SERIALIZABLE isolation levels."],
        },
    },
    "DBMS": {
        "Normalization": {
            "Easy": ["What is redundancy in a database, and why is it a problem?"],
            "Medium": ["Explain the difference between 2NF and 3NF in database normalization."],
            "Hard": ["Explain a scenario where denormalization would be preferred over full normalization."],
        },
        "ER Modeling": {
            "Easy": ["What is an entity in an ER diagram?"],
            "Medium": ["Explain the difference between a weak entity and a strong entity in ER modeling."],
            "Hard": ["Explain how you would model a many-to-many relationship and translate it to relational tables."],
        },
        "Transactions and Concurrency": {
            "Easy": ["What does the 'C' in ACID stand for, and what does it guarantee?"],
            "Medium": ["Explain the difference between optimistic and pessimistic concurrency control."],
            "Hard": ["Explain how two-phase locking prevents conflicting transactions from causing inconsistency."],
        },
        "Indexing and Storage": {
            "Easy": ["Why can too many indexes slow down write operations in a database?"],
            "Medium": ["Explain how a B-tree index structure supports efficient range queries."],
            "Hard": ["Explain the tradeoffs between a heap-organized table and a clustered index-organized table."],
        },
        "Keys and Constraints": {
            "Easy": ["What is a unique key, and how does it differ from a primary key?"],
            "Medium": ["Explain what a composite key is and when you would use one."],
            "Hard": ["Explain how a self-referencing foreign key can model a hierarchical relationship in a table."],
        },
    },
    "OOP": {
        "Encapsulation and Abstraction": {
            "Easy": ["What is the purpose of access modifiers like private and public in OOP?"],
            "Medium": ["Explain how abstraction differs from encapsulation with a real-world example."],
            "Hard": ["Explain how encapsulation supports the open/closed principle in object-oriented design."],
        },
        "Inheritance and Polymorphism": {
            "Easy": ["What is method overriding in object-oriented programming?"],
            "Medium": ["Explain the difference between compile-time and runtime polymorphism."],
            "Hard": ["Explain why favoring composition over inheritance is often recommended in OOP design."],
        },
        "SOLID and Design Principles": {
            "Easy": ["What does the 'S' in SOLID stand for?"],
            "Medium": ["Explain the Liskov Substitution Principle with an example violation."],
            "Hard": ["Explain how violating the Dependency Inversion Principle can make a codebase harder to test."],
        },
        "Interfaces vs Abstract Classes": {
            "Easy": ["Can an abstract class have a constructor? Explain why or why not."],
            "Medium": ["Explain a scenario where you would choose an interface over an abstract class."],
            "Hard": ["Explain how default methods in interfaces changed the interface-vs-abstract-class tradeoff."],
        },
        "Design Patterns Basics": {
            "Easy": ["What problem does the Singleton design pattern solve?"],
            "Medium": ["Explain the difference between the Factory and Abstract Factory design patterns."],
            "Hard": ["Explain how the Observer design pattern is used to implement an event-driven system."],
        },
    },
    "Data Structures": {
        "Arrays and Linked Lists": {
            "Easy": ["What is the time complexity of accessing an element by index in an array versus a linked list?"],
            "Medium": ["Explain how a doubly linked list differs from a singly linked list."],
            "Hard": ["Explain how you would detect and remove a cycle in a linked list."],
        },
        "Stacks and Queues": {
            "Easy": ["Give a real-world example of when you would use a queue instead of a stack."],
            "Medium": ["Explain how you would implement a queue using two stacks."],
            "Hard": ["Explain how a circular buffer can be used to implement a fixed-size queue efficiently."],
        },
        "Trees": {
            "Easy": ["What is the difference between a binary tree and a binary search tree?"],
            "Medium": ["Explain the difference between in-order, pre-order, and post-order tree traversal."],
            "Hard": ["Explain how a self-balancing tree like an AVL tree maintains O(log n) operations."],
        },
        "Hashing": {
            "Easy": ["What is a hash function, and what makes a good one?"],
            "Medium": ["Explain the difference between separate chaining and open addressing for collision handling."],
            "Hard": ["Explain how a hash table's load factor affects when it should be resized."],
        },
        "Graphs": {
            "Easy": ["What is the difference between a directed and an undirected graph?"],
            "Medium": ["Explain the difference between an adjacency list and an adjacency matrix representation."],
            "Hard": ["Explain how Dijkstra's algorithm finds the shortest path in a weighted graph."],
        },
    },
    "Algorithms": {
        "Sorting": {
            "Easy": ["What is the time complexity of bubble sort in the worst case?"],
            "Medium": ["Explain why quicksort's worst-case time complexity is O(n^2) despite average-case O(n log n)."],
            "Hard": ["Explain how a hybrid sorting algorithm like Timsort combines merge sort and insertion sort."],
        },
        "Searching": {
            "Easy": ["What precondition must be true for binary search to work correctly?"],
            "Medium": ["Explain how you would search for an element in a rotated sorted array."],
            "Hard": ["Explain how exponential search combined with binary search improves performance on unbounded lists."],
        },
        "Recursion and Backtracking": {
            "Easy": ["What is a base case in recursion, and why is it necessary?"],
            "Medium": ["Explain how backtracking differs from plain recursion using the N-Queens problem as an example."],
            "Hard": ["Explain how memoization can be added to a recursive backtracking solution to avoid recomputation."],
        },
        "Dynamic Programming": {
            "Easy": ["What are overlapping subproblems in dynamic programming?"],
            "Medium": ["Explain the difference between top-down and bottom-up dynamic programming approaches."],
            "Hard": ["Explain how you would solve the 0/1 knapsack problem using dynamic programming."],
        },
        "Greedy Algorithms": {
            "Easy": ["What is the greedy choice property in algorithm design?"],
            "Medium": ["Explain why a greedy approach works for coin change with standard currency but fails for arbitrary denominations."],
            "Hard": ["Explain how Huffman coding uses a greedy strategy to build an optimal prefix code."],
        },
    },
    "Computer Networks": {
        "OSI and TCP/IP Model": {
            "Easy": ["How many layers does the OSI model have, and can you name a few?"],
            "Medium": ["Explain which OSI layers correspond to the TCP/IP model's application layer."],
            "Hard": ["Explain how encapsulation works as data moves down the OSI layers during transmission."],
        },
        "TCP vs UDP": {
            "Easy": ["Which protocol, TCP or UDP, guarantees delivery of packets?"],
            "Medium": ["Explain the TCP three-way handshake process."],
            "Hard": ["Explain why UDP is preferred over TCP for real-time video calls despite being unreliable."],
        },
        "HTTP and HTTPS": {
            "Easy": ["What does the 'S' in HTTPS stand for?"],
            "Medium": ["Explain the difference between the HTTP GET and POST methods."],
            "Hard": ["Explain how the TLS handshake establishes a secure connection in HTTPS."],
        },
        "DNS and Routing": {
            "Easy": ["What is the purpose of DNS?"],
            "Medium": ["Explain the difference between a recursive and an iterative DNS query."],
            "Hard": ["Explain how BGP is used for routing between different autonomous systems on the internet."],
        },
        "Network Security": {
            "Easy": ["What is the purpose of a firewall?"],
            "Medium": ["Explain the difference between symmetric and asymmetric encryption."],
            "Hard": ["Explain how a man-in-the-middle attack works and how HTTPS helps prevent it."],
        },
    },
    "Operating Systems": {
        "Process and Threads": {
            "Easy": ["What is the difference between a process and a thread?"],
            "Medium": ["Explain what a context switch is and why it has overhead."],
            "Hard": ["Explain how inter-process communication mechanisms like pipes and shared memory differ."],
        },
        "Scheduling": {
            "Easy": ["What is the goal of a CPU scheduling algorithm?"],
            "Medium": ["Explain the difference between preemptive and non-preemptive scheduling."],
            "Hard": ["Explain how the Completely Fair Scheduler (CFS) in Linux decides which process to run next."],
        },
        "Memory Management": {
            "Easy": ["What is virtual memory, and why is it used?"],
            "Medium": ["Explain the difference between internal and external fragmentation."],
            "Hard": ["Explain how a page replacement algorithm like LRU decides which page to evict."],
        },
        "Deadlocks": {
            "Easy": ["What are the four necessary conditions for a deadlock to occur?"],
            "Medium": ["Explain how the Banker's algorithm helps avoid deadlocks."],
            "Hard": ["Explain the difference between deadlock prevention, avoidance, and detection strategies."],
        },
        "File Systems": {
            "Easy": ["What is an inode in a Unix-like file system?"],
            "Medium": ["Explain the difference between hard links and symbolic links."],
            "Hard": ["Explain how journaling file systems help recover from crashes without corrupting data."],
        },
    },
    "Machine Learning": {
        "Supervised vs Unsupervised": {
            "Easy": ["Give an example of a supervised learning task and an unsupervised learning task."],
            "Medium": ["Explain the difference between classification and regression in supervised learning."],
            "Hard": ["Explain how semi-supervised learning combines labeled and unlabeled data."],
        },
        "Overfitting and Regularization": {
            "Easy": ["What does it mean for a model to overfit the training data?"],
            "Medium": ["Explain how dropout helps prevent overfitting in neural networks."],
            "Hard": ["Explain the bias-variance tradeoff and how it relates to model complexity."],
        },
        "Model Evaluation Metrics": {
            "Easy": ["What is accuracy, and when can it be a misleading metric?"],
            "Medium": ["Explain the difference between precision and recall."],
            "Hard": ["Explain why AUC-ROC is preferred over accuracy for imbalanced classification problems."],
        },
        "Feature Engineering": {
            "Easy": ["What is feature scaling, and why is it important for some algorithms?"],
            "Medium": ["Explain the difference between one-hot encoding and label encoding for categorical variables."],
            "Hard": ["Explain how principal component analysis (PCA) reduces dimensionality while preserving variance."],
        },
        "Common Algorithms": {
            "Easy": ["What does the 'k' represent in the k-nearest neighbors algorithm?"],
            "Medium": ["Explain how a decision tree decides which feature to split on at each node."],
            "Hard": ["Explain how random forests reduce the variance of individual decision trees through bagging."],
        },
    },
    "Artificial Intelligence": {
        "Search Algorithms": {
            "Easy": ["What is the difference between uninformed and informed search algorithms?"],
            "Medium": ["Explain how the A* search algorithm uses a heuristic to find an optimal path."],
            "Hard": ["Explain how minimax search with alpha-beta pruning reduces the search space in game-playing AI."],
        },
        "Knowledge Representation": {
            "Easy": ["What is a fact-based rule in a rule-based expert system?"],
            "Medium": ["Explain the difference between forward chaining and backward chaining in inference systems."],
            "Hard": ["Explain how a semantic network represents relationships between concepts compared to a rule list."],
        },
        "AI vs Machine Learning": {
            "Easy": ["Is all AI machine learning? Explain the relationship between the two fields."],
            "Medium": ["Explain the difference between symbolic AI and statistical machine learning approaches."],
            "Hard": ["Explain how deep learning fits within the broader hierarchy of AI and machine learning."],
        },
        "Neural Networks Basics": {
            "Easy": ["What is an activation function, and why is it needed in a neural network?"],
            "Medium": ["Explain the vanishing gradient problem in deep neural networks."],
            "Hard": ["Explain how backpropagation computes gradients to update weights in a neural network."],
        },
        "Ethics and Bias in AI": {
            "Easy": ["What is bias in an AI system, and where can it come from?"],
            "Medium": ["Explain why a facial recognition model trained mostly on one demographic can perform poorly on others."],
            "Hard": ["Explain the tradeoff between model explainability and predictive accuracy in high-stakes AI decisions."],
        },
    },
    "Web Development": {
        "HTML and CSS Fundamentals": {
            "Easy": ["What is the difference between an HTML block-level element and an inline element?"],
            "Medium": ["Explain the CSS box model and its components."],
            "Hard": ["Explain how CSS specificity determines which style rule applies when multiple rules conflict."],
        },
        "REST APIs": {
            "Easy": ["What does 'stateless' mean in the context of a REST API?"],
            "Medium": ["Explain the difference between the PUT and PATCH HTTP methods in a REST API."],
            "Hard": ["Explain how HATEOAS relates to the maturity levels of a truly RESTful API."],
        },
        "Frontend Frameworks": {
            "Easy": ["What is a component in a modern frontend framework like React?"],
            "Medium": ["Explain the difference between props and state in React."],
            "Hard": ["Explain how React's virtual DOM diffing algorithm minimizes real DOM updates."],
        },
        "Authentication and Security": {
            "Easy": ["What is the difference between authentication and authorization?"],
            "Medium": ["Explain how a JWT (JSON Web Token) is structured and validated."],
            "Hard": ["Explain how CSRF attacks work and how a CSRF token helps prevent them."],
        },
        "Performance and Caching": {
            "Easy": ["What is browser caching, and why does it improve page load speed?"],
            "Medium": ["Explain the difference between client-side and server-side caching."],
            "Hard": ["Explain how a CDN (Content Delivery Network) reduces latency for users across geographic regions."],
        },
    },
}

# Third hand-written batch (again one new, distinct question per
# skill/topic/difficulty bucket) - grows the dataset from 900 to 1125 so every
# bucket has 5 questions and the mock interview repeats less often.
THIRD_BATCH_QUESTIONS = {
    "Python": {
        "Functions": {
            "Easy": ["What is a docstring in a Python function, and how can you read it at runtime?"],
            "Medium": ["Explain the LEGB rule Python uses to resolve variable names inside a function."],
            "Hard": ["Explain what functools.partial does and describe a situation where it is cleaner than writing a lambda."],
        },
        "OOP": {
            "Easy": ["How do you check whether an object is an instance of a class in Python, and why is isinstance preferred over comparing type()?"],
            "Medium": ["Explain the difference between __str__ and __repr__ and when each one is used."],
            "Hard": ["How does the @dataclass decorator reduce boilerplate in a Python class?"],
        },
        "Data Structures": {
            "Easy": ["How do you merge two dictionaries in Python 3.9 and later?"],
            "Medium": ["Why must dictionary keys in Python be hashable, and why can a list not be used as a key?"],
            "Hard": ["When would you use collections.deque instead of a list, and what are the time complexities involved?"],
        },
        "Exception Handling": {
            "Easy": ["How do you catch multiple exception types in a single except clause in Python?"],
            "Medium": ["When does the else block of a try statement run, and why is it useful?"],
            "Hard": ["How can a context manager written with contextlib.contextmanager suppress or handle an exception raised inside the with block?"],
        },
        "Decorators and Generators": {
            "Easy": ["How do you get the next value from a generator manually, and what happens when it is exhausted?"],
            "Medium": ["Why should a decorator use functools.wraps, and what goes wrong without it?"],
            "Hard": ["Explain how 'yield from' works and how it simplifies delegating to a sub-generator."],
        },
    },
    "Java": {
        "OOP": {
            "Easy": ["What is a static block in Java, and when does it run?"],
            "Medium": ["Explain the role of the final keyword when applied to a variable, a method, and a class in Java."],
            "Hard": ["Why must you override hashCode whenever you override equals in Java, and what breaks if you don't?"],
        },
        "Collections": {
            "Easy": ["What is the difference between a List and a Set in the Java Collections Framework?"],
            "Medium": ["How does a Java TreeMap keep its keys sorted, and what must the key type provide?"],
            "Hard": ["Why does modifying a key object after inserting it into a HashMap cause lookups to fail?"],
        },
        "Exception Handling": {
            "Easy": ["Why is it considered bad practice to catch a generic Exception or Throwable in Java?"],
            "Medium": ["Explain try-with-resources in Java and what interface a resource must implement to use it."],
            "Hard": ["If both the try block and the finally block contain return statements in Java, which value is returned and why is this discouraged?"],
        },
        "Multithreading": {
            "Easy": ["What is the difference between calling start() and calling run() on a Java Thread?"],
            "Medium": ["Why would you submit a Callable to an ExecutorService instead of a Runnable?"],
            "Hard": ["What problem does the volatile keyword solve in Java, and why is it not enough to make count++ thread-safe?"],
        },
        "JVM and Memory Management": {
            "Easy": ["What does the -Xmx option control when starting the JVM?"],
            "Medium": ["What is the difference between a strong reference and a weak reference in Java?"],
            "Hard": ["What causes an OutOfMemoryError: Metaspace, and how is it different from running out of heap space?"],
        },
    },
    "C": {
        "Pointers": {
            "Easy": ["What is a void pointer in C, and why must it be cast before dereferencing?"],
            "Medium": ["What is a double pointer (pointer to pointer) in C, and when is one needed?"],
            "Hard": ["Why is modifying a string literal through a char pointer undefined behavior in C, while modifying a char array initialized from a literal is fine?"],
        },
        "Memory Management": {
            "Easy": ["What is the difference between static and dynamic memory allocation in C?"],
            "Medium": ["What does realloc do in C, and why is it unsafe to assign its result directly back to the original pointer?"],
            "Hard": ["Explain what a double free is in C and why it can lead to undefined behavior or security vulnerabilities."],
        },
        "Structures and Unions": {
            "Easy": ["How do you pass a structure to a function in C, and why is passing a pointer often preferred?"],
            "Medium": ["Why can sizeof a structure in C be larger than the sum of its members' sizes?"],
            "Hard": ["How would you use a union together with a tag field to represent a value that can be one of several types?"],
        },
        "Arrays and Strings": {
            "Easy": ["How is a string represented in C, and what is the role of the null terminator?"],
            "Medium": ["Explain why an array decays to a pointer when passed to a function in C and what information is lost."],
            "Hard": ["Why is strcpy considered unsafe, and what safer alternatives or practices would you use instead?"],
        },
        "Preprocessor and Compilation": {
            "Easy": ["What is the difference between including a header with angle brackets and with double quotes in C?"],
            "Medium": ["Why should macro parameters be wrapped in parentheses in C? Give an example of what goes wrong otherwise."],
            "Hard": ["What does the #error directive do, and when would you use it in a C header?"],
        },
    },
    "C++": {
        "OOP": {
            "Easy": ["In C++, how does a struct differ from a class in default member access and default inheritance?"],
            "Medium": ["What is a delegating constructor in C++11?"],
            "Hard": ["What is object slicing in C++, and how can you avoid it?"],
        },
        "STL": {
            "Easy": ["What is the difference between push_back and emplace_back on a std::vector?"],
            "Medium": ["How are lambda expressions used with STL algorithms like std::sort, and what does the capture list do?"],
            "Hard": ["What is the erase-remove idiom in C++, and why is it needed?"],
        },
        "Memory Management": {
            "Easy": ["What is the difference between new/delete and malloc/free in C++?"],
            "Medium": ["Why is std::make_shared usually preferred over constructing a std::shared_ptr with new?"],
            "Hard": ["What is a reference cycle with std::shared_ptr, and how does std::weak_ptr solve it?"],
        },
        "Templates": {
            "Easy": ["Is there any difference between typename and class in a C++ template parameter list?"],
            "Medium": ["What is template argument deduction in C++?"],
            "Hard": ["How do C++20 concepts improve template error messages compared to unconstrained templates?"],
        },
        "Operator Overloading": {
            "Easy": ["Which operator do you overload in C++ to make objects callable like functions?"],
            "Medium": ["How do you overload the subscript operator [] for a custom container class, and why provide a const version?"],
            "Hard": ["Explain the copy-and-swap idiom for implementing the copy assignment operator in C++."],
        },
    },
    "JavaScript": {
        "Closures and Scope": {
            "Easy": ["What is lexical scoping in JavaScript?"],
            "Medium": ["What is the temporal dead zone for let and const in JavaScript?"],
            "Hard": ["Explain the classic bug of creating closures inside a for loop with var, and two ways to fix it."],
        },
        "Asynchronous JavaScript": {
            "Easy": ["What does setTimeout do in JavaScript, and does a delay of 0 run the callback immediately?"],
            "Medium": ["How would you run several independent requests in parallel with async/await instead of awaiting them one by one?"],
            "Hard": ["What is an unhandled promise rejection, and how should you handle it globally?"],
        },
        "Prototypes and OOP": {
            "Easy": ["How does the instanceof operator work in JavaScript?"],
            "Medium": ["What is the difference between __proto__ and the prototype property of a function in JavaScript?"],
            "Hard": ["How are ES6 classes related to prototypes under the hood in JavaScript?"],
        },
        "DOM and Events": {
            "Easy": ["What is the difference between addEventListener and assigning an onclick property?"],
            "Medium": ["What is the difference between event.target and event.currentTarget?"],
            "Hard": ["What is event delegation, and why does it perform better for large, dynamic lists?"],
        },
        "ES6+ Features": {
            "Easy": ["What does Object.entries return, and how is it useful with a for...of loop?"],
            "Medium": ["How does an ES6 Map differ from a plain JavaScript object used as a dictionary?"],
            "Hard": ["What are JavaScript generators and iterators, and how does the iteration protocol work?"],
        },
    },
    "SQL": {
        "Joins": {
            "Easy": ["What is the difference between an equi join and a non-equi join?"],
            "Medium": ["What is a FULL OUTER JOIN, and how can you emulate it in a database that does not support it?"],
            "Hard": ["Why can placing a condition in the WHERE clause instead of the ON clause turn a LEFT JOIN into an inner join?"],
        },
        "Aggregation and Grouping": {
            "Easy": ["What does COUNT(DISTINCT column) return, and how does it treat NULL values?"],
            "Medium": ["Why can't you use an aggregate function in a WHERE clause, and what do you use instead?"],
            "Hard": ["How would you find customers whose total order amount is above the average customer total?"],
        },
        "Subqueries": {
            "Easy": ["What is a derived table in SQL, and why must it have an alias?"],
            "Medium": ["Explain the difference between IN and EXISTS, including how NULLs affect NOT IN."],
            "Hard": ["What is a scalar subquery, and what happens if it returns more than one row?"],
        },
        "Indexing and Performance": {
            "Easy": ["What is the purpose of the EXPLAIN command in SQL?"],
            "Medium": ["Why might a query not use an index when the indexed column is wrapped in a function like UPPER(name), and how can you fix it?"],
            "Hard": ["What is a partial (filtered) index, and when is it useful?"],
        },
        "Transactions": {
            "Easy": ["What is autocommit mode in a SQL database?"],
            "Medium": ["What is a SAVEPOINT in SQL and when is it useful?"],
            "Hard": ["What does SELECT ... FOR UPDATE do inside a transaction?"],
        },
    },
    "DBMS": {
        "Normalization": {
            "Easy": ["What is data redundancy, and why does normalization try to reduce it?"],
            "Medium": ["What is a transitive dependency, and how does Third Normal Form eliminate it?"],
            "Hard": ["When might you deliberately denormalize a database schema, and what are the risks?"],
        },
        "ER Modeling": {
            "Easy": ["What is the difference between a simple attribute and a composite attribute in an ER diagram?"],
            "Medium": ["What is cardinality in an ER diagram? Give examples of one-to-one and one-to-many relationships."],
            "Hard": ["What is total versus partial participation in an ER diagram?"],
        },
        "Transactions and Concurrency": {
            "Easy": ["What is a checkpoint in database recovery?"],
            "Medium": ["What is a transaction log, and why does a DBMS keep one?"],
            "Hard": ["Explain timestamp-ordering concurrency control and how it handles conflicting operations."],
        },
        "Indexing and Storage": {
            "Easy": ["What is the difference between a dense index and a sparse index?"],
            "Medium": ["What is a multilevel index, and why is it used?"],
            "Hard": ["Explain how write-ahead logging (WAL) helps a database recover after a crash."],
        },
        "Keys and Constraints": {
            "Easy": ["What is a candidate key in a relational database?"],
            "Medium": ["What is a surrogate key, and how does it differ from a natural key?"],
            "Hard": ["Explain referential actions such as ON DELETE CASCADE and ON DELETE SET NULL, and their risks."],
        },
    },
    "OOP": {
        "Encapsulation and Abstraction": {
            "Easy": ["Why are getters and setters used instead of public fields?"],
            "Medium": ["How does encapsulation make code easier to change without breaking its callers?"],
            "Hard": ["What is the difference between abstraction and information hiding, and how do they work together?"],
        },
        "Inheritance and Polymorphism": {
            "Easy": ["What is upcasting, and why is it useful for polymorphism?"],
            "Medium": ["What is method hiding, and how does it differ from method overriding?"],
            "Hard": ["Explain the fragile base class problem and how favoring composition reduces it."],
        },
        "SOLID and Design Principles": {
            "Easy": ["What does the DRY principle mean, and when can over-applying it cause problems?"],
            "Medium": ["What is the Law of Demeter, and what code smell does it help avoid?"],
            "Hard": ["Why is 'program to an interface, not an implementation' considered good design advice?"],
        },
        "Interfaces vs Abstract Classes": {
            "Easy": ["Can a class implement multiple interfaces, and why is that useful?"],
            "Medium": ["What is a functional interface, and how does it relate to lambda expressions?"],
            "Hard": ["What is a marker interface, and what is it used for?"],
        },
        "Design Patterns Basics": {
            "Easy": ["What is the Facade design pattern, and when would you use it?"],
            "Medium": ["How does the Observer pattern decouple a subject from the objects that react to its changes?"],
            "Hard": ["Compare the Strategy pattern with using inheritance to vary an algorithm's behavior."],
        },
    },
    "Data Structures": {
        "Arrays and Linked Lists": {
            "Easy": ["What is a sparse matrix, and how can it be stored efficiently?"],
            "Medium": ["How would you find the middle element of a singly linked list in one pass?"],
            "Hard": ["How would you reverse a singly linked list in groups of k nodes?"],
        },
        "Stacks and Queues": {
            "Easy": ["How do a browser's back and forward buttons use stacks?"],
            "Medium": ["What is a deque, and how does it help solve the sliding window maximum problem?"],
            "Hard": ["Explain how a monotonic stack solves the next greater element problem in linear time."],
        },
        "Trees": {
            "Easy": ["What is the difference between the height and the depth of a node in a tree?"],
            "Medium": ["What is level-order traversal of a tree, and which data structure does it use?"],
            "Hard": ["How would you check whether a binary tree is height-balanced in O(n) time?"],
        },
        "Hashing": {
            "Easy": ["Why is iteration order not guaranteed in a basic hash table?"],
            "Medium": ["Compare separate chaining and open addressing as collision resolution strategies."],
            "Hard": ["What is a Bloom filter, and why can it give false positives but never false negatives?"],
        },
        "Graphs": {
            "Easy": ["What is the degree of a vertex in a graph?"],
            "Medium": ["What is a union-find (disjoint set) data structure, and how is it used with graphs?"],
            "Hard": ["How does topological sorting work, and how does it detect a cycle in a directed graph?"],
        },
    },
    "Algorithms": {
        "Sorting": {
            "Easy": ["What is an in-place sorting algorithm? Name one that is in-place and one that is not."],
            "Medium": ["What is the difference between comparison-based and non-comparison-based sorting algorithms?"],
            "Hard": ["How does radix sort work, and why must the sort used for each digit be stable?"],
        },
        "Searching": {
            "Easy": ["What is interpolation search, and when is it faster than binary search?"],
            "Medium": ["How would you compute the integer square root of a number using binary search?"],
            "Hard": ["How would you find a peak element in an array in O(log n) time?"],
        },
        "Recursion and Backtracking": {
            "Easy": ["What is the difference between direct and indirect recursion?"],
            "Medium": ["How would you generate all subsets of a set using recursion?"],
            "Hard": ["How would you solve a Sudoku puzzle using backtracking?"],
        },
        "Dynamic Programming": {
            "Easy": ["What is the difference between memoization and tabulation?"],
            "Medium": ["How would you count the number of unique paths in a grid using dynamic programming?"],
            "Hard": ["Explain the dynamic programming solution for the edit distance between two strings."],
        },
        "Greedy Algorithms": {
            "Easy": ["Why do many greedy algorithms sort the input first?"],
            "Medium": ["Explain the activity selection problem and why sorting by finish time works."],
            "Hard": ["Give an example where a greedy algorithm fails to find the optimal answer, such as coin change with certain denominations."],
        },
    },
    "Computer Networks": {
        "OSI and TCP/IP Model": {
            "Easy": ["What is the role of the data link layer in the OSI model?"],
            "Medium": ["Explain encapsulation as data moves down the TCP/IP stack."],
            "Hard": ["Why is the OSI model considered a reference model, while TCP/IP is the model actually implemented?"],
        },
        "TCP vs UDP": {
            "Easy": ["Why does DNS commonly use UDP?"],
            "Medium": ["What is the difference between TCP flow control and congestion control?"],
            "Hard": ["What is Nagle's algorithm, and when might an application disable it?"],
        },
        "HTTP and HTTPS": {
            "Easy": ["What is the purpose of the Host header in an HTTP request?"],
            "Medium": ["How does HTTP/2 multiplexing differ from HTTP/1.1 persistent connections?"],
            "Hard": ["What is HTTP Strict Transport Security (HSTS), and what attack does it prevent?"],
        },
        "DNS and Routing": {
            "Easy": ["What is the difference between an A record and a CNAME record in DNS?"],
            "Medium": ["What is a reverse DNS lookup?"],
            "Hard": ["Compare distance-vector and link-state routing protocols."],
        },
        "Network Security": {
            "Easy": ["What is a port scan, and why do attackers use it?"],
            "Medium": ["What is a digital signature, and how is it verified?"],
            "Hard": ["What is ARP spoofing, and how can it be detected or prevented?"],
        },
    },
    "Operating Systems": {
        "Process and Threads": {
            "Easy": ["What are the typical states a process goes through during its lifetime?"],
            "Medium": ["What is the difference between a mutex and a semaphore?"],
            "Hard": ["Compare user-level threads and kernel-level threads, including their trade-offs."],
        },
        "Scheduling": {
            "Easy": ["What is the difference between turnaround time and waiting time in CPU scheduling?"],
            "Medium": ["What is the difference between the long-term, short-term, and medium-term schedulers?"],
            "Hard": ["Explain the convoy effect in FCFS scheduling and how preemptive algorithms reduce it."],
        },
        "Memory Management": {
            "Easy": ["What is the difference between a logical address and a physical address?"],
            "Medium": ["What is a TLB, and how does it speed up address translation?"],
            "Hard": ["Explain Belady's anomaly and which page replacement algorithms are immune to it."],
        },
        "Deadlocks": {
            "Easy": ["What is starvation, and how is it different from deadlock?"],
            "Medium": ["Explain how the Banker's algorithm decides whether a state is safe."],
            "Hard": ["Why do most general-purpose operating systems simply ignore deadlocks (the ostrich algorithm)?"],
        },
        "File Systems": {
            "Easy": ["What is a mount point in a file system?"],
            "Medium": ["What is a file descriptor in Unix?"],
            "Hard": ["What is a copy-on-write file system, and what benefits does it provide?"],
        },
    },
    "Machine Learning": {
        "Supervised vs Unsupervised": {
            "Easy": ["What is a label in supervised learning, and why does unsupervised learning not need one?"],
            "Medium": ["What is reinforcement learning, and how does it differ from supervised learning?"],
            "Hard": ["How would you evaluate the result of a clustering algorithm when there are no ground-truth labels?"],
        },
        "Overfitting and Regularization": {
            "Easy": ["How can you tell from training and validation scores that a model is overfitting?"],
            "Medium": ["Compare L1 and L2 regularization and their effect on model weights."],
            "Hard": ["How does increasing the amount of training data affect overfitting?"],
        },
        "Model Evaluation Metrics": {
            "Easy": ["What is mean squared error, and when is it used as an evaluation metric?"],
            "Medium": ["Why should you keep a separate test set even after tuning on a validation set?"],
            "Hard": ["Explain the ROC curve and AUC, and when a precision-recall curve is more informative."],
        },
        "Feature Engineering": {
            "Easy": ["What is binning (discretization) of a numeric feature?"],
            "Medium": ["How would you encode a categorical feature that has thousands of unique values?"],
            "Hard": ["How would you create useful features from a date-time column?"],
        },
        "Common Algorithms": {
            "Easy": ["What is Naive Bayes, and why is it called naive?"],
            "Medium": ["What is logistic regression, and why is it used for classification despite its name?"],
            "Hard": ["Compare random forests and gradient boosting, including how each reduces error."],
        },
    },
    "Artificial Intelligence": {
        "Search Algorithms": {
            "Easy": ["What is a constraint satisfaction problem? Give an example such as map coloring."],
            "Medium": ["What is greedy best-first search, and why is it not guaranteed to find the optimal path?"],
            "Hard": ["What is Monte Carlo Tree Search, and why does it work well for games like Go?"],
        },
        "Knowledge Representation": {
            "Easy": ["What is a knowledge base in an AI system?"],
            "Medium": ["What is a frame in knowledge representation?"],
            "Hard": ["How does proof by resolution refutation work in logic-based inference?"],
        },
        "AI vs Machine Learning": {
            "Easy": ["What is the Turing test?"],
            "Medium": ["What is an expert system, and what are its main components?"],
            "Hard": ["What are the trade-offs between rule-based systems and learned models in production?"],
        },
        "Neural Networks Basics": {
            "Easy": ["What is an epoch in neural network training?"],
            "Medium": ["What is the role of the learning rate in gradient descent?"],
            "Hard": ["What is the vanishing gradient problem, and how do ReLU and residual connections help?"],
        },
        "Ethics and Bias in AI": {
            "Easy": ["What is algorithmic bias?"],
            "Medium": ["How can bias in training data lead to unfair model outcomes? Give an example."],
            "Hard": ["How would you audit a deployed model for fairness across different demographic groups?"],
        },
    },
    "Web Development": {
        "HTML and CSS Fundamentals": {
            "Easy": ["What is semantic HTML, and why does it matter?"],
            "Medium": ["Explain the CSS box model and the effect of box-sizing: border-box."],
            "Hard": ["What is a stacking context in CSS, and why might z-index not behave as expected?"],
        },
        "REST APIs": {
            "Easy": ["What is the difference between the 401 and 403 HTTP status codes?"],
            "Medium": ["What does idempotency mean for HTTP methods, and which methods are idempotent?"],
            "Hard": ["How would you design rate limiting for a public REST API?"],
        },
        "Frontend Frameworks": {
            "Easy": ["What is client-side routing in a single-page application?"],
            "Medium": ["What is the difference between one-way and two-way data binding?"],
            "Hard": ["Compare client-side rendering, server-side rendering, and static site generation."],
        },
        "Authentication and Security": {
            "Easy": ["Why should passwords be hashed rather than encrypted when stored?"],
            "Medium": ["Compare session-based authentication with token-based authentication."],
            "Hard": ["What is cross-site scripting (XSS), and how do output encoding and Content Security Policy prevent it?"],
        },
        "Performance and Caching": {
            "Easy": ["What is minification, and how does it improve page load time?"],
            "Medium": ["What is code splitting, and how does it reduce the initial JavaScript bundle size?"],
            "Hard": ["How would you diagnose and improve a web page with a slow Largest Contentful Paint?"],
        },
    },
}

# Fourth batch: weighted toward scenario ("How would you...") and practical
# ("Write/Implement/Design a...") questions, which were under-represented
# relative to conceptual ones in the first three batches.
FOURTH_BATCH_QUESTIONS = {
    "Python": {
        "Functions": {
            "Easy": ["Write a Python function that accepts any number of keyword arguments and prints each key and value."],
            "Medium": ["How would you debug a Python function whose default list argument keeps growing between calls?"],
            "Hard": ["Implement a simple memoization helper for a recursive Python function without using functools.lru_cache."],
        },
        "OOP": {
            "Easy": ["Write a Python class with a read-only property computed from two other attributes."],
            "Medium": ["How would you design a Python class hierarchy for shapes so that each shape computes its own area?"],
            "Hard": ["Explain how Python's method resolution order (C3 linearization) decides which parent method runs in diamond inheritance."],
        },
        "Data Structures": {
            "Easy": ["Write Python code to count how often each word appears in a sentence."],
            "Medium": ["How would you remove duplicates from a Python list while preserving the original order?"],
            "Hard": ["Implement a least-recently-used cache in Python using an OrderedDict, and explain the complexity of get and put."],
        },
        "Exception Handling": {
            "Easy": ["Write a Python snippet that keeps asking for input until the user enters a valid integer."],
            "Medium": ["How would you define a custom exception class in Python, and why subclass Exception rather than BaseException?"],
            "Hard": ["How would you retry a flaky network call in Python with exponential backoff while still surfacing the final error?"],
        },
        "Decorators and Generators": {
            "Easy": ["Write a generator in Python that yields the first n even numbers."],
            "Medium": ["Implement a Python decorator that measures and prints how long a function takes to run."],
            "Hard": ["How would you process a 20 GB log file in Python without loading it all into memory?"],
        },
    },
    "Java": {
        "OOP": {
            "Easy": ["Write a Java class with a private field and a constructor that validates its argument."],
            "Medium": ["How would you make a Java class immutable, and why is immutability useful in concurrent code?"],
            "Hard": ["How would you implement the Builder pattern in Java for a class with many optional parameters?"],
        },
        "Collections": {
            "Easy": ["Write Java code to iterate over a HashMap and print each key and value."],
            "Medium": ["How would you sort a list of Employee objects in Java by salary and then by name?"],
            "Hard": ["How would you choose between ConcurrentHashMap and Collections.synchronizedMap for a heavily read, multi-threaded cache?"],
        },
        "Exception Handling": {
            "Easy": ["What is the difference between throw and throws in Java?"],
            "Medium": ["How would you design a custom checked exception for a banking application's insufficient-funds case?"],
            "Hard": ["What is exception chaining in Java, and why should you preserve the original cause when rethrowing?"],
        },
        "Multithreading": {
            "Easy": ["Write Java code that creates a thread using a lambda expression."],
            "Medium": ["How would you implement a producer-consumer solution in Java using a BlockingQueue?"],
            "Hard": ["How would you diagnose a deadlock in a running Java application?"],
        },
        "JVM and Memory Management": {
            "Easy": ["What is the difference between the stack and the heap in the JVM?"],
            "Medium": ["How would you investigate a Java application whose memory usage keeps rising over several days?"],
            "Hard": ["Compare the G1 and ZGC garbage collectors and when you would choose each."],
        },
    },
    "C": {
        "Pointers": {
            "Easy": ["Write a C function that swaps two integers using pointers."],
            "Medium": ["How would you use a function pointer in C to implement a simple callback?"],
            "Hard": ["What is a dangling pointer in C, and how would you systematically prevent them in a large codebase?"],
        },
        "Memory Management": {
            "Easy": ["Write C code that allocates an array of n integers with malloc and checks for failure."],
            "Medium": ["How would you find memory leaks in a C program using a tool such as Valgrind?"],
            "Hard": ["How would you design a simple fixed-size memory pool allocator in C, and why might it outperform malloc?"],
        },
        "Structures and Unions": {
            "Easy": ["Write a C structure to represent a student with a name, roll number, and marks."],
            "Medium": ["What is a self-referential structure in C, and how is it used to build a linked list?"],
            "Hard": ["How do bit fields in a C structure work, and what portability issues do they have?"],
        },
        "Arrays and Strings": {
            "Easy": ["Write a C function to compute the length of a string without using strlen."],
            "Medium": ["How would you reverse a string in place in C?"],
            "Hard": ["How would you safely read a line of arbitrary length from standard input in C?"],
        },
        "Preprocessor and Compilation": {
            "Easy": ["What are include guards in C, and why are they needed?"],
            "Medium": ["Explain the stages a C program goes through from source code to executable."],
            "Hard": ["How would you use conditional compilation to support both Windows and Linux in the same C source file?"],
        },
    },
    "C++": {
        "OOP": {
            "Easy": ["Write a C++ class with a constructor that uses a member initializer list."],
            "Medium": ["Why should a base class with virtual functions have a virtual destructor in C++?"],
            "Hard": ["How would you implement the rule of five for a C++ class that owns a raw dynamically allocated buffer?"],
        },
        "STL": {
            "Easy": ["Write C++ code that counts the frequency of each character in a string using std::map."],
            "Medium": ["How would you choose between std::map and std::unordered_map for a lookup-heavy workload?"],
            "Hard": ["What is iterator invalidation in C++, and which operations invalidate iterators of a std::vector?"],
        },
        "Memory Management": {
            "Easy": ["What is RAII in C++, and how does it help prevent resource leaks?"],
            "Medium": ["How would you decide between std::unique_ptr and std::shared_ptr for owning an object?"],
            "Hard": ["How would you write a custom deleter for a std::unique_ptr that manages a C FILE handle?"],
        },
        "Templates": {
            "Easy": ["Write a C++ function template that returns the larger of two values."],
            "Medium": ["What is template specialization in C++, and when would you use it?"],
            "Hard": ["What are variadic templates in C++, and how would you write a function that prints any number of arguments?"],
        },
        "Operator Overloading": {
            "Easy": ["Write a C++ class for a 2D point that overloads the + operator."],
            "Medium": ["How would you overload the << operator to print a custom class with std::cout?"],
            "Hard": ["When should an overloaded operator be a member function versus a non-member friend function in C++?"],
        },
    },
    "JavaScript": {
        "Closures and Scope": {
            "Easy": ["Write a JavaScript function that returns a counter function using a closure."],
            "Medium": ["How would you use a closure to create private variables in JavaScript?"],
            "Hard": ["How can closures cause memory leaks in long-running JavaScript applications, and how would you avoid them?"],
        },
        "Asynchronous JavaScript": {
            "Easy": ["Write a JavaScript function that returns a Promise which resolves after a given number of milliseconds."],
            "Medium": ["How would you add a timeout to a fetch request in JavaScript?"],
            "Hard": ["How would you limit the number of concurrent network requests when processing a large list of URLs in JavaScript?"],
        },
        "Prototypes and OOP": {
            "Easy": ["How do you add a method to all instances of a constructor function in JavaScript?"],
            "Medium": ["What does Object.create do, and how can it be used to set up inheritance?"],
            "Hard": ["How would you implement private fields in a JavaScript class, and how do #private fields differ from closure-based privacy?"],
        },
        "DOM and Events": {
            "Easy": ["Write JavaScript code to change the text of an element with a given id when a button is clicked."],
            "Medium": ["How would you implement a debounced search input in JavaScript?"],
            "Hard": ["How would you render a list of 100,000 items in the browser without freezing the page?"],
        },
        "ES6+ Features": {
            "Easy": ["What is the optional chaining operator (?.) in JavaScript, and what problem does it solve?"],
            "Medium": ["What is the difference between the nullish coalescing operator (??) and logical OR (||)?"],
            "Hard": ["How does a JavaScript Proxy work, and how could you use it to validate property assignments?"],
        },
    },
    "SQL": {
        "Joins": {
            "Easy": ["Write a SQL query that lists each order with the name of the customer who placed it."],
            "Medium": ["How would you find customers who have never placed an order using a join?"],
            "Hard": ["How would you use a self join to list each employee alongside their manager's name?"],
        },
        "Aggregation and Grouping": {
            "Easy": ["Write a SQL query to count the number of employees in each department."],
            "Medium": ["How would you find departments that have more than five employees?"],
            "Hard": ["How would you find the second highest salary in each department using a window function?"],
        },
        "Subqueries": {
            "Easy": ["Write a SQL query that returns employees who earn more than the average salary."],
            "Medium": ["What is a correlated subquery, and why can it be slower than an equivalent join?"],
            "Hard": ["How would you rewrite a slow correlated subquery using a common table expression (CTE)?"],
        },
        "Indexing and Performance": {
            "Easy": ["What is a composite index, and how does column order affect it?"],
            "Medium": ["How would you identify the slowest queries in a production database?"],
            "Hard": ["What is a covering index, and how can it let a query avoid reading the table entirely?"],
        },
        "Transactions": {
            "Easy": ["What do COMMIT and ROLLBACK do in a SQL transaction?"],
            "Medium": ["How would you transfer money between two accounts safely using a SQL transaction?"],
            "Hard": ["Explain the phantom read anomaly and which isolation level prevents it."],
        },
    },
    "DBMS": {
        "Normalization": {
            "Easy": ["What is First Normal Form, and what does it require of each column?"],
            "Medium": ["How would you normalize a table that stores a student's multiple phone numbers in one column?"],
            "Hard": ["What is Boyce-Codd Normal Form, and how does it differ from Third Normal Form?"],
        },
        "ER Modeling": {
            "Easy": ["What is a weak entity in an ER diagram?"],
            "Medium": ["How would you convert a many-to-many relationship in an ER diagram into relational tables?"],
            "Hard": ["How would you model a library system with books, members, loans, and reservations as an ER diagram?"],
        },
        "Transactions and Concurrency": {
            "Easy": ["What is a lost update problem in concurrent transactions?"],
            "Medium": ["Explain two-phase locking and how it guarantees serializability."],
            "Hard": ["How does multiversion concurrency control (MVCC) let readers avoid blocking writers?"],
        },
        "Indexing and Storage": {
            "Easy": ["What is a clustered index?"],
            "Medium": ["Why do databases usually use B+ trees rather than binary search trees for indexes?"],
            "Hard": ["When can adding an index make overall database performance worse?"],
        },
        "Keys and Constraints": {
            "Easy": ["What is the difference between a primary key and a unique key?"],
            "Medium": ["What is a composite primary key, and when would you use one?"],
            "Hard": ["How would you enforce a business rule such as 'end_date must be after start_date' at the database level?"],
        },
    },
    "OOP": {
        "Encapsulation and Abstraction": {
            "Easy": ["Give a real-world example of abstraction in software design."],
            "Medium": ["How would you refactor a class that exposes its internal list directly to callers?"],
            "Hard": ["How would you design a payment module so that adding a new payment provider does not require changing existing code?"],
        },
        "Inheritance and Polymorphism": {
            "Easy": ["What is the difference between compile-time and runtime polymorphism?"],
            "Medium": ["How would you decide whether a relationship should be modeled with inheritance or composition?"],
            "Hard": ["Explain the Liskov Substitution Principle using the classic square-rectangle example."],
        },
        "SOLID and Design Principles": {
            "Easy": ["What does the Single Responsibility Principle state?"],
            "Medium": ["How does dependency injection make classes easier to unit test?"],
            "Hard": ["How would you apply the Interface Segregation Principle to a large interface that many classes only partly implement?"],
        },
        "Interfaces vs Abstract Classes": {
            "Easy": ["Can an abstract class have a constructor, and why?"],
            "Medium": ["How would you choose between an interface and an abstract class when designing a plugin system?"],
            "Hard": ["How do default methods in interfaces blur the line between interfaces and abstract classes, and what conflicts can they cause?"],
        },
        "Design Patterns Basics": {
            "Easy": ["What is the Singleton pattern, and what is a common criticism of it?"],
            "Medium": ["How would you use the Factory pattern to create different notification types such as email and SMS?"],
            "Hard": ["How would you use the Decorator pattern to add logging and caching to a service without modifying it?"],
        },
    },
    "Data Structures": {
        "Arrays and Linked Lists": {
            "Easy": ["Write code to find the maximum element in an array."],
            "Medium": ["How would you detect a cycle in a linked list, and how would you find where the cycle begins?"],
            "Hard": ["How would you merge k sorted linked lists efficiently?"],
        },
        "Stacks and Queues": {
            "Easy": ["Write code to check whether a string of brackets is balanced using a stack."],
            "Medium": ["How would you implement a queue using two stacks, and what is the amortized cost of each operation?"],
            "Hard": ["How would you design a stack that returns its minimum element in constant time?"],
        },
        "Trees": {
            "Easy": ["Write a recursive function to count the number of nodes in a binary tree."],
            "Medium": ["How would you find the lowest common ancestor of two nodes in a binary search tree?"],
            "Hard": ["How would you serialize and deserialize a binary tree?"],
        },
        "Hashing": {
            "Easy": ["Write code to find two numbers in an array that add up to a target using a hash map."],
            "Medium": ["How would you group a list of words into sets of anagrams?"],
            "Hard": ["What is consistent hashing, and why is it used in distributed caches?"],
        },
        "Graphs": {
            "Easy": ["What is the difference between an adjacency list and an adjacency matrix?"],
            "Medium": ["How would you count the number of islands in a 2D grid of land and water?"],
            "Hard": ["How would you find the shortest path in a graph with negative edge weights, and why can Dijkstra's algorithm not be used?"],
        },
    },
    "Algorithms": {
        "Sorting": {
            "Easy": ["Write the bubble sort algorithm and state its time complexity."],
            "Medium": ["How would you sort an array containing only 0s, 1s, and 2s in a single pass?"],
            "Hard": ["How would you sort a file that is too large to fit in memory?"],
        },
        "Searching": {
            "Easy": ["Write an iterative binary search function."],
            "Medium": ["How would you search for a target in a rotated sorted array?"],
            "Hard": ["How would you find the median of two sorted arrays in logarithmic time?"],
        },
        "Recursion and Backtracking": {
            "Easy": ["Write a recursive function to compute the factorial of a number, and state its base case."],
            "Medium": ["How would you generate all permutations of a string using backtracking?"],
            "Hard": ["How would you solve the N-Queens problem, and how does pruning reduce the search space?"],
        },
        "Dynamic Programming": {
            "Easy": ["Write a dynamic programming solution to compute the nth Fibonacci number."],
            "Medium": ["How would you solve the 0/1 knapsack problem using dynamic programming?"],
            "Hard": ["How would you find the longest increasing subsequence in O(n log n) time?"],
        },
        "Greedy Algorithms": {
            "Easy": ["What is the greedy choice property?"],
            "Medium": ["How would you find the minimum number of platforms needed at a railway station given arrival and departure times?"],
            "Hard": ["Explain how Huffman coding builds an optimal prefix code using a greedy strategy."],
        },
    },
    "Computer Networks": {
        "OSI and TCP/IP Model": {
            "Easy": ["At which OSI layer do routers and switches primarily operate?"],
            "Medium": ["Walk through what happens at each layer when you open a web page in a browser."],
            "Hard": ["How would you troubleshoot a situation where a website loads by IP address but not by domain name?"],
        },
        "TCP vs UDP": {
            "Easy": ["Why do video calls and online games often use UDP?"],
            "Medium": ["Explain the TCP three-way handshake and why it needs three steps."],
            "Hard": ["What is head-of-line blocking, and how does QUIC avoid it?"],
        },
        "HTTP and HTTPS": {
            "Easy": ["What is the difference between HTTP GET and POST requests?"],
            "Medium": ["How do HTTP caching headers such as Cache-Control and ETag work?"],
            "Hard": ["Walk through the TLS handshake that happens before an HTTPS request is sent."],
        },
        "DNS and Routing": {
            "Easy": ["What is a default gateway?"],
            "Medium": ["How does DNS resolution work from the browser to the authoritative name server?"],
            "Hard": ["How does BGP route traffic between autonomous systems, and why can a misconfiguration cause a large outage?"],
        },
        "Network Security": {
            "Easy": ["What is a firewall, and what does it do?"],
            "Medium": ["How does a VPN protect traffic on an untrusted network?"],
            "Hard": ["How would you mitigate a distributed denial-of-service (DDoS) attack against a public web service?"],
        },
    },
    "Operating Systems": {
        "Process and Threads": {
            "Easy": ["What is a context switch?"],
            "Medium": ["What is a race condition? Give an example with two threads incrementing a shared counter."],
            "Hard": ["How would you choose between multiple processes and multiple threads for a CPU-bound task?"],
        },
        "Scheduling": {
            "Easy": ["What is round-robin scheduling, and what is a time quantum?"],
            "Medium": ["How does the choice of time quantum affect round-robin scheduling performance?"],
            "Hard": ["Explain priority inversion and how priority inheritance solves it."],
        },
        "Memory Management": {
            "Easy": ["What is a page fault?"],
            "Medium": ["What is thrashing, and how can an operating system detect and reduce it?"],
            "Hard": ["Compare paging and segmentation, including the fragmentation each one causes."],
        },
        "Deadlocks": {
            "Easy": ["What are the four necessary conditions for a deadlock?"],
            "Medium": ["How does imposing a global ordering on lock acquisition prevent deadlock?"],
            "Hard": ["How would you detect and recover from a deadlock in a system with multiple resource instances?"],
        },
        "File Systems": {
            "Easy": ["What is an inode in a Unix file system?"],
            "Medium": ["What is the difference between a hard link and a symbolic link?"],
            "Hard": ["How does journaling help a file system stay consistent after a power failure?"],
        },
    },
    "Machine Learning": {
        "Supervised vs Unsupervised": {
            "Easy": ["Give one example each of a classification problem and a regression problem."],
            "Medium": ["What is semi-supervised learning, and when is it useful?"],
            "Hard": ["How would you build a customer segmentation model for an e-commerce company?"],
        },
        "Overfitting and Regularization": {
            "Easy": ["What is early stopping?"],
            "Medium": ["How does dropout reduce overfitting in neural networks?"],
            "Hard": ["How would you handle a model that performs well in validation but poorly after deployment?"],
        },
        "Model Evaluation Metrics": {
            "Easy": ["What is a confusion matrix?"],
            "Medium": ["Why is accuracy a misleading metric for an imbalanced dataset?"],
            "Hard": ["How would you evaluate a fraud detection model where fraud cases are less than 1% of the data?"],
        },
        "Feature Engineering": {
            "Easy": ["What is feature scaling, and why do some algorithms need it?"],
            "Medium": ["How would you handle missing values in a dataset?"],
            "Hard": ["What is data leakage, and how can careless feature engineering introduce it?"],
        },
        "Common Algorithms": {
            "Easy": ["How does the k-nearest neighbors algorithm make a prediction?"],
            "Medium": ["How does a decision tree choose which feature to split on?"],
            "Hard": ["Explain how a support vector machine uses the kernel trick to separate non-linear data."],
        },
    },
    "Artificial Intelligence": {
        "Search Algorithms": {
            "Easy": ["What is the difference between uninformed and informed search?"],
            "Medium": ["What makes a heuristic admissible in A* search?"],
            "Hard": ["How does alpha-beta pruning speed up minimax search in two-player games?"],
        },
        "Knowledge Representation": {
            "Easy": ["What is a semantic network?"],
            "Medium": ["What is the difference between propositional logic and first-order logic?"],
            "Hard": ["What is an ontology, and how would you use one to represent a domain such as medicine?"],
        },
        "AI vs Machine Learning": {
            "Easy": ["What is the difference between narrow AI and general AI?"],
            "Medium": ["How is deep learning related to machine learning and AI?"],
            "Hard": ["How would you decide whether a business problem needs machine learning or a simple rule-based solution?"],
        },
        "Neural Networks Basics": {
            "Easy": ["What is an activation function, and why is it needed?"],
            "Medium": ["Explain backpropagation at a high level."],
            "Hard": ["How does the attention mechanism in transformers work, and why did it replace recurrent networks for many tasks?"],
        },
        "Ethics and Bias in AI": {
            "Easy": ["What is explainability in AI, and why does it matter?"],
            "Medium": ["What privacy risks arise when training models on user data?"],
            "Hard": ["How would you design a review process before deploying an AI model that makes hiring recommendations?"],
        },
    },
    "Web Development": {
        "HTML and CSS Fundamentals": {
            "Easy": ["What is the difference between inline, block, and inline-block elements?"],
            "Medium": ["How would you center a div both horizontally and vertically using Flexbox?"],
            "Hard": ["How would you make a complex layout responsive across mobile, tablet, and desktop screens?"],
        },
        "REST APIs": {
            "Easy": ["What is the difference between PUT and PATCH?"],
            "Medium": ["How would you design pagination for an API that returns a large list of items?"],
            "Hard": ["How would you version a public REST API without breaking existing clients?"],
        },
        "Frontend Frameworks": {
            "Easy": ["What is a component in frameworks such as React or Vue?"],
            "Medium": ["How would you share state between deeply nested components without prop drilling?"],
            "Hard": ["How would you diagnose and fix unnecessary re-renders in a large React application?"],
        },
        "Authentication and Security": {
            "Easy": ["What is CORS, and why do browsers enforce it?"],
            "Medium": ["How does a cross-site request forgery (CSRF) attack work, and how is it prevented?"],
            "Hard": ["How would you securely store and refresh JWT access tokens in a single-page application?"],
        },
        "Performance and Caching": {
            "Easy": ["What is lazy loading of images?"],
            "Medium": ["How does a CDN improve website performance?"],
            "Hard": ["How would you design a caching strategy for a site where some content changes every minute and some rarely changes?"],
        },
    },
}

for _batch in (ADDITIONAL_QUESTIONS, THIRD_BATCH_QUESTIONS, FOURTH_BATCH_QUESTIONS):
    for _skill, _topics in _batch.items():
        for _topic, _difficulties in _topics.items():
            for _difficulty, _questions in _difficulties.items():
                RAW_QUESTIONS[_skill][_topic][_difficulty].extend(_questions)


def classify_question_type(question: str) -> str:
    q = question.strip().lower()
    if q.startswith("how would you") or q.startswith("how do you design") or "scenario" in q:
        return "scenario"
    if q.startswith("write") or q.startswith("design a") or q.startswith("implement"):
        return "practical"
    return "conceptual"


def build_records():
    records = []
    for skill, topics in RAW_QUESTIONS.items():
        for topic, difficulties in topics.items():
            for difficulty, questions in difficulties.items():
                for question in questions:
                    records.append(
                        {
                            "skill": skill,
                            "topic": topic,
                            "difficulty": difficulty,
                            "question_type": classify_question_type(question),
                            "question": question,
                        }
                    )
    return records


def main():
    records = build_records()
    out_dir = os.path.join(os.path.dirname(__file__), "data", "interview_questions")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "raw_dataset.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(records)} raw records to {out_path}")


if __name__ == "__main__":
    main()
