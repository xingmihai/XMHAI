import type { CirclePageConfig, CircleSource } from "@/types/circleConfig";
import { friendsConfig } from "./friendsConfig";

// 圈子页面配置
//
// 工作方式：GitHub Actions 定时运行 scripts/fetch-circle.ts，
// 在服务端抓取各站的 RSS / Atom（可自动探测地址），生成一个 circle.json，
// 推送到 circle-data 分支；页面在浏览器中读取这个 JSON 渲染。
//
// 好处：内容自动更新、服务端抓取无跨域限制、且不需要重新构建整站。
export const circleConfig: CirclePageConfig = {
	// 页面标题，留空则使用默认标题「圈子」
	title: "",
	// 页面描述
	description: "",

	// 是否自动从友链配置中读取订阅源
	useFriendsLinks: true,

	// 是否对「未填 rss 地址的友链」自动探测常见订阅源路径
	// 探测在服务端完成，成本很低，建议保持开启
	autoDiscover: true,

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
	// 单个订阅源的抓取超时时间（毫秒）
	timeout: 10000,

	// ── 数据文件地址 ──
	// Actions 会把 circle.json 推送到 circle-data 分支，这里通过 jsDelivr CDN 读取
	dataUrl:
		"https://cdn.jsdelivr.net/gh/xingmihai/XMHAI@circle-data/circle.json",
	// 备用地址，前一个不可用时依次尝试
	fallbackUrls: [
		"https://raw.githubusercontent.com/xingmihai/XMHAI/circle-data/circle.json",
	],

	// 是否显示评论区
	showComment: false,
};

// 汇总所有启用的订阅源：友链来源 + 手动配置的来源
export const getEnabledCircleSources = (): CircleSource[] => {
	const sources: CircleSource[] = [];

	if (circleConfig.useFriendsLinks !== false) {
		for (const friend of friendsConfig) {
			if (!friend.enabled) continue;
			// 关闭自动探测时，只收录明确填了 rss 地址的站点
			if (circleConfig.autoDiscover !== true && !friend.rss) continue;
			sources.push({
				name: friend.title,
				avatar: friend.imgurl,
				site: friend.siteurl,
				// 留空则由抓取逻辑自动探测常见订阅源路径
				rss: friend.rss ?? "",
				enabled: true,
			});
		}
	}

	for (const source of circleConfig.sources ?? []) {
		if (source.enabled === false) continue;
		if (circleConfig.autoDiscover !== true && !source.rss) continue;
		// 同名去重，手动配置的优先
		const idx = sources.findIndex((s) => s.name === source.name);
		if (idx >= 0) {
			sources[idx] = source;
		} else {
			sources.push(source);
		}
	}

	return sources;
};
