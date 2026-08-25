// packages/core/src/events/content.ts
import news from '../../data/events/news.json'
import company from '../../data/events/company.json'
import personal from '../../data/events/personal.json'
import social from '../../data/events/social.json'
import story from '../../data/events/story.json'
import type { ContentBundle, EventDef } from '../types'
import { loadCards } from '../turn/cards'

export function loadEvents(): EventDef[] {
  return [...news, ...company, ...personal, ...social, ...story] as EventDef[]
}
export function loadContent(): ContentBundle {
  return { cards: loadCards(), events: loadEvents() }
}
