#!/usr/bin/env node
// 圈子数据源抓取脚本
//
// 作用：抓取所有订阅源的 RSS / Atom，生成 circle.json（输出到标准输出）
// 特点：纯 Node 实现，零依赖，不参与站点构建，由 GitHub Actions 单独定时执行
//       结果推送到 circle-data 分支，页面运行时读取，因此更新数据无需重建整站
//
// 用法：node scripts/fetch-circle.mjs > circle.json

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const UA = "Mozilla/5.0 (compatible; FireflyCircle/1.0)";
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_LIMIT_PER_SOURCE = 5;
const DEFAULT_TOTAL_LIMIT = 40;

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

// ---------------------------------------------------------------- 配置解析

// 去掉整行注释，避免被注释掉的示例配置被当成真实订阅源
// 只处理行首为 // 的行，不误伤 URL 里的 https://
function stripCommentLines(source) {
	return source
		.split("\n")
		.filter((line) => !/^\s*\/\//.test(line))
		.join("\n");
}

// 从源码中截取某个 `const xxx = [` 到配对方括号之间的内容
// 用 `[=:] [` 定位数组起点，避开 `FriendLink[]` 这类类型注解里的方括号
function sliceArraySource(source, name) {
	const start = source.indexOf(name);
	if (start < 0) return "";
	const matched = /[=:]\s*\[/.exec(source.slice(start));
	if (!matched) return "";
	const open = start + matched.index + matched[0].length - 1;

	let depth = 0;
	for (let i = open; i < source.length; i++) {
		const ch = source[i];
		if (ch === "[") depth++;
		else if (ch === "]") {
			depth--;
			if (depth === 0) return source.slice(open + 1, i);
		}
	}
	return "";
}

// 按顶层大括号切分对象块
function splitObjects(body) {
	const blocks = [];
	let depth = 0;
	let start = -1;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0 && start >= 0) {
				blocks.push(body.slice(start, i + 1));
				start = -1;
			}
		}
	}
	return blocks;
}

// 提取 `key: "value"` 形式的字段值
function pickField(block, key) {
	const re = new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "i");
	const matched = re.exec(block);
	return matched ? matched[1] : undefined;
}

function pickBoolean(block, key, fallback = true) {
	const re = new RegExp(`${key}\\s*:\\s*(true|false)`, "i");
	const matched = re.exec(block);
	return matched ? matched[1] === "true" : fallback;
}

// 读取友链配置，挑出启用的站点
function readFriendSources() {
	let source;
	try {
		source = stripCommentLines(
			readFileSync(resolve(ROOT, "src/config/friendsConfig.ts"), "utf-8"),
		);
	} catch {
		return [];
	}
	// 用 `export const friendsConfig` 作锚点，避免匹配到 import 路径里的同名字符串
	const body = sliceArraySource(source, "export const friendsConfig");
	return splitObjects(body)
		.filter((block) => pickBoolean(block, "enabled", true))
		.map((block) => ({
			name: pickField(block, "title") || "",
			avatar: pickField(block, "imgurl") || "",
			site: pickField(block, "siteurl") || "",
			rss: pickField(block, "rss") || "",
		}))
		.filter((item) => item.name && item.site);
}

// 读取圈子配置里手动维护的订阅源
function readManualSources() {
	let source;
	try {
		source = stripCommentLines(
			readFileSync(resolve(ROOT, "src/config/circleConfig.ts"), "utf-8"),
		);
	} catch {
		return [];
	}
	const body = sliceArraySource(source, "sources");
	return splitObjects(body)
		.filter((block) => pickBoolean(block, "enabled", true))
		.map((block) => ({
			name: pickField(block, "name") || "",
			avatar: pickField(block, "avatar") || "",
			site: pickField(block, "site") || "",
			rss: pickField(block, "rss") || "",
		}))
		.filter((item) => item.name && item.site);
}

// 读取超时、条数等设置
function readOptions() {
	const defaults = {
		timeout: DEFAULT_TIMEOUT,
		limitPerSource: DEFAULT_LIMIT_PER_SOURCE,
		totalLimit: DEFAULT_TOTAL_LIMIT,
		useFriendsLinks: true,
	};
	let source;
	try {
		source = readFileSync(resolve(ROOT, "src/config/circleConfig.ts"), "utf-8");
	} catch {
		return defaults;
	}
	const pickNumber = (key, fallback) => {
		const matched = new RegExp(`${key}\\s*:\\s*(\\d+)`).exec(source);
		return matched ? Number(matched[1]) : fallback;
	};
	return {
		timeout: pickNumber("timeout", DEFAULT_TIMEOUT),
		limitPerSource: pickNumber("limitPerSource", DEFAULT_LIMIT_PER_SOURCE),
		totalLimit: pickNumber("totalLimit", DEFAULT_TOTAL_LIMIT),
		useFriendsLinks: !/useFriendsLinks\s*:\s*false/.test(source),
	};
}

// ---------------------------------------------------------------- 解析与抓取

