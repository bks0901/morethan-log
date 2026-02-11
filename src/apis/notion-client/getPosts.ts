import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"
import { idToUuid, uuidToId } from "notion-utils"

import getAllPageIds from "src/libs/utils/notion/getAllPageIds"
import getPageProperties from "src/libs/utils/notion/getPageProperties"
import { TPosts } from "src/types"

import type { Block, BlockMap, CollectionPropertySchemaMap } from "notion-types"

export type WrappedNotionRecord<T> = {
  spaceId?: string
  value: { value: T; role?: any } | T
  role?: any
}

export type WrappedBlockMap = Record<string, WrappedNotionRecord<Block>>

export function normalizeBlockMap(block: WrappedBlockMap): BlockMap {
  const out: any = {}
  for (const [id, rec] of Object.entries(block || {})) {
    const r: any = rec
    const inner = r?.value?.value
    out[id] = inner
      ? { role: r?.value?.role ?? r?.role ?? "reader", value: inner }
      : r
  }
  return out as BlockMap
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

  console.log("--- [STRUCTURE INVESTIGATION] ---")
  console.log("1. RecordMap Keys:", Object.keys(response))
  // [block, collection, collection_view, notion_user...] 등이 나오는지 확인

  // 2. 루트 블록에서 collection_id 직접 추적
  const rootBlock = response.block[id]?.value as any
  console.log("2. Root Block Type:", rootBlock?.type)
  console.log("3. Root Block collection_id:", rootBlock?.collection_id)

  // 4. 만약 collection_id가 있는데 response.collection에 없다면?
  if (
    rootBlock?.collection_id &&
    !response.collection?.[rootBlock.collection_id]
  ) {
    console.warn(
      "⚠️ 고스트 현상: 블록엔 collection_id가 있는데, collection 맵에는 해당 데이터가 없습니다."
    )
  }

  // 5. response.collection의 실제 모습 (단 한 개만 샘플로)
  const collectionKeys = Object.keys(response.collection || {})
  if (collectionKeys.length > 0) {
    const firstId = collectionKeys[0]
    console.log(
      `4. Sample Collection (${firstId}) Structure:`,
      JSON.stringify(
        response.collection[firstId],
        (k, v) => (k === "schema" ? "[SCHEMA_EXISTS]" : v),
        2
      )
    )
  } else {
    console.error("❌ Fatal: response.collection 객체 자체가 비어있습니다.")
  }

  console.log("--- [END] ---")

  const block = normalizeBlockMap(response.block)
  const rawMetadata =
    block[id]?.value || (Object.values(block)[0] as any)?.value

  // const block = response.block
  // const rawMetadata = block[id]?.value || Object.values(block)[0].value

  const collectionId = Object.keys(response.collection || {}).find(
    (id) => response.collection[id]?.value?.schema
  )

  const collection = collectionId
    ? response.collection[collectionId].value
    : null
  const rawSchema = collection?.schema

  if (!rawSchema) {
    // 스키마가 없으면 여기서 왜 없는지 알려줍니다.
    console.error("❌ Schema is undefined. Collection ID:", collectionId)
    return []
  } else {
    // schema가 있을 때만 entries를 돌립니다.
    const simplifiedSchema = Object.entries(rawSchema || {}).map(
      ([key, value]: any) => ({
        id: key,
        name: value.name,
        type: value.type,
      })
    )
    console.table(simplifiedSchema)
  }

  const schema: CollectionPropertySchemaMap = rawSchema

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
    const pageId = pageIds[i]

    const uuid = pageId.includes("-") ? pageId : idToUuid(pageId)
    const raw = uuidToId(uuid)
    const b = block?.[raw] ?? block?.[uuid] ?? block?.[pageId]

    const properties = (await getPageProperties(pageId, block, schema)) || {}

    properties.id = uuid
    const ct = b?.value?.created_time
    properties.createdTime = ct ? new Date(ct).toISOString() : null
    properties.fullWidth = (b?.value?.format as any)?.page_full_width ?? false

    console.log("[dbg] pageId =", pageId)
    console.log("[dbg] mapped properties =", properties)

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
