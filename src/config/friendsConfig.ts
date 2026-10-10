import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "笑的博客",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=548541786&s=100",
		desc: "一起分享，共同进步",
		siteurl: "https://blog.xiaow.qzz.io",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
		// RSS 订阅源地址，供圈子页面抓取该站最新文章
		rss: "https://blog.xiaow.qzz.io/rss.xml",
	},
	{
		title: "韩小韩博客",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1655466387&s=100",
		desc: "运气是计划之外的东西",
		siteurl: "https://www.vvhan.com",
		tags: ["Blog"],
		weight: 9,
		enabled: true,
		// RSS 订阅源地址，供圈子页面抓取该站最新文章
		rss: "https://www.vvhan.com/rss.xml",
	},
	{
		title: "萌国萌站广场",
		imgurl: "https://icp.gov.moe/favicon.ico",
		desc: "欢迎各位萌站长加入哦",
		siteurl: "https://icp.gov.moe/aboutus.php",
		tags: ["导航"],
		weight: 8,
		enabled: true,
	},
	{
		title: "WebTeleporter",
		imgurl: "https://webteleporter.top/favicon.ico",
		desc: "独立博客传送门",
		siteurl: "https://webteleporter.top/",
		tags: ["导航"],
		weight: 7,
		enabled: true,
	},
	{
		title: "BlogsClub",
		imgurl: "https://www.blogsclub.org/usr/themes/default/favicon.png",
		desc: "博客俱乐部",
		siteurl: "https://www.blogsclub.org/",
		tags: ["导航"],
		weight: 6,
		enabled: true,
	},
	{
		title: "博友圈",
		imgurl: "https://www.boyouquan.com/assets/favicon.ico",
		desc: "博客人的朋友圈",
		siteurl: "https://www.boyouquan.com/",
		tags: ["导航"],
		weight: 5,
		enabled: true,
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
