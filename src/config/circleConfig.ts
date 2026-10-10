import type { CirclePageConfig, CircleSource } from "@/types/circleConfig";
import { friendsConfig } from "./friendsConfig";

// 圈子页面配置
// 在访客浏览器中实时抓取朋友们的 RSS / Atom，因此内容始终是最新的，
// 不需要重新构建站点也能看到朋友们新发的文章。
export const circleConfig: CirclePageConfig = {
	// 页面标题，留空则使用默认标题「圈子」
	title: "",
	// 页面描述
	description: "",

	// 是否自动从友链配置中读取订阅源
	// 只有填了 rss 字段且 enabled 为 true 的友链会被纳入
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
	// 单个请求的超时时间（毫秒）
	timeout: 10000,

	// ──────────────────────────────────────────────
	// CORS 代理：绝大多数博客的 RSS 没有跨域头，浏览器无法直接读取，
	// 因此需要借助代理转发。下面按尝试顺序排列，前一个失败会自动换下一个。
	//
	// 空字符串 "" 表示直连（少数站点自带跨域头时可以直连成功，速度最快）
	// 建议把自己的代理放在最前面，公共代理不稳定且有速率限制。
	//
	// 自建 Cloudflare Worker 代理示例（推荐，稳定可控）：
	//   proxies: ["https://rss.5al.top/?url="]
	// ──────────────────────────────────────────────
	proxies: [
		"", // 先尝试直连
		"https://api.allorigins.win/raw?url=",
		"https://api.codetabs.com/v1/proxy?quest=",
	],

	// 结果缓存时长（分钟）。抓取需要逐个请求，缓存可避免每次进页面都重新抓。
	// 设为 0 表示不缓存，每次都重新抓取。
	cacheMinutes: 30,

	// 是否显示评论区
	showComment: false,
};

// 汇总所有启用的订阅源：友链来源 + 手动配置的来源
// 只收录显式填写了 rss 地址的站点（客户端不做路径探测，避免发出大量无效请求）
export const getEnabledCircleSources = (): CircleSource[] => {
	const sources: CircleSource[] = [];

	if (circleConfig.useFriendsLinks !== false) {
		for (const friend of friendsConfig) {
			if (!friend.enabled || !friend.rss) continue;
			sources.push({
				name: friend.title,
				avatar: friend.imgurl,
				site: friend.siteurl,
				rss: friend.rss,
				enabled: true,
			});
		}
	}

	for (const source of circleConfig.sources ?? []) {
		if (source.enabled === false || !source.rss) continue;
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
