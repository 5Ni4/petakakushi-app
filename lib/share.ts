export const SITE_URL = 'https://petakakushi-524.r5ni4.chatgpt.site/';

export const X_SHARE_TEXT =
  'スクショの隠したいところに、クレヨンスタンプをぺたり。\nかわいく隠せる「ぺたかくし」';

// Share only the app introduction and its canonical URL, never editing data.
export const X_SHARE_URL = `https://x.com/intent/tweet?${new URLSearchParams({
  text: X_SHARE_TEXT,
  url: SITE_URL,
}).toString()}`;
