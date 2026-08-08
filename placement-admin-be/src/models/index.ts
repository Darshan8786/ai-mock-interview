export { Admin } from "./Admin.model";
export { Student } from "./Student.model";
export { Company } from "./Company.model";
export { Job } from "./Job.model";
export { Application } from "./Application.model";
export { Interview } from "./Interview.model";
export { AptitudeTest, AptitudeAttempt } from "./AptitudeTest.model";

export type { IAdmin } from "./Admin.model";
export type { IStudent, StudentStatus } from "./Student.model";
export type { ICompany, CompanyStatus } from "./Company.model";
export type { IJob, JobStatus } from "./Job.model";
export type { IApplication, ApplicationStatus } from "./Application.model";
export type { IInterview, InterviewStatus, IInterviewScore } from "./Interview.model";
export type {
  IAptitudeTest,
  IAptitudeAttempt,
  IAptitudeQuestion,
  AptitudeDifficulty,
  AptitudeTestStatus,
} from "./AptitudeTest.model";
