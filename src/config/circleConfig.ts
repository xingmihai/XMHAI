import type { CirclePageConfig } from "@/types/circleConfig";

// 圈子页面配置
// 聚合展示朋友们博客的最新文章
//
// 数据不再由本站构建时抓取，而是由独立仓库 circle-feed 定时抓取后发布：
//   https://github.com/xingmihai/circle-feed
// 本页在浏览器运行时读取 dataUrls，因此更新文章无需重建本站
export const circleConfig: CirclePageConfig = {
	// 页面标题，留空则使用默认标题「圈子」
	title: "",
	// 页面描述
	description: "",

	// 运行时数据源，按顺序尝试，取第一个可用的
	// 主源为自定义域名，备用走 jsDelivr CDN（自带 CORS 头，可跨域兜底）
	dataUrls: [
		"https://circle-feed.5al.top/circle.json",
		"https://cdn.jsdelivr.net/gh/xingmihai/circle-feed@main/public/circle.json",
	],

	// 是否显示评论区
	showComment: false,
};
