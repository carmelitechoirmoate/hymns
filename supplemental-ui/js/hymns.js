/* Hymn book behaviour: index filters, lyrics / sheet music switch, text size. */
;(function () {
  'use strict'
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k) } catch (e) { return null } },
    set: function (k, v) { try { window.localStorage.setItem(k, v) } catch (e) {} },
  }

  function ready (fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // ---------- Offline: save the whole hymn book on this phone ----------
  // The service worker lives at the site root, next to index.html. Work out
  // where that is from this script's own address (<root>/_/js/hymns.js).
  if ('serviceWorker' in navigator) {
    var me = document.currentScript && document.currentScript.src
    var root = me && me.replace(/_\/js\/hymns\.js.*$/, '')
    if (root && /^https?:/.test(root)) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(root + 'sw.js', { scope: root }).catch(function () {})
      })
    }
  }

  // ---------- Projector: big text, one verse at a time ----------
  function openProjector () {
    var verses = Array.prototype.slice.call(document.querySelectorAll('.doc .lyrics .paragraph'))
      .map(function (p) { return p.innerHTML })
    if (!verses.length) return
    var title = (document.querySelector('.doc h1.page') || {}).textContent || ''
    var i = 0
    var el = document.createElement('div')
    el.className = 'projector'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', 'Projector: ' + title)
    el.innerHTML = '<div class="projector-top"><span class="projector-title"></span>' +
      '<span class="projector-count"></span>' +
      '<button type="button" class="projector-close" aria-label="Close">&times;</button></div>' +
      '<div class="projector-verse" aria-live="polite"></div>' +
      '<div class="projector-nav"><button type="button" data-step="-1" aria-label="Previous verse">&lsaquo;</button>' +
      '<button type="button" data-step="1" aria-label="Next verse">&rsaquo;</button></div>'
    el.querySelector('.projector-title').textContent = title
    var verse = el.querySelector('.projector-verse')
    var count = el.querySelector('.projector-count')
    function show () {
      verse.innerHTML = '<div class="projector-text">' + verses[i] + '</div>'
      count.textContent = (i + 1) + ' / ' + verses.length
      // Shrink long verses until they fit the screen
      var text = verse.firstChild
      var size = 7
      text.style.fontSize = size + 'vmin'
      while (size > 2.5 && (text.scrollHeight > verse.clientHeight || text.scrollWidth > verse.clientWidth)) {
        size -= 0.25
        text.style.fontSize = size + 'vmin'
      }
    }
    function step (n) { i = Math.max(0, Math.min(verses.length - 1, i + n)); show() }
    function close () {
      document.removeEventListener('keydown', onKey)
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {})
      el.remove()
      document.documentElement.classList.remove('is-projecting')
    }
    function onKey (e) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1) }
    }
    el.querySelector('.projector-close').addEventListener('click', close)
    el.querySelectorAll('.projector-nav button').forEach(function (b) {
      b.addEventListener('click', function () { step(parseInt(b.dataset.step, 10)) })
    })
    // Tap the right half for the next verse, the left half for the previous one
    verse.addEventListener('click', function (e) { step(e.clientX > window.innerWidth / 2 ? 1 : -1) })
    var startX = null
    el.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX }, { passive: true })
    el.addEventListener('touchend', function (e) {
      if (startX === null) return
      var dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
      startX = null
    })
    document.addEventListener('keydown', onKey)
    document.body.appendChild(el)
    document.documentElement.classList.add('is-projecting')
    if (el.requestFullscreen) el.requestFullscreen().catch(function () {})
    show()
    window.addEventListener('resize', function () { if (el.isConnected) show() })
  }

  ready(function () {
    var tools = document.querySelector('.hymn-tools')
    if (tools) {
      tools.innerHTML = (tools.dataset.sheet === 'true'
        ? '<div class="view-switch" role="group" aria-label="Show">' +
          '<button type="button" data-view="lyrics" aria-pressed="true">Lyrics</button>' +
          '<button type="button" data-view="sheet" aria-pressed="false">Sheet music</button></div>'
        : '') +
        '<div class="text-size" role="group" aria-label="Text size">' +
        '<button type="button" data-size="-1" aria-label="Smaller text">A\u2212</button>' +
        '<button type="button" data-size="1" aria-label="Larger text">A+</button></div>' +
        '<button type="button" class="project-button" aria-label="Show on a screen, one verse at a time">Project</button>'
      tools.querySelector('.project-button').addEventListener('click', openProjector)
      // Keep the hymn's name in view: it appears in the pinned bar once the
      // page title has scrolled off the top.
      var h1 = document.querySelector('.doc h1.page')
      if (h1) {
        var name = document.createElement('div')
        name.className = 'tools-title'
        name.textContent = h1.textContent
        name.setAttribute('aria-hidden', 'true')
        tools.insertBefore(name, tools.firstChild)
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (entries) {
            tools.classList.toggle('show-title', !entries[0].isIntersecting)
          }, { rootMargin: '-56px 0px 0px 0px' }).observe(h1)
        }
      }
    }

    // Sunday pages: print the one-page hymn sheet
    var sheetTools = document.querySelector('.sheet-tools')
    if (sheetTools && document.querySelector('.hymn-sheet')) {
      sheetTools.innerHTML = '<button type="button" class="print-button">Print hymn sheet</button>' +
        '<span class="sheet-hint">One page with the words of every hymn below.</span>'
      sheetTools.querySelector('button').addEventListener('click', function () { window.print() })
    }
    // Text size for lyrics (remembered on this phone)
    var sizes = [1, 1.15, 1.3, 1.5, 1.75]
    var idx = parseInt(store.get('hymn-text-size') || '1', 10)
    if (!(idx >= 0 && idx < sizes.length)) idx = 1
    function applySize () { document.documentElement.style.setProperty('--lyrics-scale', sizes[idx]) }
    applySize()
    document.querySelectorAll('.text-size button').forEach(function (b) {
      b.addEventListener('click', function () {
        idx = Math.max(0, Math.min(sizes.length - 1, idx + parseInt(b.dataset.size, 10)))
        store.set('hymn-text-size', String(idx))
        applySize()
      })
    })

    // Lyrics / sheet music switch
    var buttons = document.querySelectorAll('.view-switch button')
    function show (view) {
      document.body.classList.toggle('show-sheet', view === 'sheet')
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)) })
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { show(b.dataset.view); store.set('hymn-view', b.dataset.view) })
    })
    if (buttons.length && store.get('hymn-view') === 'sheet') show('sheet')

    // Hymn index filters
    var list = document.querySelector('.hymn-list')
    if (!list) return
    var text = document.getElementById('hymn-filter-text')
    var season = document.getElementById('hymn-filter-season')
    var part = document.getElementById('hymn-filter-part')
    var count = document.getElementById('hymn-filter-count')
    var items = Array.prototype.slice.call(list.children)
    function filter () {
      var words = text.value.toLowerCase().split(/\s+/).filter(Boolean)
      var s = season.value
      var p = part.value
      var shown = 0
      items.forEach(function (li) {
        var ok = words.every(function (w) { return li.dataset.text.indexOf(w) !== -1 }) &&
          (!s || li.dataset.season.split('|').indexOf(s) !== -1) &&
          (!p || li.dataset.part.split('|').indexOf(p) !== -1)
        li.hidden = !ok
        if (ok) shown++
      })
      count.textContent = shown
    }
    text.addEventListener('input', filter)
    season.addEventListener('change', filter)
    part.addEventListener('change', filter)
  })
})()
