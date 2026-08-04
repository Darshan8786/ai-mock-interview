import { useState, useRef } from "react";
import { AICard } from "./AICardComponents/AICard";
import { useCardContext } from "./CardContext";
import { SmallCard } from "./SmallCard";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { Modal } from "../Modal";
import toast from "react-hot-toast";
import { BACKEND_URL } from "../../config/config";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export function CardStructure({ title }: { title: string }) {
  const { subjects, GENAI } = useCardContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Modal handlers
  function handleCardClick(title: string) {
    setSelectedSubject(title);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setSelectedSubject('');
    setModalOpen(false);
  }

  async function handleStart() {
    if (!selectedSubject) {
      alert("Please select a subject");
      return;
    }
    setModalOpen(false);

    const subjectPath = selectedSubject.toLowerCase();
    const toastId = toast.loading("Loading quiz...");

    try {
      const response = await axios.get(`${BACKEND_URL}/v1/quiz/${subjectPath}`, {
        headers: { token: localStorage.getItem("token") },
      });
      const questions = response.data;

      toast.success("Quiz loaded!", { id: toastId });
      navigate(`/${subjectPath}`, { state: { questions, subjectPath } });
    } catch (err) {
      toast.error("Failed to load quiz", { id: toastId });
      console.error(err);
    }
  }

  // Send AI input to backend
  async function handleSendToBackend() {
    if (!inputRef.current) return;

    const inputValue = inputRef.current.value.trim();
    if (!inputValue) {
      toast.error("Please type something first!");
      return;
    }

    // console.log("Sending payload:", { input: inputValue });
    // console.log("Endpoint:", `${BACKEND_URL}${GENAI.apiEndpoint}`);

    const toastId = toast.loading("Sending input...");
    try {
      const response = await axios.post(
        `${BACKEND_URL}${GENAI.apiEndpoint}`,
        { input: inputValue },
        { headers: { token: localStorage.getItem("token") } }
      );

      toast.success("Input sent!", { id: toastId });
      console.log("Backend response:", response.data);
      navigate(GENAI.route, {state: {data: response.data}});
      inputRef.current.value = ""; 
    } catch (err) {
      toast.error("Failed to send input", { id: toastId });
      console.error(err);
    }
  }

  // Instructions per subject
  const getInstructions = (subject: string) => {
    const instructionsMap: Record<string, string> = {
      'DBMS': 'You will be tested on Database Management System concepts including SQL queries, normalization, and database design principles.',
      'OOPS': 'Test your knowledge of Object-Oriented Programming concepts including inheritance, polymorphism, encapsulation, and abstraction.',
      'OS': 'Challenge yourself with Operating System topics like process management, memory management, and file systems.',
      'Networks': 'Explore computer networking concepts including protocols, network architecture, and data transmission.'
    };

    return instructionsMap[subject] || `Click Start to begin the quiz commonly asked in ${subject} roles.`;
  };

  return (
    <div className="flex justify-center items-center gap-4">
      {/* Subject Cards */}
      <div
        className="
          bg-black ring-4 ring-white rounded-lg p-2 mt-12 h-40 w-70 
          sm:w-100 sm:h-50
          md:w-140 
          lg:w-200 lg:h-60
        "
      >
        <div className="flex items-center justify-center">
          <h2 className="text-white text-xl font-bold text-center lg:text-2xl mb-1">
            {title}
          </h2>
        </div>

        <div className="flex justify-center items-center">
          <Swiper
            modules={[Navigation]}
            navigation
            spaceBetween={-30}
            slidesPerView={2}
            centeredSlides={true}
            centerInsufficientSlides={true}
            centeredSlidesBounds={true}
            breakpoints={{
              640: { slidesPerView: 3, spaceBetween: 8, centeredSlides: false },
              1024: { slidesPerView: 4, spaceBetween: 12, centeredSlides: false },
            }}
          >
            {subjects.map((subject, index) => (
              <SwiperSlide key={index}>
                <SmallCard
                  image={subject.image}
                  title={subject.title}
                  onClick={handleCardClick}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {/* AI Card */}
      <AICard
        title={GENAI.title2}
        inputBox={
          <>
            <input
              ref={inputRef}
              type="text"
              placeholder={GENAI.inputPlaceholder}
              className="w-4/5 mb-2 sm:w-3/4 md:w-2/3 p-2 rounded-lg border border-white bg-transparent text-white placeholder-white outline-none"
            />
            <button
              onClick={handleSendToBackend}
              className="bg-white text-black font-bold p-2 rounded-lg mb-2 ml-2 cursor-pointer"
            >
              Send
            </button>
          </>
        }
      />

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        subjectTitle={selectedSubject}
        onClose={handleCloseModal}
        onStart={handleStart}
        instructions={getInstructions(selectedSubject)}
      />
    </div>
  );
}
