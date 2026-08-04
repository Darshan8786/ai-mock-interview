import { CardProvider } from "../components/cardcomponents/CardContext";
import { CardStructure } from "../components/cardcomponents/CardStructure";

export function HomePage() {

    const subjects = [
        { image: "/database.svg", title: "DBMS" },
        { image: "/OOPS.png", title: "OOPS" },
        { image: "/OS.jpeg", title: "OS" },
        { image: "/networks.jpeg", title: "Networks" },
    ]

    const companies = [
        { image: "/infosys.png", title: "Infosys" },
        { image: "/wipro.png", title: "Wipro" },
        { image: "/TCS.png", title: "TCS" },
        { image: "/capegemini.png", title: "Capgemini" },
    ];

    const roles = [
        { image: "/MERN.png", title: "MERN Stack" },
        { image: "/angular.png", title: "Angular" },
        { image: "/java.png", title: "Java Full Stack" },
        { image: "/python.png", title: "Python Full Stack" },
    ]

    const subjectwise = {
        title2: "Not able to find your favourite subject? Try our AI feature.",
        inputPlaceholder: "Data Structures...",
        apiEndpoint: "/v1/genai/subject",
        route: "/subject-ai"
    };

    const roleWise = {
        title2: "Not able to find your desired role? Try our AI feature.",
        inputPlaceholder: "React Roles...",
        apiEndpoint: "/v1/genai/role",
        route: "/genai"
    };

    const companyWise = {
        title2: "Not able to find your desired company? Try our AI feature.",
        inputPlaceholder: "Emphasis...",
        apiEndpoint: "/v1/genai/company",
        route: "/company-ai"
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center">

            </div>
            <CardProvider subjects={subjects} GENAI={subjectwise}>
                <CardStructure title="Subject Wise MCQ's" />
            </CardProvider>

            <CardProvider subjects={roles} GENAI={roleWise}>
                <CardStructure title="Role Wise MCQ's" />
            </CardProvider>
            <CardProvider subjects={companies} GENAI={companyWise}>
                <CardStructure title="Company Wise MCQ's" />
            </CardProvider>
        </div>
    )
}