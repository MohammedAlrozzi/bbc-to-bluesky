const fetch = require('node-fetch');
const { BskyAgent, AppBskyFeedPost } = require("@atproto/api");
const cheerio = require("cheerio");
const sharp = require("sharp");
const Parser = require("rss-parser");
const parser = new Parser();

const settings = [
  // {
  //   account: "alruzzi.live",
  //   password: "d7tr-ixfn-r7c6-4r3p",
  //   url: "https://feeds.bbci.co.uk/news/uk/rss.xml",
  // },
  {
    account: "alruzzi.live",
    password: "d7tr-ixfn-r7c6-4r3p",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  // ...
];

async function post(agent, item) {
  let post = {
    $type: "app.bsky.feed.post",
    text: item.title,
    createdAt: new Date().toISOString(),
  };
  const dom = await fetch(item.link)
    .then((response) => response.text())
    .then((html) => cheerio.load(html));

  let description = null;
  const description_ = dom('head > meta[property="og:description"]');
  if (description_) {
    description = description_.attr("content");
  }

  let image_url = null;
  const image_url_ = dom('head > meta[property="og:image"]');
  if (image_url_) {
    image_url = image_url_.attr("content");
  }
  const buffer = await fetch(image_url)
    .then((response) => response.arrayBuffer())
    .then((buffer) => sharp(buffer))
    .then((s) =>
      s.resize(
        s
          .resize(800, null, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 80,
            progressive: true,
          })
          .toBuffer()
      )
    );
  const image = await agent.uploadBlob(buffer, { encoding: "image/jpeg" });
  post["embed"] = {
    external: {
      uri: item.link,
      title: item.title,
      description: description,
      thumb: image.data.blob,
    },
    $type: "app.bsky.embed.external",
  };
  const res = AppBskyFeedPost.validateRecord(post);
  if (res.success) {
    console.log(post);
    await agent.post(post);
  } else {
    console.log(res.error);
  }
}

async function main() {
  for (const setting of settings) {
    const agent = new BskyAgent(setting.account, setting.password);
    const feed = await parser.parseURL(setting.url);
    for (const item of feed.items) {
      await post(agent, item);
    }
  }
}

main().catch(err => console.error(err));