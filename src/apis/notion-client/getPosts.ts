import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"
import { idToUuid, uuidToId } from "notion-utils"

import getAllPageIds from "src/libs/utils/notion/getAllPageIds"
import getPageProperties from "src/libs/utils/notion/getPageProperties"
import { TPosts } from "src/types"

const normalizeBlockMap = (block: any) => {
  const out: any = {}
  for (const [k, rec] of Object.entries(block || {})) {
    const r: any = rec
    // notion-client가 { value: { value: Block, role }, spaceId } 형태로 주는 경우
    const inner = r?.value?.value
    if (inner) {
      out[k] = { ...r, value: inner } // ✅ value를 Block으로 평탄화
    } else {
      out[k] = r
    }
  }
  return out
}

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 */

// TODO: react query를 사용해서 처음 불러온 뒤로는 해당데이터만 사용하도록 수정
export const getPosts = async () => {
  const rawId =
    process.env["NOTION_PAGE_ID"] || (CONFIG.notionConfig.pageId as string)

  if (!rawId) {
    throw new Error("NOTION_PAGE_ID is missing (env and config are empty)")
  }

  const id = idToUuid(rawId)

  const api = new NotionAPI()
  const response = await api.getPage(id, { fetchMissingBlocks: true })

  const block = normalizeBlockMap(response.block)
  const rawMetadata =
    block[id]?.value || (Object.values(block)[0] as any)?.value

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

  const keys = Object.keys(block || {})

  const data = []
  for (let i = 0; i < pageIds.length; i++) {
    const pageId = pageIds[i]

    const uuid = pageId.includes("-") ? pageId : idToUuid(pageId)
    const raw = uuidToId(uuid)
    const b = block?.[raw] ?? block?.[uuid] ?? block?.[pageId]

    const properties = (await getPageProperties(pageId, block, schema)) || {}

    properties.id = uuid
    const ct = b?.value?.created_time
    properties.createdTime = ct ? new Date(ct).toISOString() : null
    properties.fullWidth = (b?.value?.format as any)?.page_full_width ?? false

    // const pid = pageIds[0]
    // console.log("[dbg] block[pid] raw =", block?.[pid])
    // console.log("[dbg] block[pid] keys =", Object.keys(block?.[pid] || {}))

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