function pickTag(xml, tag) {
	const cdata = new RegExp(
		`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
		"i",
	).exec(xml);
	if (cdata) return cdata[1].trim();
	const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
	return plain ? plain[1].trim() : "";
}

function pickLink(xml, isAtom) {
	if (isAtom) {
		const alternate =
			/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(xml);
		if (alternate) return alternate[1].trim();
		const anyHref = /<link[^>]*href=["']([^"']+)["']/i.exec(xml);
		return anyHref ? anyHref[1].trim() : "";
	}
	return pickTag(xml, "link");
}

function decodeEntities(text) {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&");
}

function normalizeText(text) {
	return decodeEntities(text.replace(/<[^>]+>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

function parseTimestamp(raw) {
	if (!raw) return 0;
	const ts = Date.parse(raw);
	return Number.isNaN(ts) ? 0 : ts;
}

// 解析 RSS 2.0 / Atom
function parseFeed(xml) {
	if (!xml) return [];
	const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
	const tagName = isAtom ? "entry" : "item";
	const blocks =
		xml.match(new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, "gi")) || [];

	const items = [];
	for (const block of blocks) {
		const title = normalizeText(pickTag(block, "title"));
		const link = pickLink(block, isAtom);
		if (!title || !link) continue;
		const published =
			pickTag(block, "pubDate") ||
			pickTag(block, "published") ||
			pickTag(block, "updated") ||
			pickTag(block, "dc:date");
		items.push({ title, link, published, timestamp: parseTimestamp(published) });
	}
	return items;
}

async function fetchFeedUrl(url, timeout) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": UA,
				Accept:
					"application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
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

// 站点未配置订阅源地址时，自动探测常见路径
async function discoverFeed(site, timeout = 5000) {
	const base = site.replace(/\/+$/, "");
	for (const path of COMMON_FEED_PATHS) {
		const url = base + path;
		const { xml, error } = await fetchFeedUrl(url, timeout);
		if (error) continue;
		if (!/<rss[\s>]/i.test(xml) && !/<feed[\s>]/i.test(xml)) continue;
		if (parseFeed(xml).length > 0) return url;
	}
	return null;
}

// 抓取单个订阅源：优先用配置地址，失败则自动探测
async function fetchSource(source, timeout, limit) {
	const candidates = source.rss ? [source.rss] : [];
	let lastError = source.rss ? "抓取失败" : "未配置订阅源地址";

	for (const url of candidates) {
		const { xml, error } = await fetchFeedUrl(url, timeout);
		if (error) {
			lastError = error;
			continue;
		}
		const parsed = parseFeed(xml);
		if (parsed.length > 0) {
			return { items: parsed.slice(0, limit), feedUrl: url, error: undefined };
		}
		lastError = "未解析到文章";
	}

	const discovered = await discoverFeed(source.site, Math.min(timeout, 5000));
	if (discovered) {
		const { xml, error } = await fetchFeedUrl(discovered, timeout);
		if (!error) {
			const parsed = parseFeed(xml);
			if (parsed.length > 0) {
				return {
					items: parsed.slice(0, limit),
					feedUrl: discovered,
					error: undefined,
				};
			}
		}
		return { items: [], feedUrl: undefined, error: "已找到订阅源但解析不出文章" };
	}

	// 没配地址、又没探测到，提示得更明确一些
	return {
		items: [],
		feedUrl: undefined,
		error: source.rss ? lastError : "未探测到订阅源（可手动填写 rss 地址）",
	};
}

// ---------------------------------------------------------------- 主流程

async function main() {
	const options = readOptions();
	const manualSources = readManualSources();
	const friendSources = options.useFriendsLinks ? readFriendSources() : [];

	// 合并去重，手动配置优先
	const merged = [];
	for (const source of friendSources) {
		if (!manualSources.some((s) => s.name === source.name)) merged.push(source);
	}
	merged.push(...manualSources);

	if (merged.length === 0) {
		console.error("[circle] 没有配置任何订阅源");
		process.exit(1);
	}

	console.error(`[circle] 共 ${merged.length} 个订阅源，开始抓取…`);

	const results = await Promise.all(
		merged.map(async (source) => {
			const result = await fetchSource(
				source,
				options.timeout,
				options.limitPerSource,
			);
			console.error(
				result.error
					? `[circle] ✗ ${source.name} — ${result.error}`
					: `[circle] ✓ ${source.name} — ${result.items.length} 篇`,
			);
			return { source, ...result };
		}),
	);

	const items = [];
	const failures = [];
	const sources = [];

	for (const result of results) {
		if (result.error) {
			failures.push({ name: result.source.name, error: result.error });
		} else {
			for (const item of result.items) {
				items.push({
					title: item.title,
					link: item.link,
					published: item.published,
					timestamp: item.timestamp,
					sourceName: result.source.name,
					sourceAvatar: result.source.avatar || undefined,
					sourceSite: result.source.site,
				});
			}
		}
		sources.push({
			name: result.source.name,
			avatar: result.source.avatar || undefined,
			site: result.source.site,
			feedUrl: result.feedUrl,
			ok: !result.error,
		});
	}

	items.sort((a, b) => b.timestamp - a.timestamp);

	const payload = {
		updatedAt: new Date().toISOString(),
		sourceCount: sources.length,
		sources,
		items: items.slice(0, options.totalLimit),
		failures,
	};

	console.error(
		`[circle] 完成：${payload.items.length} 篇文章，${failures.length} 个站点失败`,
	);

	// JSON 输出到标准输出，日志走标准错误，便于重定向
	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
	console.error("[circle] 执行失败:", error);
	process.exit(1);
});
