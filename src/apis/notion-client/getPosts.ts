import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"
import { idToUuid } from "notion-utils"

import getAllPageIds from "src/libs/utils/notion/getAllPageIds"
import getPageProperties from "src/libs/utils/notion/getPageProperties"
import { TPosts } from "src/types"

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 */

// TODO: react query를 사용해서 처음 불러온 뒤로는 해당데이터만 사용하도록 수정
export const getPosts = async () => {
  const rawId = CONFIG.notionConfig.pageId as string
  const id = idToUuid(rawId)

  const api = new NotionAPI()
  const response = await api.getPage(id)

  const block = response.block
  const rawMetadata = block[id]?.value || Object.values(block)[0]?.value

  const collectionId = Object.keys(response.collection)[0]
  const collection = response.collection[collectionId]?.value
  const schema = collection?.schema

  if (
    !rawMetadata ||
    (!collection && rawMetadata.type !== "collection_view_page")
  ) {
    console.warn(`⚠️ 유효한 데이터베이스를 찾을 수 없습니다. (ID: ${id})`)
    return []
  }

  // Construct Data
  const pageIds = getAllPageIds(response)
  const data = []
  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i]
    const properties = (await getPageProperties(id, block, schema)) || null
    // Add fullwidth, createdtime to properties
    properties.createdTime = new Date(block[id].value?.created_time).toString()
    properties.fullWidth =
      (block[id].value?.format as any)?.page_full_width ?? false

    data.push(properties)
  }

  // Sort by date
  data.sort((a: any, b: any) => {
    const dateA: any = new Date(a?.date?.start_date || a.createdTime)
    const dateB: any = new Date(b?.date?.start_date || b.createdTime)
    return dateB - dateA
  })

  const posts = data as TPosts
  return posts
}
