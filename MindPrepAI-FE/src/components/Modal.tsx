type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onStart: () => void;
    subjectTitle: string;
    instructions: string;
}

export function Modal({ isOpen, onClose, onStart, subjectTitle, instructions }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-pointer"
        onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 border-4 border-red-800"
            onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-center">{subjectTitle}</h2>

                <div className="mb-6">
                    <p className="text-gray-700 text-center">{instructions}</p>
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg transition duration-200 ease-in-out
                      hover:bg-gray-800 active:scale-95 cursor-pointer"
                    >
                        Close
                    </button>
                    <button
                        onClick={onStart}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg transition duration-200 ease-in-out
                       hover:bg-blue-800 active:scale-95 cursor-pointer"
                    >
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
}