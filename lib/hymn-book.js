'use strict'

// Hymn book extension for Antora.
//
// It reads the hymn pages (modules/ROOT/pages/hymns/*.adoc) and the Sunday
// pages (modules/ROOT/pages/sundays/*.adoc) and, before they are converted:
//
//   * adds the details box, the Lyrics / Sheet music switch, listening links
//     and a "Sung on" list to every hymn page, from its header attributes;
//   * fills in the hymn index (hymns/index.adoc), the Sunday archive
//     (sundays/index.adoc) and the "most recent Sunday" box on the home page;
//   * builds the left-hand navigation, so nav.adoc never needs editing.
//
// Adding a hymn or a Sunday is therefore just adding one .adoc file.

const HEADER_ATTR_RX = /^:([\w-]+):[ \t]*(.*)$/
const XREF_HYMN_RX = /xref:hymns\/([\w-]+)\.adoc/g
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December']

module.exports.register = function () {
  this.once('contentClassified', ({ contentCatalog }) => {
    const pages = contentCatalog.findBy({ family: 'page' })
    if (!pages.length) return
    const { component, version } = pages[0].src
    const hymns = []
    const sundays = []
    let hymnIndex, sundayIndex, home
    for (const page of pages) {
      const rel = page.src.relative
      if (rel === 'hymns/index.adoc') hymnIndex = page
      else if (rel === 'sundays/index.adoc') sundayIndex = page
      else if (rel === 'index.adoc') home = page
      else if (rel.startsWith('hymns/')) hymns.push(Object.assign({ page, slug: page.src.stem }, parse(page)))
      else if (rel.startsWith('sundays/')) sundays.push(Object.assign({ page, slug: page.src.stem }, parse(page)))
    }
    hymns.sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
    for (const s of sundays) {
      s.date = s.attrs.date || s.slug.slice(0, 10)
      s.hymnSlugs = [...new Set([...s.body.matchAll(XREF_HYMN_RX)].map((m) => m[1]))]
    }
    sundays.sort((a, b) => b.date.localeCompare(a.date))
    const hymnBySlug = new Map(hymns.map((h) => [h.slug, h]))

    for (const h of hymns) {
      h.sung = sundays.filter((s) => s.hymnSlugs.includes(h.slug))
      h.page.contents = Buffer.from(renderHymn(h))
    }
    for (const s of sundays) s.page.contents = Buffer.from(renderSunday(s, hymnBySlug))
    if (hymnIndex) replaceMarker(hymnIndex, 'HYMN-INDEX', renderHymnIndex(hymns))
    if (sundayIndex) replaceMarker(sundayIndex, 'SUNDAY-INDEX', renderSundayIndex(sundays))
    if (home) {
      replaceMarker(home, 'LATEST-SUNDAY', renderLatestSunday(sundays[0], hymnBySlug))
      replaceMarker(home, 'HYMN-COUNT', String(hymns.length))
    }

    const nav = contentCatalog.addFile({
      contents: Buffer.from(renderNav(hymns, sundays)),
      src: { component, version, module: 'ROOT', family: 'nav', relative: 'nav.adoc' },
    })
    nav.nav = { index: 0 }
  })

  // List every published page and image so the service worker (sw.js) can
  // save the whole hymn book on the phone for use without a signal.
  this.once('beforePublish', ({ siteCatalog, contentCatalog }) => {
    const urls = ['index.html']
    for (const f of contentCatalog.getFiles()) {
      if (!f.out || !['page', 'image'].includes(f.src.family)) continue
      if (f.out.path !== 'index.html') urls.push(f.out.path)
    }
    siteCatalog.addFile({
      contents: Buffer.from(JSON.stringify({ built: new Date().toISOString(), urls })),
      out: { path: 'offline-pages.json' },
    })
  })
}

