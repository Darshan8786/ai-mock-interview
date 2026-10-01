/** Site-wide computer-science backdrop: a faint circuit-board grid plus
 * slowly drifting code tokens, fixed behind the page content. Pure CSS/SVG
 * (see the `.cse-*` rules in index.css), so it is essentially free to render.
 *
 * `quiet` hides the moving tokens and keeps only the static grid - used on
 * focus pages (tests, quizzes, the proctored interview) so nothing moves in
 * the candidate's peripheral vision. */

const STUDENT_TOKENS = ["</>", "O(log n)", "git commit", "{ }", "#include", "SELECT *", "λx.x", "=>", "0x2A", "i++", "bfs()", "[ ]", "&&", "dp[i][j]", "push()", "null"];
const ADMIN_TOKENS = ["GROUP BY", "COUNT(*)", "avg(cgpa)", "</>", "JOIN", "offers++", "ORDER BY", "{ }", "WHERE", "200 OK", "cron()", "INSERT", "SUM()", "=>", "HAVING", "[ ]"];

// Fixed spots around the edges of the viewport (percentages). The middle band
// is left empty so tokens never sit behind the main content column's text.
const SPOTS: { top: number; left: number; size: number }[] = [
  { top: 8, left: 4, size: 15 }, { top: 22, left: 12, size: 13 }, { top: 40, left: 3, size: 17 },
  { top: 58, left: 10, size: 13 }, { top: 76, left: 5, size: 15 }, { top: 90, left: 14, size: 12 },
  { top: 6, left: 82, size: 14 }, { top: 18, left: 92, size: 16 }, { top: 34, left: 86, size: 13 },
  { top: 50, left: 94, size: 15 }, { top: 66, left: 84, size: 14 }, { top: 82, left: 91, size: 16 },
  { top: 94, left: 76, size: 13 }, { top: 4, left: 46, size: 12 }, { top: 96, left: 40, size: 14 },
  { top: 12, left: 64, size: 12 },
];

export function CodeBackdrop({ variant = "student", quiet = false }: { variant?: "student" | "admin"; quiet?: boolean }) {
  const tokens = variant === "admin" ? ADMIN_TOKENS : STUDENT_TOKENS;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="cse-circuit absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cse-circuit" width="120" height="120" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M0 30h34l12 12h28" />
              <path d="M120 78H86l-12-12H54" />
              <path d="M30 0v22l10 10" />
              <path d="M90 120V96l-10-10" />
              <path d="M74 42v-18h22" />
            </g>
            <g fill="currentColor">
              <circle cx="74" cy="42" r="3" />
              <circle cx="54" cy="66" r="3" />
              <circle cx="40" cy="32" r="2.5" />
              <circle cx="80" cy="86" r="2.5" />
              <circle cx="96" cy="24" r="2.5" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cse-circuit)" />
      </svg>
      {!quiet &&
        SPOTS.map((spot, i) => (
          <span
            key={i}
            className="cse-token"
            style={{
              top: `${spot.top}%`,
              left: `${spot.left}%`,
              fontSize: spot.size,
              // Varied drift so tokens never move in lockstep.
              ["--dur" as string]: `${18 + (i % 5) * 4}s`,
              ["--delay" as string]: `${-(i * 1.7)}s`,
              ["--dx" as string]: `${(i % 2 ? -1 : 1) * (8 + (i % 4) * 4)}px`,
              ["--dy" as string]: `${-(16 + (i % 3) * 10)}px`,
            }}
          >
            {tokens[i % tokens.length]}
          </span>
        ))}
    </div>
  );
}
