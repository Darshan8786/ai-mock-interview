import type { ReactNode } from "react";

interface MyComponentProps {
    title: string;
    inputBox: ReactNode;
}

export function AICard({ title, inputBox }: MyComponentProps) {
    return (
        <div className="bg-black mt-12 h-40 w-30 ml-5 mr-3 rounded-lg border border-black
        transition duration-200 ease-in-out
        ring-4 ring-white
     
        sm:h-50 sm:w-50 
        md:h-50 md:w-70
        lg:h-60 lg:w-70">
            <p className="hidden sm:block text-white sm:text-l md:text-xl md:mt-2 lg:text-2xl font-bold text-center mt-6 lg:mt-8">
                {title}
            </p>
            <div className="hidden sm:flex sm:mt-2 md:mt-1 lg:mt-4 justify-center ">
                {inputBox}
            </div>

        </div>
    )
} 