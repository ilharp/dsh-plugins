import { getCollection, type CollectionEntry } from 'astro:content'

let postsPromise: Promise<CollectionEntry<'posts'>[]> | undefined

export const getPosts = (): Promise<CollectionEntry<'posts'>[]> => {
  postsPromise ??= getCollection('posts')
  return postsPromise
}

export const getPostsForPlugin = async (
  plugin: number,
): Promise<CollectionEntry<'posts'>[]> =>
  (await getPosts())
    .filter((entry) => entry.data.plugin === plugin)
    .sort((left, right) =>
      (right.data.publishedAt ?? '').localeCompare(left.data.publishedAt ?? ''),
    )

export const getPostBySlug = async (
  slug: string,
): Promise<CollectionEntry<'posts'> | undefined> =>
  (await getPosts()).find((entry) => entry.id === slug)
