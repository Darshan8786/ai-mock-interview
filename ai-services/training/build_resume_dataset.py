"""
Builds the raw, hand-curated dataset used to train the local resume-content
enhancer model (bullet-point rewriting + summary writing).

Every example below was written by hand (not templated/duplicated), same
convention as build_raw_dataset.py for the interview-question dataset - a
small, high-quality dataset beats a large, near-duplicate one for full
fine-tuning a tiny model on limited hardware.

Usage:
    python training/build_resume_dataset.py
Writes:
    training/data/resume_enhancement/raw_dataset.json
"""

import json
import os

# Weak resume bullet -> strong, ATS-friendly rewrite. STRICT policy: the
# strong version may ONLY improve the verb, voice, and phrasing - it must
# NEVER assert a number, percentage, or scale that isn't already present in
# the weak version. An earlier version of this dataset added invented
# metrics ("50K+ daily transactions", "reduced X by 35%") to every "strong"
# example; the trained model faithfully learned that pattern and started
# fabricating achievements on real users' resumes (e.g. turning "wrote
# documentation" into "recovered 2 million page views"). On a resume tool,
# a fabricated number is not a style issue, it's a factual-integrity one -
# see resume_enhancer.py's grounding gate, which now also enforces this at
# inference time. Where a weak bullet already states a number, the strong
# version preserves it exactly rather than changing or amplifying it.
BULLET_PAIRS = [
    # Software engineering
    ("Worked on the backend API for the payments team.",
     "Developed the backend API for the payments team."),
    ("Responsible for fixing bugs in the mobile app.",
     "Resolved bugs in the mobile app to improve stability."),
    ("Helped build a new feature for user onboarding.",
     "Built a new feature for the user onboarding flow."),
    ("Was in charge of the database migration project.",
     "Led the database migration project."),
    ("Did code reviews for the team.",
     "Conducted code reviews to maintain code quality across the team."),
    ("Worked on improving website performance.",
     "Improved website performance through code splitting and image compression."),
    ("Helped with writing unit tests.",
     "Wrote unit tests to catch regressions before release."),
    ("Involved in deploying the application to production.",
     "Automated production deployments using a CI/CD pipeline."),
    ("Worked on the front-end using React.",
     "Developed reusable front-end components using React."),
    ("Responsible for maintaining the internal admin tool.",
     "Maintained and extended the internal admin tool used by the support team."),
    ("Helped set up monitoring for the servers.",
     "Implemented monitoring and alerting for production servers."),
    ("Worked with the team to design the system architecture.",
     "Co-designed the system architecture with the engineering team."),
    ("Did some work on the authentication system.",
     "Rebuilt the authentication system using JWT and refresh tokens."),
    ("Helped migrate the app to a new cloud provider.",
     "Migrated the production application to a new cloud provider."),
    ("Worked on integrating a third-party payment gateway.",
     "Integrated a third-party payment gateway into the checkout flow."),
    ("Fixed issues reported by users.",
     "Triaged and resolved issues reported by users."),
    ("Was responsible for the API documentation.",
     "Authored API documentation for internal engineering teams."),
    ("Helped refactor old legacy code.",
     "Refactored legacy code into modular, maintainable services."),
    ("Worked on caching to make things faster.",
     "Introduced caching to reduce average API response time."),
    ("Did testing before releases.",
     "Ran regression testing before each release to catch defects early."),
    ("Helped improve the error handling in the app.",
     "Improved error handling across the application for clearer failure diagnosis."),
    ("Worked on setting up logging for the service.",
     "Implemented structured logging for the service to speed up debugging."),
    ("Did some work rewriting the search feature.",
     "Rewrote the search feature to return more relevant results."),
    ("Helped design the database schema for the new product.",
     "Designed the database schema for the new product."),
    ("Was involved in the code freeze process before launch.",
     "Coordinated the code freeze process ahead of launch."),
    ("Worked on reducing technical debt in the codebase.",
     "Reduced technical debt by consolidating duplicated code paths."),
    ("Helped set up the local development environment for the team.",
     "Set up a standardized local development environment for the team."),
    ("Did pair programming with junior engineers.",
     "Pair-programmed with junior engineers to help them ramp up."),
    ("Worked on migrating the codebase from JavaScript to TypeScript.",
     "Migrated the codebase from JavaScript to TypeScript for stronger type safety."),
    ("Helped review pull requests for the team.",
     "Reviewed pull requests to uphold code quality standards for the team."),

    # Data / ML
    ("Worked on a machine learning model for predictions.",
     "Built a machine learning model for predictive analysis."),
    ("Helped clean and prepare data for analysis.",
     "Cleaned and prepared raw data for downstream analysis."),
    ("Did some data analysis for the marketing team.",
     "Delivered data analysis to inform the marketing team's strategy."),
    ("Worked on a dashboard to show metrics.",
     "Built a dashboard to visualize key business metrics."),
    ("Helped train a model to classify images.",
     "Trained an image classification model."),
    ("Worked on feature engineering for the model.",
     "Engineered new features to improve model performance."),
    ("Did research on different algorithms.",
     "Benchmarked multiple algorithms to select the best-performing option for production."),
    ("Helped deploy the ML model to production.",
     "Deployed a machine learning model into production."),
    ("Worked with SQL to pull reports.",
     "Wrote SQL queries to generate recurring business reports."),
    ("Did some work with NLP for text data.",
     "Applied NLP techniques to classify unstructured text data."),
    ("Helped build a data pipeline for the analytics team.",
     "Built a data pipeline to feed the analytics team's reporting."),
    ("Was responsible for validating the model's predictions.",
     "Validated model predictions against held-out test data."),
    ("Worked on tuning hyperparameters for the model.",
     "Tuned model hyperparameters to improve prediction quality."),
    ("Helped visualize the results of the analysis.",
     "Visualized analysis results to communicate findings to stakeholders."),
    ("Did some A/B testing for the recommendation system.",
     "Ran A/B tests to evaluate changes to the recommendation system."),

    # QA / Testing
    ("Was responsible for testing the application.",
     "Designed and executed test cases for the application."),
    ("Helped find bugs before release.",
     "Identified defects through exploratory testing before release."),
    ("Worked on automating manual test cases.",
     "Automated manual test cases to speed up regression testing."),
    ("Did some API testing.",
     "Built an automated test suite for the API."),
    ("Helped write test plans for new features.",
     "Wrote test plans covering new feature functionality."),
    ("Worked on setting up a test environment.",
     "Set up a dedicated test environment mirroring production."),
    ("Did bug triage for the release.",
     "Triaged and prioritized bugs ahead of the release."),
    ("Helped improve test coverage for the module.",
     "Improved test coverage for the module to catch regressions earlier."),

    # DevOps / Cloud
    ("Helped set up the CI/CD pipeline.",
     "Built a CI/CD pipeline to automate testing and deployment."),
    ("Worked on containerizing the application.",
     "Containerized the application using Docker for consistent environments."),
    ("Did some work with Kubernetes.",
     "Managed application deployments on Kubernetes."),
    ("Helped reduce cloud costs.",
     "Reduced cloud costs through resource right-sizing."),
    ("Worked on setting up infrastructure as code.",
     "Implemented infrastructure as code using Terraform."),
    ("Did some work on the deployment scripts.",
     "Wrote deployment scripts to standardize the release process."),
    ("Helped set up alerting for production incidents.",
     "Set up alerting to detect production incidents earlier."),
    ("Worked on improving the backup strategy.",
     "Improved the backup and disaster-recovery strategy for production systems."),

    # Product / Business / PM
    ("Worked with stakeholders to define requirements.",
     "Gathered requirements from stakeholders to shape the product roadmap."),
    ("Helped launch a new product feature.",
     "Led the launch of a new product feature."),
    ("Did market research for the product team.",
     "Conducted market research to inform product strategy."),
    ("Worked on improving the customer onboarding process.",
     "Redesigned the customer onboarding process to reduce friction."),
    ("Helped manage the product backlog.",
     "Managed and prioritized the product backlog."),
    ("Was responsible for writing product requirement documents.",
     "Authored product requirement documents for upcoming releases."),
    ("Worked with engineering to scope upcoming features.",
     "Partnered with engineering to scope and plan upcoming features."),
    ("Helped run user interviews for a new feature.",
     "Ran user interviews to validate a new feature concept."),
    ("Did competitive analysis for the product team.",
     "Conducted competitive analysis to inform product positioning."),
    ("Was involved in pricing discussions for the product.",
     "Contributed to pricing strategy discussions for the product."),

    # UI/UX Design
    ("Helped design the new app interface.",
     "Designed the new app interface based on user research."),
    ("Worked on wireframes for the checkout flow.",
     "Created wireframes for the checkout flow."),
    ("Did some usability testing for the redesign.",
     "Conducted usability testing to validate the redesign."),
    ("Helped build a design system for the product.",
     "Built a design system to standardize UI components across the product."),
    ("Worked on improving the accessibility of the site.",
     "Improved site accessibility to meet WCAG guidelines."),
    ("Did user research to understand pain points.",
     "Conducted user research to identify key user pain points."),
    ("Helped create prototypes in Figma.",
     "Created interactive prototypes in Figma for stakeholder review."),

    # Security
    ("Helped identify security vulnerabilities in the app.",
     "Identified security vulnerabilities in the application through code review."),
    ("Worked on penetration testing for the platform.",
     "Conducted penetration testing on the platform."),
    ("Did some work improving authentication security.",
     "Strengthened authentication security by enforcing multi-factor authentication."),
    ("Helped set up a SIEM tool for monitoring.",
     "Configured a SIEM tool to monitor for security incidents."),
    ("Was responsible for the security audit of the codebase.",
     "Led a security audit of the codebase."),

    # Generic / internship / early-career
    ("Helped the team with various tasks.",
     "Supported the team across development, testing, and documentation tasks."),
    ("Worked as an intern for three months.",
     "Completed a three-month internship contributing to production features."),
    ("Did some volunteer work organizing events.",
     "Organized campus tech events."),
    ("Helped teach a coding class to students.",
     "Taught weekly coding workshops to students."),
    ("Was part of a team project in college.",
     "Collaborated in a team to deliver a full-stack project for a college course."),
    ("Worked on improving documentation for the project.",
     "Rewrote project documentation to speed up new-developer onboarding."),
    ("Did some presentations for the team.",
     "Presented technical findings to the engineering team."),
    ("Helped mentor junior team members.",
     "Mentored junior team members on best practices."),
    ("Was involved in organizing a hackathon.",
     "Helped organize a campus hackathon."),
    ("Did research for a class project.",
     "Conducted research to support a class project's technical direction."),
    ("Worked part-time as a teaching assistant.",
     "Served as a teaching assistant, grading assignments and holding office hours."),
    ("Helped set up the club's website.",
     "Built and maintained the club's website."),
]

