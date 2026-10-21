// Search has no cursor. Bisect saturated time intervals; overlap boundaries deliberately.
// A crowded <=1ms interval grows maxResults instead of skipping same-time URLs.
export const PAGE_SIZE = 1000;
const MAX_RESULTS = 2147483647; // Chrome's API integer range, not a product record limit
export function newImport(now = Date.now()) {
  return {version: 1, status: 'running', startedAt: now, endTime: now + 1, ranges: [{start: 0, end: now + 1, limit: PAGE_SIZE}], page: null, offset: 0, processed: 0, unavailable: 0, batches: 0, error: null};
}
export class HistoryImporter {
  constructor(db, browser) { this.db = db; this.browser = browser; }
  async step(maxItems = 20) {
    let job = await this.db.job();
    if (!job || job.status !== 'running') return job;
    if (!job.page) {
      if (!job.ranges.length) {
        job = {...job, status: 'complete', completedAt: Date.now()}; await this.db.setJob(job); return job;
      }
      const range = job.ranges.at(-1);
      const items = await this.browser.search({text: '', startTime: range.start, endTime: range.end, maxResults: range.limit});
      if (!Array.isArray(items)) throw new Error('Chrome returned an invalid history page.');
      const rest = job.ranges.slice(0,-1);
      if (items.length >= range.limit) {
        if (range.end - range.start > 1) {
          const mid = Math.floor((range.start + range.end) / 2);
          // Oldest is processed first. All checkpoints survive worker termination.
          job = {...job, ranges: [...rest, {start: mid, end: range.end, limit: PAGE_SIZE}, {start: range.start, end: mid, limit: PAGE_SIZE}]};
        } else {
          if (range.limit === MAX_RESULTS) throw new Error('Chrome API capacity reached in a single millisecond. Coverage is incomplete; no boundary was skipped.');
          job = {...job, ranges: [...rest, {...range, limit: Math.min(MAX_RESULTS, range.limit * 2)}]};
        }
      } else {
        job = {...job, ranges: rest, page: items, offset: 0, batches: job.batches + 1};
      }
      await this.db.setJob(job);
      return job;
    }
    for (let i = 0; i < maxItems && job.offset < job.page.length; i++) {
      const item = job.page[job.offset];
      if (!item?.url) throw new Error('A history item is missing its URL. Import stopped rather than skipping it.');
      const visits = await this.browser.getVisits(item.url);
      const next = {...job, offset: job.offset + 1, processed: job.processed + 1, unavailable: job.unavailable + (visits?.length ? 0 : 1)};
      // The visit writes and position advance commit in one transaction.
      await this.db.ingest(item, visits, next); job = next;
    }
    if (job.offset === job.page.length) { job = {...job, page: null, offset: 0}; await this.db.setJob(job); }
    return job;
  }
}
