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
        '<button type="button" data-size="1" aria-label="Larger text">A+</button></div>'
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
