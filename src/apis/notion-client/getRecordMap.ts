import { NotionAPI } from "notion-client"
import { idToUuid } from "notion-utils"

export const getRecordMap = async (pageId?: string) => {
  const raw = pageId || process.env["NOTION_PAGE_ID"]
  if (!raw) throw new Error("pageId missing for getRecordMap")
  const api = new NotionAPI()

  const cleanId = raw.includes("-") ? raw : idToUuid(raw)
  return api.getPage(cleanId)
}
