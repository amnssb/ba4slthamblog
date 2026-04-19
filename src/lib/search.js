export function generateSearchIndex(posts) {
  const index = posts.map((post) => ({
    title: post.title,
    url: post.url,
    date: post.date,
    tags: post.tags,
    category: post.category,
    excerpt: post.excerpt || '',
  }));
  return JSON.stringify(index);
}
