import type {
	CircleFetchResult,
	CircleItem,
	CircleSource,
} from "@/types/circleConfig";

// 从 XML 片段中取出指定标签的内容（支持 CDATA 与属性）
function pickTag(xml: string, tag: string): string {
	// 先尝试 CDATA 写法
	const cdata = new RegExp(
		`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
		"i",
	).exec(xml);
	if (cdata) return cdata[1].trim();

	const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
	return plain ? plain[1].trim() : "";
}

// Atom 的 <link> 常写作 <link href="..." />，需要单独取属性
function pickLink(xml: string, isAtom: boolean): string {
	if (isAtom) {
		// 优先取 rel="alternate" 的 link，其次取第一个带 href 的
		const alternate = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(
			xml,
		);
		if (alternate) return alternate[1].trim();
		const anyHref = /<link[^>]*href=["']([^"']+)["']/i.exec(xml);
		if (anyHref) return anyHref[1].trim();
		return "";
	}
	return pickTag(xml, "link");
}

// 反转义常见的 HTML 实体
function decodeEntities(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&");
}

// 去掉残留的 HTML 标签，只保留纯文本
function stripTags(text: string): string {
	return text.replace(/<[^>]+>/g, "");
}

function normalizeText(text: string): string {
	return decodeEntities(stripTags(text)).replace(/\s+/g, " ").trim();
}

// 把各种日期写法解析成时间戳，失败返回 0
function parseTimestamp(raw: string): number {
	if (!raw) return 0;
	const ts = Date.parse(raw);
	return Number.isNaN(ts) ? 0 : ts;
}

// 解析 RSS 2.0 / Atom 订阅源，返回文章列表
export function parseFeed(xml: string): Omit<CircleItem, "sourceName" | "sourceAvatar" | "sourceSite">[] {
	if (!xml) return [];

	const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
	const tagName = isAtom ? "entry" : "item";
	const blockRe = new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, "gi");
	const blocks = xml.match(blockRe) || [];

	const items: Omit<CircleItem, "sourceName" | "sourceAvatar" | "sourceSite">[] = [];

	for (const block of blocks) {
		const title = normalizeText(pickTag(block, "title"));
		const link = pickLink(block, isAtom);
		if (!title || !link) continue;

		// RSS 用 pubDate，Atom 用 published 或 updated
		const published =
			pickTag(block, "pubDate") ||
			pickTag(block, "published") ||
			pickTag(block, "updated") ||
			pickTag(block, "dc:date");

		items.push({
			title,
			link,
			published,
			timestamp: parseTimestamp(published),
		});
	}

	return items;
}

// 常见的订阅源路径，用于自动探测
const COMMON_FEED_PATHS = [
	"/rss.xml",
	"/atom.xml",
	"/feed",
	"/feed.xml",
	"/index.xml",
	"/rss/",
	"/feed/rss.xml",
];

// 判断内容是否像 RSS / Atom
function looksLikeFeed(text: string): boolean {
	return /<rss[\s>]/i.test(text) || /<feed[\s>]/i.test(text);
}

// 站点未配置订阅源地址时，尝试探测常见的订阅源路径
// 返回第一个能解析出文章的完整地址，找不到则返回 null
export async function discoverFeed(
	site: string,
	timeout = 5000,
): Promise<string | null> {
	const base = site.replace(/\/+$/, "");

	for (const path of COMMON_FEED_PATHS) {
		const url = base + path;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: { "User-Agent": "Mozilla/5.0 (compatible; FireflyCircle/1.0)" },
			});
			if (!res.ok) continue;
			const text = await res.text();
			if (!looksLikeFeed(text)) continue;
			if (parseFeed(text).length > 0) return url;
		} catch {
			// 单个候选失败就换下一个
		} finally {
			clearTimeout(timer);
		}
	}

	return null;
}

// 抓取指定地址并解析出文章，失败返回错误信息
async function fetchFeedUrl(
	url: string,
	timeout: number,
): Promise<{ xml: string; error?: string }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				// 部分站点对默认 UA 会返回 403
				"User-Agent": "Mozilla/5.0 (compatible; FireflyCircle/1.0)",
				Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
			},
		});

		if (!res.ok) return { xml: "", error: `HTTP ${res.status}` };
		return { xml: await res.text() };
	} catch (err) {
		const reason =
			err instanceof Error
				? err.name === "AbortError"
					? "抓取超时"
					: err.message
				: "抓取失败";
		return { xml: "", error: reason };
	} finally {
		clearTimeout(timer);
	}
}

// 把解析结果补上来源信息
function attachSource(
	items: Omit<CircleItem, "sourceName" | "sourceAvatar" | "sourceSite">[],
	source: CircleSource,
	limit: number,
): CircleItem[] {
	return items.slice(0, limit).map((item) => ({
		...item,
		sourceName: source.name,
		sourceAvatar: source.avatar,
		sourceSite: source.site,
	}));
}

// 抓取单个订阅源
// 优先使用配置的地址，抓不到再尝试自动探测常见路径
async function fetchSource(
	source: CircleSource,
	timeout: number,
	limit: number,
): Promise<CircleFetchResult> {
	const candidates: string[] = [];
	if (source.rss) candidates.push(source.rss);

	let lastError = "未配置订阅源地址";

	for (const url of candidates) {
		const { xml, error } = await fetchFeedUrl(url, timeout);
		if (error) {
			lastError = error;
			continue;
		}
		const parsed = parseFeed(xml);
		if (parsed.length > 0) {
			return { source, items: attachSource(parsed, source, limit) };
		}
		lastError = "未解析到文章";
	}

	// 直接抓取没成功，再尝试自动探测
	const discovered = await discoverFeed(source.site, Math.min(timeout, 5000));
	if (discovered) {
		const { xml, error } = await fetchFeedUrl(discovered, timeout);
		if (!error) {
			const parsed = parseFeed(xml);
			if (parsed.length > 0) {
				return { source, items: attachSource(parsed, source, limit) };
			}
		}
		return { source, items: [], error: "未解析到文章" };
	}

	return { source, items: [], error: lastError };
}

// 并发抓取所有订阅源，并按发布时间倒序汇总
export async function fetchAllSources(
	sources: CircleSource[],
	options: { timeout?: number; limitPerSource?: number; totalLimit?: number } = {},
): Promise<{ items: CircleItem[]; failures: { name: string; error: string }[] }> {
	const timeout = options.timeout ?? 8000;
	const limitPerSource = options.limitPerSource ?? 5;
	const totalLimit = options.totalLimit ?? 30;

	const results = await Promise.all(
		sources.map((source) => fetchSource(source, timeout, limitPerSource)),
	);

	const all: CircleItem[] = [];
	const failures: { name: string; error: string }[] = [];

	for (const result of results) {
		all.push(...result.items);
		if (result.error) {
			failures.push({ name: result.source.name, error: result.error });
		}
	}

	// 按时间倒序；时间戳相同的（例如解析失败）保持原有顺序
	all.sort((a, b) => b.timestamp - a.timestamp);

	return { items: all.slice(0, totalLimit), failures };
}
