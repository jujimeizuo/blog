// A local search script with the help of
// [hexo-generator-search](https://github.com/PaicHyperionDev/hexo-generator-search)
// Copyright (C) 2015
// Joseph Pan <http://github.com/wzpan>
// Shuhao Mao <http://github.com/maoshuhao>
// This library is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation; either version 2.1 of the
// License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
// 02110-1301 USA
//
// Modified by:
// Pieter Robberechts <http://github.com/probberechts>

/*exported searchFunc*/
var searchFunc = function(path, searchId, contentId) {
  var input = document.getElementById(searchId);
  var results = document.getElementById(contentId);
  if (!input || !results || input.dataset.searchInitialized) return;
  input.dataset.searchInitialized = "true";

  var status = document.getElementById('search-status');
  var retry = document.getElementById('search-retry');
  var data = null;
  var loading = false;
  var timer;
  var composing = false;

  function setStatus(state) {
    if (status) status.textContent = state ? status.dataset[state] : '';
    if (retry) retry.hidden = state !== 'error';
    results.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function plainText(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, figure').forEach(function(node) { node.remove(); });
    doc.querySelectorAll('p, div, li, br, h1, h2, h3, h4, tr').forEach(function(node) {
      node.appendChild(doc.createTextNode(' '));
    });
    return doc.body.textContent.replace(/\s+/g, ' ').trim();
  }

  function highlight(node, text, pattern) {
    var offset = 0;
    text.replace(pattern, function(match, index) {
      node.appendChild(document.createTextNode(text.slice(offset, index)));
      var mark = document.createElement('em');
      mark.className = 'search-keyword';
      mark.textContent = match;
      node.appendChild(mark);
      offset = index + match.length;
      return match;
    });
    node.appendChild(document.createTextNode(text.slice(offset)));
  }

  function search() {
    if (!data || composing) return;
    results.textContent = '';
    var query = input.value.trim().toLowerCase();
    if (!query) { setStatus(''); return; }
    var keywords = Array.from(new Set(query.split(/\s+/)));
    var pattern = new RegExp(keywords.slice().sort(function(a, b) {
      return b.length - a.length;
    }).map(function(word) {
      return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|'), 'gi');
    var matches = [];
    data.forEach(function(post) {
      var titleHits = 0;
      var hits = 0;
      var first = -1;
      keywords.forEach(function(word) {
        var inTitle = post.titleLower.indexOf(word) !== -1;
        var inContent = post.contentLower.indexOf(word);
        if (inTitle) titleHits++;
        if (inTitle || inContent !== -1) hits++;
        if (inContent !== -1 && (first === -1 || inContent < first)) first = inContent;
      });
      if (hits) matches.push({ post: post, titleHits: titleHits, hits: hits, first: first });
    });
    matches.sort(function(a, b) {
      return b.titleHits - a.titleHits || b.hits - a.hits;
    });
    setStatus(matches.length ? '' : 'empty');
    if (!matches.length) return;
    var list = document.createElement('ul');
    list.className = 'search-result-list';
    matches.forEach(function(match) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'search-result-title';
      link.href = match.post.url;
      highlight(link, match.post.title, pattern);
      item.appendChild(link);
      if (match.post.content) {
        var excerpt = document.createElement('p');
        excerpt.className = 'search-result';
        var start = Math.max(0, match.first - 20);
        var end = start + 120;
        highlight(excerpt, (start ? '…' : '') + match.post.content.slice(start, end) +
          (end < match.post.content.length ? '…' : ''), pattern);
        item.appendChild(excerpt);
      }
      list.appendChild(item);
    });
    results.appendChild(list);
  }

  function load() {
    if (data || loading) return;
    loading = true;
    setStatus('loading');
    $.ajax({
      url: path,
      dataType: 'xml',
      timeout: 20000,
      success: function(xml) {
        data = Array.from(xml.querySelectorAll('entry')).map(function(entry) {
          var title = (entry.querySelector('title')?.textContent || '').trim() || 'Untitled';
          var content = plainText(entry.querySelector('content')?.textContent || '');
          var url = entry.querySelector('link')?.getAttribute('href') || '';
          try {
            var parsed = new URL(url, document.baseURI);
            if (!/^https?:$/.test(parsed.protocol)) return null;
          } catch (error) { return null; }
          return { title: title, titleLower: title.toLowerCase(), content: content,
            contentLower: content.toLowerCase(), url: url };
        }).filter(Boolean);
        loading = false;
        setStatus('');
        search();
      },
      error: function() {
        loading = false;
        setStatus('error');
      }
    });
  }

  input.addEventListener('focus', load);
  input.addEventListener('input', function() {
    clearTimeout(timer);
    if (!composing) {
      load();
      timer = setTimeout(search, 150);
    }
  });
  input.addEventListener('compositionstart', function() { composing = true; clearTimeout(timer); });
  input.addEventListener('compositionend', function() { composing = false; load(); search(); });
  if (input.form) input.form.addEventListener('submit', function(event) {
    event.preventDefault();
    clearTimeout(timer);
    load();
    search();
  });
  if (retry) retry.addEventListener('click', load);
  if (document.activeElement === input || input.value.trim()) load();
};
