/**
 * YouTube Tutorial Search Service
 * Searches for free YouTube tutorials related to learning topics
 */

interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    description: string;
    thumbnailUrl: string;
    duration: string;
    viewCount: number;
    publishedAt: string;
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Fetch YouTube tutorials for a given topic
 * Returns top 5 most relevant free tutorials
 */
export async function fetchYouTubeTutorials(topic: string, subject: string): Promise<YouTubeVideo[]> {
    if (!YOUTUBE_API_KEY) {
        console.warn("YouTube API key not configured");
        return getDefaultTutorials(subject);
    }

    try {
        // Search for tutorials related to the subject
        const searchQuery = `${subject} tutorial free beginners learn`;
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");

        searchUrl.searchParams.append("q", searchQuery);
        searchUrl.searchParams.append("part", "snippet");
        searchUrl.searchParams.append("type", "video");
        searchUrl.searchParams.append("maxResults", "5");
        searchUrl.searchParams.append("relevanceLanguage", "en");
        searchUrl.searchParams.append("order", "relevance");
        searchUrl.searchParams.append("key", YOUTUBE_API_KEY);
        searchUrl.searchParams.append("safeSearch", "strict");

        const response = await fetch(searchUrl.toString());
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return getDefaultTutorials(subject);
        }

        // Extract video IDs for getting detailed info
        const videoIds = data.items.map((item: any) => item.id.videoId).join(",");

        // Get video statistics and details
        const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        detailsUrl.searchParams.append("id", videoIds);
        detailsUrl.searchParams.append("part", "statistics,contentDetails");
        detailsUrl.searchParams.append("key", YOUTUBE_API_KEY);

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();

        // Map the detailed data
        const videos: YouTubeVideo[] = data.items.map((item: any, index: number) => {
            const details = detailsData.items?.[index];
            return {
                id: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelName || item.snippet.channelTitle,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
                duration: details?.contentDetails?.duration || "PT0M0S",
                viewCount: parseInt(details?.statistics?.viewCount || "0"),
                publishedAt: item.snippet.publishedAt,
            };
        });

        return videos;
    } catch (error) {
        console.error("Error fetching YouTube tutorials:", error);
        return getDefaultTutorials(subject);
    }
}

/**
 * Fallback tutorials when API fails or is not configured
 */
function getDefaultTutorials(subject: string): YouTubeVideo[] {
    const subjectTutorials: Record<string, YouTubeVideo[]> = {
        dsa: [
            {
                id: "watch?v=RBSGKlAvoiM",
                title: "Data Structures and Algorithms Complete Tutorial",
                channelTitle: "CodeHelp - by Babbar",
                description: "Complete DSA course covering arrays, linked lists, trees, graphs, and more",
                thumbnailUrl: "https://i.ytimg.com/vi/RBSGKlAvoiM/hqdefault.jpg",
                duration: "PT100H",
                viewCount: 1000000,
                publishedAt: "2023-01-01T00:00:00Z",
            },
            {
                id: "watch?v=kQDxmjfkIKY",
                title: "DSA Problem Solving",
                channelTitle: "Striver",
                description: "Solve DSA problems systematically with detailed explanations",
                thumbnailUrl: "https://i.ytimg.com/vi/kQDxmjfkIKY/hqdefault.jpg",
                duration: "PT80H",
                viewCount: 800000,
                publishedAt: "2023-02-01T00:00:00Z",
            },
        ],
        dbms: [
            {
                id: "watch?v=4d5fKxsljwE",
                title: "DBMS Complete Tutorial",
                channelTitle: "CodeHelp - by Babbar",
                description: "Learn Database Management Systems from basics to advanced concepts",
                thumbnailUrl: "https://i.ytimg.com/vi/4d5fKxsljwE/hqdefault.jpg",
                duration: "PT40H",
                viewCount: 500000,
                publishedAt: "2023-01-15T00:00:00Z",
            },
            {
                id: "watch?v=WZ7I2IHJM8c",
                title: "SQL Tutorial for Beginners",
                channelTitle: "Telusko",
                description: "Complete SQL and database fundamentals",
                thumbnailUrl: "https://i.ytimg.com/vi/WZ7I2IHJM8c/hqdefault.jpg",
                duration: "PT30H",
                viewCount: 600000,
                publishedAt: "2023-03-01T00:00:00Z",
            },
        ],
        os: [
            {
                id: "watch?v=o2DWI2YWzVI",
                title: "Operating Systems Complete Course",
                channelTitle: "Gate Smashers",
                description: "Comprehensive OS course covering processes, memory management, file systems",
                thumbnailUrl: "https://i.ytimg.com/vi/o2DWI2YWzVI/hqdefault.jpg",
                duration: "PT60H",
                viewCount: 700000,
                publishedAt: "2023-02-15T00:00:00Z",
            },
        ],
        oops: [
            {
                id: "watch?v=CofZpNduA8Q",
                title: "Object Oriented Programming Complete Course",
                channelTitle: "CodeHelp - by Babbar",
                description: "Master OOP concepts with practical examples",
                thumbnailUrl: "https://i.ytimg.com/vi/CofZpNduA8Q/hqdefault.jpg",
                duration: "PT50H",
                viewCount: 650000,
                publishedAt: "2023-01-20T00:00:00Z",
            },
        ],
        javascript: [
            {
                id: "watch?v=jS4aFq5-91M",
                title: "JavaScript Mastery",
                channelTitle: "Code with Harry",
                description: "Learn JavaScript from basics to advanced concepts",
                thumbnailUrl: "https://i.ytimg.com/vi/jS4aFq5-91M/hqdefault.jpg",
                duration: "PT40H",
                viewCount: 900000,
                publishedAt: "2023-01-10T00:00:00Z",
            },
        ],
    };

    return subjectTutorials[subject.toLowerCase()] || [];
}

/**
 * Convert ISO 8601 duration to human readable format
 */
export function formatDuration(duration: string): string {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return "Unknown";

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
