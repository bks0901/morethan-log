import { CONFIG } from "site.config"
import { NotionAPI } from "notion-client"
import { idToUuid, uuidToId } from "notion-utils"

import getAllPageIds from "src/libs/utils/notion/getAllPageIds"
import getPageProperties from "src/libs/utils/notion/getPageProperties"
import { TPosts, TPost } from "src/types"

import type {
  Block,
  BlockMap,
  CollectionPropertySchemaMap,
  ExtendedRecordMap,
  Collection,
} from "notion-types"

/**
 * Notion API 응답의 중첩된 value 객체를 처리하기 위한 유틸리티 타입
 */
type NotionValueWrapper<T> = {
  value: T | { value: T; role?: string }
  role?: string
}

/**
 * 중첩된 value 구조에서 순수 데이터(T)만 추출하는 헬퍼 함수
 */
function unwrapValue<T>(wrapper: NotionValueWrapper<T> | any): T | null {
  if (!wrapper) return null
  return wrapper.value?.value ? wrapper.value.value : wrapper.value
}

/**
 * RecordMap의 Block 데이터를 표준 BlockMap 형식으로 정규화
 */
export function normalizeBlockMap(blockMap: Record<string, any>): BlockMap {
  const normalized: BlockMap = {}
  for (const [id, record] of Object.entries(blockMap)) {
    const value = unwrapValue<Block>(record)
    if (value) {
      normalized[id] = {
        role: record.role ?? (record as any).value?.role ?? "reader",
        value: value,
      }
    }
  }
  return normalized
}

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 * Notion Database에서 포스트 목록을 가져와 정제된 데이터 반환
 */
export const getPosts = async (): Promise<TPosts> => {
  const rawId =
    process.env["NOTION_PAGE_ID"] || (CONFIG.notionConfig.pageId as string)
  if (!rawId) throw new Error("NOTION_PAGE_ID is missing")

  const id = idToUuid(rawId)
  const api = new NotionAPI()
  const response: ExtendedRecordMap = await api.getPage(id, {
    fetchMissingBlocks: true,
  })

  /** 블록 데이터 정규화(이중 래핑 제거) */
  const block = normalizeBlockMap(response.block)

  /** 루트 메타데이터 추출 (대시 유무 모두 대응) */
  const rootId = id.includes("-") ? id : idToUuid(id)
  const rootBlock = block[rootId] || block[uuidToId(rootId)]
  const rawMetadata = rootBlock?.value

  /** 컬렉션 및 스키마(지도) 추출 */
  const collectionEntry = Object.values(response.collection || {}).find(
    (coll) => unwrapValue<Collection>(coll)?.schema
  )
  const collectionValue = unwrapValue<Collection>(collectionEntry)
  const schema = collectionValue?.schema as CollectionPropertySchemaMap

  if (!schema) {
    console.error("❌ [Fatal] Schema를 찾을 수 없습니다. DB 설정을 확인하세요.")
    return []
  }

  if (
    !rawMetadata ||
    (!collectionValue && rawMetadata.type !== "collection_view_page")
  ) {
    console.warn(`⚠️ 유효한 데이터베이스를 찾을 수 없습니다. (ID: ${id})`)
    return []
  }

  /** 페이지 ID 기반 데이터 구성 */
  const pageIds = getAllPageIds(response)
  const posts: TPost[] = []

  for (const pageId of pageIds) {
    const uuid = pageId.includes("-") ? pageId : idToUuid(pageId)
    const raw = uuidToId(uuid)

    const targetBlock = block[uuid] || block[raw]
    if (!targetBlock) continue

    const properties = await getPageProperties(pageId, block, schema)

    const post: TPost = {
      ...properties,
      id: uuid,
      createdTime: targetBlock.value.created_time
        ? new Date(targetBlock.value.created_time).toISOString()
        : new Date().toISOString(),
      fullWidth: (targetBlock.value as any)?.format?.page_full_width ?? false,
    }

    posts.push(post)
  }

  return posts.sort((a, b) => {
    const dateA = new Date(a.date?.start_date || a.createdTime).getTime()
    const dateB = new Date(b.date?.start_date || b.createdTime).getTime()
    return dateB - dateA
  })
}
