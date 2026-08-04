/**
 * Official Documentation Links for Learning Resources
 */

export interface Documentation {
    name: string;
    url: string;
    description: string;
    type: "official" | "community";
}

const documentationMap: Record<string, Documentation[]> = {
    dsa: [
        {
            name: "GeeksforGeeks DSA",
            url: "https://www.geeksforgeeks.org/data-structures/",
            description: "Comprehensive DSA tutorials with examples and practice problems",
            type: "community",
        },
        {
            name: "LeetCode",
            url: "https://leetcode.com/explore/learn/",
            description: "Interactive DSA learning with hands-on coding problems",
            type: "community",
        },
        {
            name: "Programiz DSA",
            url: "https://www.programiz.com/dsa",
            description: "Interactive DSA tutorials with visualizations",
            type: "community",
        },
    ],
    dbms: [
        {
            name: "GeeksforGeeks DBMS",
            url: "https://www.geeksforgeeks.org/dbms/",
            description: "Complete DBMS concepts with detailed explanations",
            type: "community",
        },
        {
            name: "TutorialsPoint DBMS",
            url: "https://www.tutorialspoint.com/dbms/index.htm",
            description: "DBMS tutorial covering all fundamental concepts",
            type: "community",
        },
    ],
    os: [
        {
            name: "GeeksforGeeks Operating Systems",
            url: "https://www.geeksforgeeks.org/operating-systems/",
            description: "Operating Systems concepts and implementation details",
            type: "community",
        },
        {
            name: "TutorialsPoint OS",
            url: "https://www.tutorialspoint.com/operating_system/index.htm",
            description: "OS fundamentals and advanced concepts",
            type: "community",
        },
    ],
    oops: [
        {
            name: "GeeksforGeeks OOP",
            url: "https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/",
            description: "Object-Oriented Programming principles and implementation",
            type: "community",
        },
        {
            name: "TutorialsPoint OOP",
            url: "https://www.tutorialspoint.com/object_oriented_analysis_design/ooad_object_oriented_concepts.htm",
            description: "Complete OOP concepts and design patterns",
            type: "community",
        },
    ],
    java: [
        {
            name: "Official Java Documentation",
            url: "https://docs.oracle.com/en/java/",
            description: "Official Java API documentation and guides",
            type: "official",
        },
        {
            name: "GeeksforGeeks Java",
            url: "https://www.geeksforgeeks.org/java/",
            description: "Java tutorials from basics to advanced",
            type: "community",
        },
        {
            name: "TutorialsPoint Java",
            url: "https://www.tutorialspoint.com/java/index.htm",
            description: "Complete Java programming tutorial",
            type: "community",
        },
    ],
    python: [
        {
            name: "Official Python Documentation",
            url: "https://docs.python.org/3/",
            description: "Official Python documentation and library reference",
            type: "official",
        },
        {
            name: "GeeksforGeeks Python",
            url: "https://www.geeksforgeeks.org/python/",
            description: "Python tutorials and examples",
            type: "community",
        },
        {
            name: "Real Python",
            url: "https://realpython.com/",
            description: "In-depth Python tutorials and articles",
            type: "community",
        },
    ],
    javascript: [
        {
            name: "MDN Web Docs - JavaScript",
            url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
            description: "Comprehensive JavaScript documentation and guides",
            type: "official",
        },
        {
            name: "GeeksforGeeks JavaScript",
            url: "https://www.geeksforgeeks.org/javascript/",
            description: "JavaScript tutorials and examples",
            type: "community",
        },
        {
            name: "JavaScript.info",
            url: "https://javascript.info/",
            description: "Modern JavaScript tutorial",
            type: "community",
        },
    ],
    react: [
        {
            name: "Official React Documentation",
            url: "https://react.dev/",
            description: "Official React documentation with interactive examples",
            type: "official",
        },
        {
            name: "GeeksforGeeks React",
            url: "https://www.geeksforgeeks.org/react/",
            description: "React tutorials and guides",
            type: "community",
        },
    ],
    typescript: [
        {
            name: "Official TypeScript Documentation",
            url: "https://www.typescriptlang.org/docs/",
            description: "Official TypeScript handbook and documentation",
            type: "official",
        },
        {
            name: "TypeScript Deep Dive",
            url: "https://basarat.gitbook.io/typescript/",
            description: "Comprehensive TypeScript guide",
            type: "community",
        },
    ],
};

/**
 * Get documentation for a subject
 */
export function getDocumentationForSubject(subject: string): Documentation[] {
    const key = subject.toLowerCase().trim();
    return documentationMap[key] || [];
}

/**
 * Get all available subjects with documentation
 */
export function getAvailableSubjects(): string[] {
    return Object.keys(documentationMap);
}

/**
 * Search documentation by subject keyword
 */
export function searchDocumentation(query: string): Documentation[] {
    const results: Documentation[] = [];
    const lowerQuery = query.toLowerCase();

    for (const subject of Object.keys(documentationMap)) {
        if (subject.includes(lowerQuery)) {
            results.push(...documentationMap[subject]);
        }
    }

    return results;
}
