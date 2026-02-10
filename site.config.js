const CONFIG = {
  // profile setting (required)
  profile: {
    name: "knit",
    image: "/knit-arbos.svg", // If you want to create your own notion avatar, check out https://notion-avatar.vercel.app
    role: "#아직 고민중 #신기함을 찾아",
    bio: "지식은 넓어져가고, 지혜는 가다듬는다..",
    email: "bks0901@gmail.com",
    linkedin: "",
    github: "bks0901",
    instagram: "",
  },
  projects: [
    {
      name: `nestjs-api-example`,
      href: "https://github.com/bks0901/nestjs-api-example",
    },
  ],
  // blog setting (required)
  blog: {
    title: "knit의 블로그",
    description: "지식은 넓어져가고, 지혜는 가다듬는다..",
    scheme: "dark", // 'light' | 'dark' | 'system'
  },

  // CONFIG configration (required)
  link: "https://knit.yirah.uk",
  since: 2026, // If leave this empty, current year will be used.
  lang: "ko-KR", // ['en-US', 'zh-CN', 'zh-HK', 'zh-TW', 'ja-JP', 'es-ES', 'ko-KR']
  ogImageGenerateURL: "/og_image.png", // The link to generate OG image, don't end with a slash

  // notion configuration (required)
  notionConfig: {
    pageId: process.env.NOTION_PAGE_ID,
  },

  // plugin configuration (optional)
  googleAnalytics: {
    enable: false,
    config: {
      measurementId: process.env.NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID || "",
    },
  },
  googleSearchConsole: {
    enable: false,
    config: {
      siteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
    },
  },
  naverSearchAdvisor: {
    enable: false,
    config: {
      siteVerification: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || "",
    },
  },
  utterances: {
    enable: false,
    config: {
      repo: process.env.NEXT_PUBLIC_UTTERANCES_REPO || "",
      "issue-term": "og:title",
      label: "💬 Utterances",
    },
  },
  cusdis: {
    enable: false,
    config: {
      host: "https://cusdis.com",
      appid: "", // Embed Code -> data-app-id value
    },
  },
  isProd: process.env.VERCEL_ENV === "production", // distinguish between development and production environment (ref: https://vercel.com/docs/environment-variables#system-environment-variables)
  revalidateTime: 21600 * 7, // revalidate time for [slug], index
}

module.exports = { CONFIG }
