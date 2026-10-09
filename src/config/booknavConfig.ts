import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "hosting",
		name: "部署与托管",
		icon: "material-symbols:cloud-outline",
		desc: "代码托管、站点部署与域名服务",
		weight: 100,
		items: [
			{
				title: "GitHub",
				url: "https://github.com",
				desc: "全球最大的代码托管平台",
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "Cloudflare",
				url: "https://www.cloudflare.com",
				desc: "CDN、Workers、R2 与域名服务",
				weight: 9,
			},
			{
				title: "Vercel",
				url: "https://vercel.com",
				desc: "前端项目托管，Git 推送即部署",
				weight: 8,
			},
			{
				title: "Netlify",
				url: "https://www.netlify.com",
				desc: "静态站点托管与 Forms / Functions",
				weight: 7,
			},
			{
				title: "EdgeOne",
				url: "https://edgeone.ai",
				desc: "腾讯云边缘安全加速平台",
				weight: 6,
			},
			{
				title: "Spaceship",
				url: "https://www.spaceship.com",
				desc: "域名注册与 DNS 管理",
				weight: 5,
			},
		],
	},
];
