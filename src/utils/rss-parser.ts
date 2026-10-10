// RSS / Atom 解析工具
// 这里只保留纯解析函数，不依赖 Node，也不发起任何网络请求，
// 因此同样可以在浏览器端（圈子页面的客户端脚本）中直接引入使用。

// 从 XML 片段中取出指定标签的内容（支持 CDATA）
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
		const alternate =
			/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(xml);
		if (alternate) return alternate[1].trim();
		const anyHref = /<link[^>]*href=["']([^"']+)["']/i.exec(xml);
		return anyHref ? anyHref[1].trim() : "";
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

export type ParsedFeedItem = {
	title: string;
	link: string;
	published: string;
	timestamp: number;
};

// 解析 RSS 2.0 / Atom 订阅源，返回文章列表
export function parseFeed(xml: string): ParsedFeedItem[] {
	if (!xml) return [];

	const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
	const tagName = isAtom ? "entry" : "item";
	const blockRe = new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, "gi");
	const blocks = xml.match(blockRe) || [];

	const items: ParsedFeedItem[] = [];

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
