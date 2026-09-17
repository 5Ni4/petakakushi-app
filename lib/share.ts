export const SITE_URL = 'https://petakakushi-app.r524.workers.dev/';
export const AUTHOR_X_HANDLE = 'R5ni4';
export const AUTHOR_X_URL = `https://x.com/${AUTHOR_X_HANDLE}`;

export const X_SHARE_TEXT =
  'スクショの隠したいところに、クレヨンスタンプをぺたり。\nかわいく隠せる「ぺたかくし」\n#ぺたかくし';

// Share only the app introduction and its canonical URL, never editing data.
export const X_SHARE_URL = `https://x.com/intent/tweet?${new URLSearchParams({
  text: X_SHARE_TEXT,
  url: SITE_URL,
}).toString()}`;