# (role, skills, experience_years) -> professional summary paragraph.
SUMMARY_EXAMPLES = [
    ("Software Engineer", ["Python", "Django", "SQL", "Git"], 0,
     "Final-year computer science student with hands-on experience building backend applications using Python, "
     "Django, and SQL. Strong foundation in data structures, algorithms, and collaborative software development "
     "through academic and personal projects. Eager to contribute to a fast-paced engineering team and grow as a "
     "backend developer."),
    ("Frontend Developer", ["JavaScript", "React", "CSS", "HTML"], 1,
     "Frontend developer with 1 year of experience building responsive, user-friendly web interfaces using React, "
     "JavaScript, and modern CSS. Skilled at translating design mockups into performant, accessible components. "
     "Passionate about clean UI code and continuously improving user experience."),
    ("Backend Developer", ["Java", "Spring Boot", "PostgreSQL", "REST API"], 3,
     "Backend developer with 3 years of experience designing and building REST APIs and services using Java and "
     "Spring Boot. Proven track record of optimizing database performance and delivering scalable backend systems. "
     "Comfortable working across the full backend lifecycle from design to production deployment."),
    ("Full Stack Developer", ["JavaScript", "React", "Node.js", "MongoDB"], 2,
     "Full stack developer with 2 years of experience building end-to-end web applications using React, Node.js, "
     "and MongoDB. Adept at owning features from database schema to polished UI. Known for writing maintainable "
     "code and collaborating closely with design and product teams."),
    ("Data Scientist", ["Python", "Pandas", "Machine Learning", "SQL"], 2,
     "Data scientist with 2 years of experience turning raw data into actionable insights using Python, Pandas, "
     "and machine learning. Experienced in building predictive models and communicating findings to non-technical "
     "stakeholders. Focused on delivering measurable business impact through data-driven decisions."),
    ("Machine Learning Engineer", ["Python", "TensorFlow", "PyTorch", "Machine Learning"], 4,
     "Machine learning engineer with 4 years of experience designing, training, and deploying production ML "
     "models using TensorFlow and PyTorch. Strong background in the full ML lifecycle from data pipelines to "
     "model monitoring. Passionate about building reliable, scalable AI systems."),
    ("DevOps Engineer", ["Docker", "Kubernetes", "AWS", "CI/CD"], 3,
     "DevOps engineer with 3 years of experience automating infrastructure and deployment pipelines using Docker, "
     "Kubernetes, and AWS. Skilled at improving system reliability and reducing deployment friction for "
     "engineering teams. Committed to infrastructure as code and continuous improvement."),
    ("QA Engineer", ["Selenium", "Manual Testing", "API Testing", "Test Automation"], 2,
     "QA engineer with 2 years of experience designing manual and automated test strategies using Selenium and "
     "API testing tools. Detail-oriented with a strong record of catching critical defects before release. "
     "Focused on building robust, maintainable test suites that scale with the product."),
    ("Product Manager", ["Roadmapping", "Agile", "Stakeholder Management", "Data Analysis"], 5,
     "Product manager with 5 years of experience leading cross-functional teams to deliver customer-focused "
     "products. Skilled at translating user needs and data insights into a clear, prioritized roadmap. Strong "
     "track record of shipping features that measurably improve engagement and retention."),
    ("UI/UX Designer", ["Figma", "User Research", "Prototyping", "Wireframing"], 2,
     "UI/UX designer with 2 years of experience creating user-centered designs through research, wireframing, and "
     "prototyping in Figma. Passionate about solving real user problems with clean, accessible interfaces. "
     "Comfortable collaborating closely with engineering to ship polished products."),
    ("Cloud Architect", ["AWS", "Azure", "Terraform", "System Design"], 7,
     "Cloud architect with 7 years of experience designing scalable, cost-efficient infrastructure across AWS and "
     "Azure. Proven expertise in infrastructure as code, system design, and leading cloud migrations for "
     "enterprise workloads. Focused on reliability, security, and cost optimization at scale."),
    ("Security Engineer", ["Network Security", "Penetration Testing", "SIEM", "Python"], 4,
     "Security engineer with 4 years of experience identifying and remediating vulnerabilities across network and "
     "application layers. Skilled in penetration testing, SIEM tooling, and security automation with Python. "
     "Committed to building a strong security posture without slowing down engineering velocity."),

    # Second tier per role - a different experience level and skill mix so
    # the model sees more than one example per role/vocabulary combination.
    ("Software Engineer", ["Java", "Spring Boot", "SQL", "System Design"], 5,
     "Software engineer with 5 years of experience building and scaling backend services using Java and Spring "
     "Boot. Comfortable owning systems end-to-end, from design through production support. Known for writing "
     "clean, well-tested code and mentoring junior engineers."),
    ("Frontend Developer", ["TypeScript", "React", "Redux", "Tailwind CSS"], 4,
     "Frontend developer with 4 years of experience building performant, accessible web applications using React, "
     "TypeScript, and Redux. Strong eye for UI detail and a track record of turning design specs into polished, "
     "responsive products. Enjoys collaborating closely with designers and backend engineers."),
    ("Backend Developer", ["Python", "Django", "PostgreSQL", "Docker"], 1,
     "Backend developer with 1 year of experience building REST APIs and services using Python and Django. "
     "Comfortable working with relational databases and containerized environments. Motivated to deepen expertise "
     "in scalable backend architecture."),
    ("Full Stack Developer", ["Python", "Django", "SQL", "AWS"], 6,
     "Full stack developer with 6 years of experience delivering web applications end-to-end using Python, "
     "Django, and AWS. Experienced leading small teams through the full product lifecycle, from architecture to "
     "deployment. Known for balancing pragmatic tradeoffs with long-term code health."),
    ("Data Scientist", ["Python", "Machine Learning", "Data Visualization", "Statistics"], 5,
     "Data scientist with 5 years of experience applying statistical modeling and machine learning to solve "
     "business problems. Skilled at translating ambiguous questions into rigorous analyses and clear "
     "visualizations for leadership. Comfortable owning a project from data collection through deployment."),
    ("Machine Learning Engineer", ["Python", "Machine Learning", "SQL", "Data Visualization"], 1,
     "Machine learning engineer with 1 year of experience building and evaluating machine learning models using "
     "Python. Hands-on experience with the full ML workflow from data preparation to model evaluation. Eager to "
     "grow expertise in deploying models at production scale."),
    ("DevOps Engineer", ["AWS", "Terraform", "Linux", "CI/CD"], 6,
     "DevOps engineer with 6 years of experience designing cloud infrastructure and CI/CD pipelines on AWS. "
     "Skilled in infrastructure as code with Terraform and strong Linux systems fundamentals. Focused on building "
     "resilient, observable systems that scale with the business."),
    ("QA Engineer", ["Test Automation", "API Testing", "Selenium", "Agile"], 5,
     "QA engineer with 5 years of experience leading test strategy across manual and automated testing in Agile "
     "teams. Skilled at building maintainable automation frameworks with Selenium and API testing tools. Focused "
     "on shifting quality left in the development process."),
    ("Product Manager", ["Agile", "Data Analysis", "Stakeholder Management", "Roadmapping"], 2,
     "Product manager with 2 years of experience supporting product roadmap planning and stakeholder "
     "communication in an Agile environment. Comfortable using data analysis to prioritize features and validate "
     "hypotheses. Eager to grow into owning a product area end-to-end."),
    ("UI/UX Designer", ["Wireframing", "User Research", "Prototyping", "Figma"], 5,
     "UI/UX designer with 5 years of experience leading end-to-end design work from user research through "
     "high-fidelity prototyping in Figma. Skilled at balancing user needs with business goals in cross-functional "
     "teams. Passionate about building accessible, intuitive product experiences."),
    ("Cloud Architect", ["AWS", "System Design", "Terraform", "Computer Networks"], 3,
     "Cloud architect with 3 years of experience designing cloud infrastructure on AWS, with a strong background "
     "in system design and networking fundamentals. Comfortable translating business requirements into secure, "
     "scalable architecture. Growing expertise in infrastructure as code with Terraform."),
    ("Security Engineer", ["Network Security", "Python", "Computer Networks", "SIEM"], 1,
     "Security engineer with 1 year of experience supporting network security monitoring and vulnerability "
     "assessment. Strong fundamentals in computer networks and scripting with Python for security automation. "
     "Motivated to grow into a broader application security role."),
]


def build_records():
    records = []
    for weak, strong in BULLET_PAIRS:
        records.append({"task": "bullet", "weak": weak, "strong": strong})
    for role, skills, years, summary in SUMMARY_EXAMPLES:
        records.append({"task": "summary", "role": role, "skills": skills, "experience_years": years, "summary": summary})
    return records


def main():
    records = build_records()
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "resume_enhancement")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "raw_dataset.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    bullet_count = sum(1 for r in records if r["task"] == "bullet")
    summary_count = sum(1 for r in records if r["task"] == "summary")
    print(f"Wrote {len(records)} records ({bullet_count} bullet, {summary_count} summary) -> {out_path}")


if __name__ == "__main__":
    main()
