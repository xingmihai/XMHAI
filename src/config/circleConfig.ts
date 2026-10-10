import type { CirclePageConfig, CircleSource } from "@/types/circleConfig";
import { friendsConfig } from "./friendsConfig";

// 圈子页面配置
// 聚合展示朋友们博客的最新文章，通过 RSS / Atom 订阅源在构建时抓取
export const circleConfig: CirclePageConfig = {
	// 页面标题，留空则使用默认标题「圈子」
	title: "",
	// 页面描述
	description: "",

	// 是否自动从友链配置中读取订阅源
	// 开启后，friendsConfig 里 enabled 为 true 且填了 rss 字段的友链会被自动纳入
	useFriendsLinks: true,

	// 是否对「未填 rss 的友链」自动探测常见订阅源路径（/rss.xml、/feed 等）
	// 关闭时只抓取明确填了 rss 地址的站点：
	//   构建更快、失败列表更干净；缺点是漏掉那些有 RSS 但你没填地址的站点
	// 建议保持 false，需要订阅哪个站就在友链里补上它的 rss 地址
	autoDiscover: false,

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