// Sunday pages: the list as written, then the words of every hymn, which also
// make up the one-page printed hymn sheet (see the print styles).
function renderSunday (s, hymnBySlug) {
  const items = []
  for (const line of s.body.split('\n')) {
    const m = line.match(/^\*\s*(?:([^:\n]+?):\s*)?xref:hymns\/([\w-]+)\.adoc\[[^\]]*\]/)
    if (m && hymnBySlug.has(m[2])) items.push({ part: m[1], hymn: hymnBySlug.get(m[2]) })
  }
  if (!items.length) return s.page.contents.toString()
  const lines = items.reduce((n, i) => n + i.hymn.body.split('\n').length, 0)
  const size = lines > 160 ? 'sheet-xs' : lines > 90 ? 'sheet-sm' : 'sheet-md'
  const out = [s.header, '', '++++', '<div class="sheet-tools"></div>', '++++', '', s.body, '']
  out.push('== Words for each hymn', '')
  out.push(`[.hymn-sheet.${size}]`, '====')
  out.push(`[.sheet-heading]`, `*${s.title}*${s.attrs.occasion ? ' +\n' + s.attrs.occasion : ''}`, '')
  out.push(':hardbreaks-option:', '')
  for (const { part, hymn } of items) {
    out.push('[.sheet-hymn]', '--')
    out.push(`[.sheet-title]#${part ? part + ': ' : ''}*${hymn.title}*${hymn.attrs['hymnal-page'] ? ' (p. ' + hymn.attrs['hymnal-page'] + ')' : ''}#`, '')
    out.push(hymn.body || '_Words not yet on the site._', '--', '')
  }
  out.push(':hardbreaks-option!:', '====', '')
  return out.join('\n')
}

function parse (page) {
  const lines = page.contents.toString().replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const attrs = {}
  const header = []
  let i = 0
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (!title && line.startsWith('= ')) {
      title = line.slice(2).trim()
      header.push(line)
      continue
    }
    if (title && line.trim() === '') break
    const m = line.match(HEADER_ATTR_RX)
    if (m) attrs[m[1]] = m[2].trim()
    header.push(line)
  }
  return { title, attrs, header: header.join('\n'), body: lines.slice(i).join('\n').trim() }
}

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean)
const sortKey = (t) => t.replace(/^(the|a|an)\s+/i, '').replace(/[^\w ]/g, '').toLowerCase()
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

function niceDate (iso) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow]
  return `${day} ${d} ${MONTHS[m - 1]} ${y}`
}

function firstLine (body) {
  for (const raw of body.split('\n')) {
    const line = raw.replace(/^\*\d+\.\*\s*/, '').replace(/[_*]/g, '').trim()
    if (line && !/^(verse|refrain|chorus)\b/i.test(line) && !line.startsWith('//')) return line
  }
  return ''
}

function renderHymn (h) {
  const a = h.attrs
  const rows = [
    ['Composer', a.composer],
    ['Hymnal page', a['hymnal-page']],
    ['Key', a.key],
    ['Season', list(a.season).join(', ')],
    ['Mass part', list(a['mass-part']).join(', ')],
  ].filter(([, v]) => v)
  const sheets = list(a['sheet-music'])
  const out = [h.header, '']
  out.push('++++')
  if (rows.length) {
    out.push('<dl class="hymn-meta">')
    for (const [k, v] of rows) out.push(`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`)
    out.push('</dl>')
  }
  // The buttons are drawn by supplemental-ui/js/hymns.js, which keeps them out of the search index.
  out.push(`<div class="hymn-tools" data-sheet="${sheets.length > 0}"></div>`)
  out.push('++++', '')
  out.push('[.lyrics]', '--', h.body || '_Lyrics still to be added._', '--', '')
  if (sheets.length) {
    out.push('[.sheet-music]', '--')
    sheets.forEach((s, i) => out.push(`image::sheet-music/${s}[Sheet music for ${h.title}${sheets.length > 1 ? ', page ' + (i + 1) : ''}]`, ''))
    out.push('--', '')
  }
  out.push(':hardbreaks-option!:', '')
  out.push('== Listen', '')
  const audio = list(a.audio)
  if (audio.length) {
    out.push('++++')
    for (const f of audio) {
      out.push(`<audio class="hymn-audio" controls preload="none" src="../_attachments/audio/${encodeURI(f)}"></audio>`)
    }
    out.push('++++', '')
  }
  const videos = list(a.youtube)
  for (const v of videos) out.push(`* link:${v}[Watch on YouTube^]`)
  const q = encodeURIComponent(`${h.title} hymn`)
  out.push(`* link:https://www.youtube.com/results?search_query=${q}[${videos.length ? 'More' : 'Find'} performances on YouTube^]`, '')
  if (h.sung.length) {
    out.push('== Sung on', '')
    for (const s of h.sung) out.push(`* xref:sundays/${s.slug}.adoc[${s.title}]`)
    out.push('')
  }
  return out.join('\n')
}

