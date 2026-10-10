import type { CirclePageConfig } from "@/types/circleConfig";

// 圈子页面配置
// 聚合展示朋友们博客的最新文章
// 抓取由 .github/workflows/circle-feed.yml 定时执行，结果写入 circle-data 分支
// 页面在运行时读取 dataUrls，因此更新数据无需重建整站
export const circleConfig: CirclePageConfig = {
	// 页面标题，留空则使用默认标题「圈子」
	title: "",
	// 页面描述
	description: "",

	// 是否自动从友链配置中读取订阅源
	// 开启后，friendsConfig 里 enabled 为 true 的友链都会被自动纳入
	// 友链若填了 rss 字段则优先用该地址，未填会自动探测常见订阅源路径
	useFriendsLinks: true,

	// 手动维护的订阅源（会与友链来源合并，同名以这里为准）
	// 适合收录没有加进友链、但想订阅的博客
	sources: [
		// {
		//   name: "示例博客",
		//   avatar: "https://example.com/avatar.png",
		//   site: "https://example.com",
		//   rss: "https://example.com/rss.xml",
		//   enabled: true,
		// },
	],

	// 每个订阅源最多取多少篇文章
	limitPerSource: 5,
	// 页面最多展示多少篇文章
	totalLimit: 40,
	// 单个订阅源的抓取超时时间（毫秒），网络不好可适当调大
	timeout: 10000,

	// 运行时数据源：Actions 抓取后写入 circle-data 分支，页面运行时读取
	// 按顺序尝试，取第一个可用的，可自行增删或换成自己的 CDN
	dataUrls: [
		"https://cdn.jsdelivr.net/gh/xingmihai/XMHAI@circle-data/circle.json",
		"https://fastly.jsdelivr.net/gh/xingmihai/XMHAI@circle-data/circle.json",
		"https://raw.githubusercontent.com/xingmihai/XMHAI/circle-data/circle.json",
	],

	// 是否显示评论区
	showComment: false,
};
