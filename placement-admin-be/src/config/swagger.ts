import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Placement Admin API",
      version: "1.0.0",
      description:
        "Admin backend for the AI-Based Smart Campus Recruitment and Placement System. Provides authentication, dashboard analytics, and CRUD for students, companies, jobs, applications, interviews, and aptitude tests.",
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/admin`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {},
            pagination: {
              type: "object",
              properties: {
                page: { type: "number" },
                limit: { type: "number" },
                total: { type: "number" },
                totalPages: { type: "number" },
                hasNext: { type: "boolean" },
                hasPrev: { type: "boolean" },
              },
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
        },
        TokenPair: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },
        Admin: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            avatar: { type: "string" },
            role: { type: "string", enum: ["admin"] },
            isActive: { type: "boolean" },
            lastLoginAt: { type: "string", format: "date-time" },
          },
        },
        Student: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            department: { type: "string" },
            year: { type: "string" },
            batch: { type: "string" },
            college: { type: "string" },
            location: { type: "string" },
            avatar: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            resumeUrl: { type: "string" },
            atsScore: { type: "number" },
            placementReadiness: { type: "number" },
            status: { type: "string", enum: ["active", "inactive", "blocked"] },
          },
        },
        Company: {
          type: "object",
          properties: {
            _id: { type: "string" },
            companyName: { type: "string" },
            hrName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            description: { type: "string" },
            logo: { type: "string" },
            website: { type: "string" },
            status: { type: "string", enum: ["active", "inactive", "blacklisted"] },
          },
        },
        Job: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            company: { $ref: "#/components/schemas/Company" },
            package: { type: "string" },
            location: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            eligibility: { type: "string" },
            deadline: { type: "string", format: "date-time" },
            openings: { type: "number" },
            description: { type: "string" },
            status: { type: "string", enum: ["open", "closed", "draft"] },
          },
        },
        Application: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { $ref: "#/components/schemas/Student" },
            job: { $ref: "#/components/schemas/Job" },
            coverLetter: { type: "string" },
            resumeUrl: { type: "string" },
            atsScore: { type: "number" },
            status: {
              type: "string",
              enum: ["applied", "shortlisted", "rejected", "hired", "withdrawn"],
            },
            statusHistory: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  changedAt: { type: "string", format: "date-time" },
                },
              },
            },
            appliedAt: { type: "string", format: "date-time" },
          },
        },
        Interview: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { $ref: "#/components/schemas/Student" },
            job: { $ref: "#/components/schemas/Job" },
            interviewerName: { type: "string" },
            scheduledAt: { type: "string", format: "date-time" },
            durationMin: { type: "number" },
            mode: { type: "string", enum: ["online", "offline", "ai"] },
            link: { type: "string" },
            status: {
              type: "string",
              enum: ["scheduled", "in-progress", "completed", "cancelled", "no-show"],
            },
            scores: {
              type: "object",
              properties: {
                technical: { type: "number" },
                communication: { type: "number" },
                confidence: { type: "number" },
                grammar: { type: "number" },
                fluency: { type: "number" },
                overall: { type: "number" },
              },
            },
            feedback: { type: "string" },
            notes: { type: "string" },
          },
        },
        AptitudeQuestion: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            topic: { type: "string" },
          },
        },
        AptitudeTest: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            timeLimitMin: { type: "number" },
            passingScore: { type: "number" },
            totalMarks: { type: "number" },
            questions: { type: "array", items: { $ref: "#/components/schemas/AptitudeQuestion" } },
            status: { type: "string", enum: ["published", "draft", "archived"] },
          },
        },
        AptitudeAttempt: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { $ref: "#/components/schemas/Student" },
            test: { $ref: "#/components/schemas/AptitudeTest" },
            score: { type: "number" },
            percentage: { type: "number" },
            passed: { type: "boolean" },
            startedAt: { type: "string", format: "date-time" },
            submittedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.routes.ts", "./src/controllers/*.controller.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