function renderHymnIndex (hymns) {
  const seasons = [...new Set(hymns.flatMap((h) => list(h.attrs.season)))].sort()
  const parts = [...new Set(hymns.flatMap((h) => list(h.attrs['mass-part'])))].sort()
  const opt = (v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`
  const out = ['<div class="hymn-filter">',
    '<input type="search" id="hymn-filter-text" placeholder="Filter by title or words…" aria-label="Filter hymns">',
    '<div class="hymn-filter-selects">',
    `<select id="hymn-filter-season" aria-label="Season"><option value="">All seasons</option>${seasons.map(opt).join('')}</select>`,
    `<select id="hymn-filter-part" aria-label="Mass part"><option value="">All Mass parts</option>${parts.map(opt).join('')}</select>`,
    '</div>',
    `<p class="hymn-filter-count"><span id="hymn-filter-count">${hymns.length}</span> hymns</p>`,
    '</div>',
    '<ul class="hymn-list">']
  for (const h of hymns) {
    const words = h.body.replace(/[_*+]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
    const meta = [list(h.attrs['mass-part'])[0], h.attrs['hymnal-page'] && 'p. ' + h.attrs['hymnal-page']]
      .filter(Boolean).join(' · ')
    out.push(`<li data-season="${escapeHtml(list(h.attrs.season).join('|'))}" ` +
      `data-part="${escapeHtml(list(h.attrs['mass-part']).join('|'))}" ` +
      `data-text="${escapeHtml(h.title.toLowerCase() + ' ' + words)}">` +
      `<a href="${h.slug}.html"><span class="hymn-title">${escapeHtml(h.title)}</span>` +
      `<span class="hymn-first">${escapeHtml(firstLine(h.body))}</span>` +
      (meta ? `<span class="hymn-tags">${escapeHtml(meta)}</span>` : '') + '</a></li>')
  }
  out.push('</ul>')
  return out.join('\n')
}

function renderSundayIndex (sundays) {
  const out = []
  let year
  for (const s of sundays) {
    const y = s.date.slice(0, 4)
    if (y !== year) {
      out.push('', `== ${y}`, '')
      year = y
    }
    const occasion = s.attrs.occasion ? ` (${s.attrs.occasion})` : ''
    out.push(`* xref:sundays/${s.slug}.adoc[${s.title}]${occasion}`)
  }
  return out.join('\n')
}

function renderLatestSunday (s, hymnBySlug) {
  if (!s) return ''
  const names = s.hymnSlugs.map((slug) => hymnBySlug.get(slug)).filter(Boolean)
    .map((h) => `xref:hymns/${h.slug}.adoc[${h.title}]`)
  return [`*Most recent: xref:sundays/${s.slug}.adoc[${s.title}]*`, '', ...names.map((n) => `* ${n}`)].join('\n')
}

function renderNav (hymns, sundays) {
  const out = ['* xref:index.adoc[Home]', '* xref:hymns/index.adoc[Hymns A to Z]']
  for (const h of hymns) out.push(`** xref:hymns/${h.slug}.adoc[${h.title}]`)
  out.push('* xref:sundays/index.adoc[What we sang]')
  for (const s of sundays.slice(0, 12)) out.push(`** xref:sundays/${s.slug}.adoc[${s.title}]`)
  out.push('* xref:moate.adoc[Carmelite Church, Moate]', '* xref:about.adoc[About the Carmelites]', '* xref:adding-hymns.adoc[Adding a hymn]')
  return out.join('\n') + '\n'
}

function replaceMarker (page, name, content) {
  const text = page.contents.toString()
  const isHtml = content.trimStart().startsWith('<')
  const block = isHtml ? `++++\n${content}\n++++` : content
  page.contents = Buffer.from(text.replace(`// ${name}`, block).replace(`{${name.toLowerCase()}}`, content))
}
