// 圈子页面配置
// 用于聚合展示朋友们博客的最新文章（通过 RSS / Atom 订阅源抓取）

// 单个订阅源
export type CircleSource = {
	name: string; // 站点/作者名称
	avatar?: string; // 头像地址，留空则不显示头像
	site: string; // 站点主页地址
	rss: string; // RSS 或 Atom 订阅源地址
	enabled?: boolean; // 是否启用，默认 true
};

// 抓取到的单篇文章
export type CircleItem = {
	title: string; // 文章标题
	link: string; // 文章链接
	published: string; // 发布日期原文
	timestamp: number; // 发布日期时间戳（用于排序，解析失败为 0）
	sourceName: string; // 来源站点名称
	sourceAvatar?: string; // 来源站点头像
	sourceSite: string; // 来源站点主页
};

// 订阅源抓取结果
export type CircleFetchResult = {
	source: CircleSource; // 对应的订阅源
	items: CircleItem[]; // 抓取到的文章
	error?: string; // 抓取失败的原因，成功时为空
};

export type CirclePageConfig = {
	title?: string; // 页面标题，留空则使用默认标题
	description?: string; // 页面描述，留空则使用默认描述
	// 是否自动从友链配置中读取订阅源
	// 开启后，会把 friendsConfig 里配置了 rss 字段的友链也作为订阅源
	useFriendsLinks?: boolean;
	// 是否对未填 rss 地址的友链自动探测常见订阅源路径（/rss.xml、/feed 等）
	// 探测在服务端（GitHub Actions）完成，不受浏览器跨域限制
	autoDiscover?: boolean;
	// 手动维护的订阅源列表
	sources?: CircleSource[];
	// 每个订阅源最多取多少篇文章
	limitPerSource?: number;
	// 页面最多展示多少篇文章
	totalLimit?: number;
	// 单个订阅源的抓取超时时间（毫秒）
	timeout?: number;

	// ── 独立数据文件模式 ──
	// 由 GitHub Actions 定时抓取生成的 circle.json 访问地址
	// 页面在浏览器中读取这个文件渲染，因此无需重新构建整站
	dataUrl?: string;
	// 备用地址，前一个失败时依次尝试
	fallbackUrls?: string[];

	// 是否显示评论区，默认 false
	showComment?: boolean;
};

// 生成的 circle.json 的结构
export type CircleData = {
	updatedAt: number; // 生成时间戳（毫秒）
	updatedAtText: string; // 生成时间的可读文本（北京时间）
	sources: { name: string; site: string; avatar?: string }[]; // 参与抓取的站点
	items: CircleItem[]; // 文章列表，已按时间倒序
	failures: { name: string; error: string }[]; // 抓取失败的站点
};
