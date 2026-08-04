type SmallCardPros = {
    title: string;
    image: string;
    onClick?: (title: string) => void;
}
export function SmallCard({ title, image, onClick }: SmallCardPros) {
    return (
        <div className="bg-white h-20 w-20 rounded-lg border-2xl border-white flex flex-col items-center justify-center mt-2
        transition duration-200 ease-in-out
        hover:bg-gray-300 active:scale-95 cursor-pointer
        sm:h-30 sm:w-30
        md:h-35 md:w-35
        lg:h-40 lg:w-40"
        onClick = {() => onClick?.(title)}> 
            <img src={image} className="h-10 w-10 mb-2
            md:h-15 md:w-22 mt-2
            lg:h-20 lg:w-30" />
            <div className="font-bold text-sm md:text-base lg:text-lg">
                {title}
            </div>
        </div>
    )
}