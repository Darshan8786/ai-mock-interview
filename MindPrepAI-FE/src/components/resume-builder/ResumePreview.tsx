import type { ResumeData, TemplateType } from "../../types/resume";

interface ResumePreviewProps {
  data: ResumeData;
  template: TemplateType;
}

export function ResumePreview({ data, template }: ResumePreviewProps) {
  const { personalInfo, summary, education, experience, skills, projects } = data;

  if (template === "modern") {
    return (
      <div id="resume-preview" className="flex h-full w-full bg-white text-black font-sans leading-relaxed">
        {/* Left Sidebar */}
        <div className="w-[35%] bg-slate-800 text-white p-6 break-words">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 uppercase tracking-wide">{personalInfo.fullName || "Your Name"}</h1>
            {personalInfo.email && <div className="text-sm text-slate-300 mb-1">{personalInfo.email}</div>}
            {personalInfo.phone && <div className="text-sm text-slate-300 mb-1">{personalInfo.phone}</div>}
            {personalInfo.location && <div className="text-sm text-slate-300 mb-1">{personalInfo.location}</div>}
            {personalInfo.linkedin && <div className="text-sm text-slate-300 mb-1">{personalInfo.linkedin}</div>}
            {personalInfo.portfolio && <div className="text-sm text-slate-300">{personalInfo.portfolio}</div>}
          </div>

          {skills.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider border-b border-slate-600 pb-1 mb-3 text-blue-400">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span key={index} className="px-2 py-1 bg-slate-700 rounded-md text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {education.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider border-b border-slate-600 pb-1 mb-3 text-blue-400">Education</h2>
              <div className="space-y-4">
                {education.map((edu) => (
                  <div key={edu.id}>
                    <div className="font-semibold text-sm">{edu.degree} {edu.field && `in ${edu.field}`}</div>
                    <div className="text-xs text-slate-300">{edu.institution}</div>
                    <div className="text-[10px] text-slate-400 italic">
                      {edu.startDate} - {edu.endDate} {edu.gpa && `| GPA: ${edu.gpa}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Content */}
        <div className="w-[65%] p-6 bg-white text-slate-800">
          {summary && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider border-b-2 border-blue-600 pb-1 mb-2 text-slate-900">Professional Summary</h2>
              <p className="text-xs text-slate-700 leading-snug">{summary}</p>
            </div>
          )}

          {experience.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider border-b-2 border-blue-600 pb-1 mb-3 text-slate-900">Experience</h2>
              <div className="space-y-4">
                {experience.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="font-semibold text-sm text-slate-900">{exp.role}</div>
                      <div className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 font-medium mb-1">{exp.company}</div>
                    {exp.bullets.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1">
                        {exp.bullets.filter(b => b.trim()).map((bullet, idx) => (
                          <li key={idx} className="text-xs text-slate-700 leading-snug">{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider border-b-2 border-blue-600 pb-1 mb-3 text-slate-900">Projects</h2>
              <div className="space-y-3">
                {projects.map((proj) => (
                  <div key={proj.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-sm text-slate-900">{proj.name}</div>
                      {proj.link && <div className="text-[10px] text-blue-500">{proj.link}</div>}
                    </div>
                    <p className="text-xs text-slate-700 leading-snug mb-1">{proj.description}</p>
                    {proj.technologies.length > 0 && (
                      <div className="text-[10px] text-slate-500 font-medium">
                        Tech: {proj.technologies.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template === "classic") {
    return (
      <div id="resume-preview" className="flex flex-col h-full w-full bg-white text-black font-serif p-8 leading-relaxed">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{personalInfo.fullName || "Your Name"}</h1>
          <div className="text-xs text-gray-600 flex flex-wrap justify-center gap-2">
            {personalInfo.email && <span>{personalInfo.email}</span>}
            {personalInfo.phone && <span>| {personalInfo.phone}</span>}
            {personalInfo.location && <span>| {personalInfo.location}</span>}
            {personalInfo.linkedin && <span>| {personalInfo.linkedin}</span>}
            {personalInfo.portfolio && <span>| {personalInfo.portfolio}</span>}
          </div>
        </div>

        {summary && (
          <div className="mb-5">
            <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-black pb-1 mb-2">Professional Summary</h2>
            <p className="text-xs text-gray-800 leading-snug">{summary}</p>
          </div>
        )}

        {experience.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-black pb-1 mb-3">Professional Experience</h2>
            <div className="space-y-4">
              {experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline">
                    <div className="font-bold text-sm">{exp.role}</div>
                    <div className="text-xs italic text-gray-600">
                      {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                    </div>
                  </div>
                  <div className="text-xs font-semibold mb-1">{exp.company}</div>
                  {exp.bullets.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      {exp.bullets.filter(b => b.trim()).map((bullet, idx) => (
                        <li key={idx} className="text-xs text-gray-800">{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {education.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-black pb-1 mb-3">Education</h2>
            <div className="space-y-3">
              {education.map((edu) => (
                <div key={edu.id} className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm">{edu.institution}</div>
                    <div className="text-xs text-gray-800">
                      {edu.degree} {edu.field && `in ${edu.field}`} {edu.gpa && `- GPA: ${edu.gpa}`}
                    </div>
                  </div>
                  <div className="text-xs italic text-gray-600">
                    {edu.startDate} - {edu.endDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-black pb-1 mb-3">Projects</h2>
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id}>
                  <div className="flex items-baseline gap-2">
                    <div className="font-bold text-sm">{proj.name}</div>
                    {proj.link && <div className="text-[10px] text-gray-500 italic">{proj.link}</div>}
                  </div>
                  <p className="text-xs text-gray-800 my-0.5">{proj.description}</p>
                  {proj.technologies.length > 0 && (
                    <div className="text-[10px] text-gray-600">
                      <span className="font-semibold">Technologies:</span> {proj.technologies.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {skills.length > 0 && (
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-black pb-1 mb-2">Skills</h2>
            <div className="text-xs text-gray-800">
              {skills.join(", ")}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Minimal Template
  return (
    <div id="resume-preview" className="flex flex-col h-full w-full bg-white text-black font-sans p-8 leading-relaxed">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-gray-900">{personalInfo.fullName || "Your Name"}</h1>
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.portfolio && <span>{personalInfo.portfolio}</span>}
        </div>
      </div>

      {summary && (
        <div className="mb-6 border-l-2 border-emerald-500 pl-4">
          <p className="text-xs text-gray-700 leading-relaxed">{summary}</p>
        </div>
      )}

      {experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4">Experience</h2>
          <div className="space-y-5">
            {experience.map((exp) => (
              <div key={exp.id} className="relative pl-4 border-l border-gray-200">
                <div className="absolute w-2 h-2 bg-emerald-500 rounded-full -left-[4px] top-1.5"></div>
                <div className="flex justify-between items-baseline mb-0.5">
                  <div className="font-bold text-sm text-gray-900">{exp.role}</div>
                  <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                    {exp.startDate} — {exp.current ? "Present" : exp.endDate}
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-medium mb-2">{exp.company}</div>
                {exp.bullets.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-gray-600">
                    {exp.bullets.filter(b => b.trim()).map((bullet, idx) => (
                      <li key={idx} className="text-xs">{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div>
          {education.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-3">Education</h2>
              <div className="space-y-3">
                {education.map((edu) => (
                  <div key={edu.id}>
                    <div className="font-bold text-sm text-gray-900">{edu.degree} {edu.field && `in ${edu.field}`}</div>
                    <div className="text-xs text-gray-500 mb-0.5">{edu.institution}</div>
                    <div className="text-[10px] text-gray-400">
                      {edu.startDate} — {edu.endDate} {edu.gpa && `| GPA: ${edu.gpa}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {skills.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-2">Skills</h2>
              <p className="text-xs text-gray-700 leading-relaxed">
                {skills.join(" • ")}
              </p>
            </div>
          )}
        </div>

        <div>
          {projects.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-3">Projects</h2>
              <div className="space-y-4">
                {projects.map((proj) => (
                  <div key={proj.id}>
                    <div className="font-bold text-sm text-gray-900 mb-0.5">{proj.name}</div>
                    <p className="text-xs text-gray-600 mb-1">{proj.description}</p>
                    {proj.technologies.length > 0 && (
                      <div className="text-[10px] text-emerald-600 font-medium">
                        {proj.technologies.join(" / ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
