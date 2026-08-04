import { createContext, useContext, type ReactNode } from "react";

type Subject = {
    image: string;
    title: string;
}

type AI = {
    title2: string;
    inputPlaceholder: string;
    apiEndpoint: string;
    route: string;
}

type CardContextType = {
    subjects: Subject[];
    GENAI: AI;
}


const CardContext = createContext<CardContextType | undefined>(undefined)

export function useCardContext() {
    const context = useContext(CardContext)
    if (!context) {
        throw new Error("useCardContext must be provided in Card Provider")
    }
    return context;
}

export function CardProvider({ children, subjects, GENAI }: { children: ReactNode; subjects: Subject[]; GENAI: AI }) {
    return (
        <CardContext.Provider value={{ subjects, GENAI }}>
            {children}
        </CardContext.Provider>
    )
}