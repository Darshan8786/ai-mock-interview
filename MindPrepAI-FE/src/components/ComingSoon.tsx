
interface ComingSoonProps  {
    image: string;
    text: string;
}
export function ComingSoon ({image, text}: ComingSoonProps) {
    return <div className="
        bg-black ring-4 ring-white rounded-lg p-2 mt-12 h-40 lg:w-278 lg:ml-20
        sm:h-50 sm:w-145
        lg:h-60 md:w-100 
        mr-20
      ">
        <div className="text-white flex justify-center text-2xl font-bold">{text}</div>
        <div className="flex justify-center mt-4 "><img src={image} alt={text} className="h-38 rounded-lg w-200"/></div>
    </div>
}