import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CircleData } from "../src/types/circleConfig";
import { circleConfig, getEnabledCircleSources } from "../src/config/circleConfig";
import { fetchAllSources } from "../src/utils/rss-parser";

// 圈子数据抓取脚本
//
// 在服务端抓取各站的 RSS / Atom（未填地址的会自动探测），生成 circle.json。
// 由 GitHub Actions 定时调用，产物推送到 circle-data 分支，
// 页面在浏览器中读取，因此无需重新构建整站。
//
// 本地运行：pnpm run circle

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "..", "circle.json");

// 生成北京时间的可读时间文本
function formatBeijingTime(date: Date): string {
	const text = new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
	// 统一成 YYYY-MM-DD HH:mm
	return text.replace(/\//g, "-");
}

async function main() {
	const sources = getEnabledCircleSources();
	console.log(`[Circle] 待抓取站点：${sources.length} 个`);
	for (const s of sources) {
		console.log(`  - ${s.name}${s.rss ? ` (${s.rss})` : " (自动探测)"}`);
	}

	if (sources.length === 0) {
		console.warn("[Circle] 没有配置任何订阅源，跳过");
		return;
	}

	const { items, failures } = await fetchAllSources(sources, {
		timeout: circleConfig.timeout,
		limitPerSource: circleConfig.limitPerSource,
		totalLimit: circleConfig.totalLimit,
	});

	const now = new Date();
	const data: CircleData = {
		updatedAt: now.getTime(),
		updatedAtText: formatBeijingTime(now),
		sources: sources.map((s) => ({
			name: s.name,
			site: s.site,
			avatar: s.avatar,
		})),
		items,
		failures,
	};

	// 保护：本次一篇都没抓到（例如网络整体抖动）时，不覆盖已有的好数据，
	// 避免一次抽风把线上内容清空。下次成功时自然会更新。
	if (items.length === 0) {
		const hasExisting = await fs
			.access(OUTPUT_FILE)
			.then(() => true)
			.catch(() => false);
		if (hasExisting) {
			console.warn(
				"[Circle] 本次未抓到任何文章，且已存在历史数据，跳过写入以免清空",
			);
			return;
		}
	}

	await fs.writeFile(OUTPUT_FILE, JSON.stringify(data), "utf-8");

	console.log(`[Circle] 抓取完成：${items.length} 篇文章`);
	if (failures.length > 0) {
		console.log(`[Circle] 失败 ${failures.length} 个站点：`);
		for (const f of failures) {
			console.log(`  - ${f.name}：${f.error}`);
		}
	}
	console.log(`[Circle] 已写入 ${OUTPUT_FILE}`);
}

main().catch((error) => {
	console.error("[Circle] 抓取失败：", error);
	// 数据抓取失败不应让工作流中断（否则仓库会一直红叉），
	// 但保留非 0 退出码以便排查：如需忽略失败可让 workflow 加 continue-on-error
	process.exitCode = 1;
});
