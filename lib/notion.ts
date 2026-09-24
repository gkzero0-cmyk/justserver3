import { unstable_cache } from 'next/cache'
import { NotionAPI } from 'notion-client'

const notion = new NotionAPI()

export const ROOT_PAGE_ID =
  process.env.NOTION_PAGE_ID ?? '3dad57d6a55c80469f3de9730cb88975'

const getPage = async (pageId: string) => notion.getPage(pageId)

export const getNotionPage = unstable_cache(getPage, ['notion-page'], {
  revalidate: 300
})

export const notionPublicUrl = (pageId: string) =>
  `https://daisy-grouse-ac0.notion.site/${pageId.replaceAll('-', '')}`
