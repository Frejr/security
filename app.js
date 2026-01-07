// Link Tree Viewer (YAML) with:
// - Expand all / Collapse all
// - Search across: link records (name/url), descriptions, and category names
// - Description-only items render as a toggle (click to expand/collapse description)
// - Matches are highlighted
//
// Expected YAML shape:
// Category:
//   Subcategory:
//     - name: Something
//       url: https://example.com      # optional
//       description: |                # optional, may be multiline or single line
//         ...
//
// Notes:
// - For project pages (GitHub Pages): keep fetch('data.yaml') relative.

let ROOT_EL = null;
let ALL_BRANCHES = []; // list of branch controllers
let ALL_LEAFS = [];    // leaf items for search/filter

fetch('data.yaml')
  .then(r => r.text())
  .then(yamlText => {
    const data = jsyaml.load(yamlText);
    const container = document.getElementById('tree');
    container.innerHTML = '';

    ALL_BRANCHES = [];
    ALL_LEAFS = [];

    ROOT_EL = renderNode(data);
    container.appendChild(ROOT_EL);

    setStats();
    wireControls();
  })
  .catch(err => {
    document.getElementById('tree').textContent = 'Błąd ładowania data.yaml: ' + err;
  });

function wireControls() {
  const q = document.getElementById('q');
  const expandAllBtn = document.getElementById('expandAll');
  const collapseAllBtn = document.getElementById('collapseAll');

  q.addEventListener('input', () => applySearch(q.value));
  expandAllBtn.addEventListener('click', () => expandAll());
  collapseAllBtn.addEventListener('click', () => collapseAll());
}

function setStats(extra = '') {
  const stats = document.getElementById('stats');
  const branches = ALL_BRANCHES.length;
  const leafs = ALL_LEAFS.length;
  stats.textContent = `${branches} kategorii, ${leafs} elementów${extra ? ' • ' + extra : ''}`;
}

function renderNode(node) {
  const ul = document.createElement('ul');

  const keys = Object.keys(node || {}).sort((a, b) => a.localeCompare(b, 'pl'));

  for (const key of keys) {
    const li = document.createElement('li');
    const val = node[key];

    if (Array.isArray(val)) {
      // category with a list of leaf items
      const header = document.createElement('div');
      header.innerHTML = `<span class="twisty"></span><span class="node">${escapeHtml(key)}</span>`;
      li.appendChild(header);

      const children = document.createElement('ul');
      children.className = 'children';

      // Build leaf items
      val.forEach(item => {
        const leafLi = document.createElement('li');

        const name = (item?.name ?? '').toString().trim();
        const url = (item?.url ?? '').toString().trim();
        const desc = (item?.description ?? '').toString(); // may be multiline or single line

        // We'll create a "title" element that is clickable in all cases.
        // - If url exists: it's an <a>
        // - If no url but description exists: it's a <a href="#"> that toggles the description block
        // - If neither: it's a <span>

        let titleEl = null;
        let descEl = null;     // optional (pre/div)
        let toggleFn = null;   // optional

        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = name || url;
          titleEl = a;

          if (name && url) {
            const urlSpan = document.createElement('span');
            urlSpan.className = 'muted';
            urlSpan.textContent = `— ${url}`;
            leafLi.appendChild(a);
            leafLi.appendChild(urlSpan);
            descEl = urlSpan; // treat as secondary text for highlighting
          } else {
            leafLi.appendChild(a);
          }
        } else if (desc && desc.trim().length > 0) {
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = name || '(opis)';
          a.addEventListener('click', (e) => {
            e.preventDefault();
            if (toggleFn) toggleFn();
          });
          titleEl = a;

          // Description block (collapsed by default)
          const pre = document.createElement('pre');
          pre.textContent = desc;
          pre.style.margin = '6px 0 0';
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.fontFamily = 'inherit';
          pre.style.color = '#ccc';
          pre.style.background = '#0b0b0b';
          pre.style.border = '1px solid #333';
          pre.style.borderRadius = '8px';
          pre.style.padding = '8px 10px';
          pre.style.display = 'none';

          const twisty = document.createElement('span');
          twisty.className = 'muted';
          twisty.style.marginLeft = '6px';
          twisty.textContent = '[+]';

          toggleFn = () => {
            const open = pre.style.display !== 'none';
            pre.style.display = open ? 'none' : 'block';
            twisty.textContent = open ? '[+]' : '[-]';
          };

          leafLi.appendChild(a);
          leafLi.appendChild(twisty);
          leafLi.appendChild(pre);

          descEl = pre;
        } else {
          const span = document.createElement('span');
          span.textContent = name || '(brak)';
          titleEl = span;
          leafLi.appendChild(span);
        }

        // Register for search/filter
        ALL_LEAFS.push({
          liEl: leafLi,
          titleEl,
          descEl,
          toggleFn,
          rawName: name,
          rawUrl: url,
          rawDesc: desc,
          // search text includes description always (requirement)
          text: `${name} ${url} ${desc}`.toLowerCase(),
          // whether description is collapsible (no url + has desc)
          hasToggleDesc: !url && !!(desc && desc.trim().length > 0)
        });

        children.appendChild(leafLi);
      });

      li.appendChild(children);

      // Treat this as a branch, so it can be collapse/expanded
      const branch = makeBranch(header, children);
      // Default: open (lists are useful visible by default)
      branch.openFn();
      ALL_BRANCHES.push(branch);

    } else if (val && typeof val === 'object') {
      // category node with subcategories
      const header = document.createElement('div');

      const twisty = document.createElement('span');
      twisty.className = 'twisty';
      twisty.textContent = '▸';

      const label = document.createElement('span');
      label.className = 'node';
      label.textContent = key;

      header.appendChild(twisty);
      header.appendChild(label);

      const children = renderNode(val);
      children.className = 'children';
      children.style.display = 'none';

      header.addEventListener('click', () => {
        const closed = children.style.display === 'none';
        children.style.display = closed ? 'block' : 'none';
        twisty.textContent = closed ? '▾' : '▸';
      });

      li.appendChild(header);
      li.appendChild(children);

      const branch = makeBranch(header, children, twisty, label);
      ALL_BRANCHES.push(branch);

    } else {
      // ignore null/scalars
      continue;
    }

    ul.appendChild(li);
  }

  return ul;
}

function makeBranch(headerEl, childrenEl, twistyEl = null, labelEl = null) {
  // For list-category branches, we generate a twisty and hook toggle
  if (!twistyEl) {
    twistyEl = headerEl.querySelector('.twisty');
    twistyEl.textContent = '▾';
    headerEl.addEventListener('click', () => {
      const closed = childrenEl.style.display === 'none';
      childrenEl.style.display = closed ? 'block' : 'none';
      twistyEl.textContent = closed ? '▾' : '▸';
    });
  }

  const isOpenFn = () => childrenEl.style.display !== 'none';
  const openFn = () => { childrenEl.style.display = 'block'; twistyEl.textContent = '▾'; };
  const closeFn = () => { childrenEl.style.display = 'none'; twistyEl.textContent = '▸'; };

  return { headerEl, childrenEl, twistyEl, labelEl, isOpenFn, openFn, closeFn };
}

function expandAll() {
  ALL_BRANCHES.forEach(b => b.openFn());
  setStats('expanded');
}

function collapseAll() {
  ALL_BRANCHES.forEach(b => b.closeFn());
  setStats('collapsed');
}

function applySearch(query) {
  const q = (query || '').trim().toLowerCase();

  // Reset leaf visibility + remove previous highlights
  ALL_LEAFS.forEach(l => {
    l.liEl.classList.remove('hidden');

    // Reset title
    if (l.titleEl) {
      if (l.titleEl.tagName === 'A' || l.titleEl.tagName === 'SPAN') {
        l.titleEl.innerHTML = escapeHtml(l.rawName || (l.rawUrl || l.titleEl.textContent));
      } else {
        l.titleEl.textContent = l.rawName || l.titleEl.textContent;
      }
    }

    // Reset secondary (url span / description pre)
    if (l.descEl) {
      // If url exists, descEl might be a span
      if (l.rawUrl && l.rawName && l.descEl.tagName !== 'PRE') {
        l.descEl.textContent = `— ${l.rawUrl}`;
      } else if (l.descEl.tagName === 'PRE') {
        l.descEl.textContent = l.rawDesc || '';
      } else {
        // e.g., url-only without urlSpan
        l.descEl.textContent = '';
      }
    }

    // If it's a togglable description leaf, collapse it when search is cleared
    if (l.hasToggleDesc && l.toggleFn && l.descEl && l.descEl.tagName === 'PRE') {
      // keep collapsed for baseline reset
      l.descEl.style.display = 'none';
      // update [+] marker if present
      const marker = l.liEl.querySelector('.muted');
      if (marker && marker.textContent === '[-]') marker.textContent = '[+]';
    }
  });

  // Reset category highlights
  ALL_BRANCHES.forEach(b => {
    const label = b.labelEl || b.headerEl.querySelector('.node');
    if (!label) return;
    // restore plain text
    label.innerHTML = escapeHtml(label.textContent);
  });

  if (!q) {
    showAllLis(ROOT_EL);
    setStats();
    return;
  }

  // 1) Match leaves
  let matchedLeafs = 0;
  ALL_LEAFS.forEach(l => {
    const ok = l.text.includes(q);
    if (!ok) {
      l.liEl.classList.add('hidden');
      return;
    }

    matchedLeafs++;

    // Highlight in title
    const titleRaw = (l.rawName || l.rawUrl || l.titleEl?.textContent || '').toString();
    if (l.titleEl) {
      l.titleEl.innerHTML = highlight(titleRaw, q);
    }

    // Highlight in URL span or description
    if (l.descEl) {
      if (l.descEl.tagName === 'PRE') {
        l.descEl.innerHTML = highlight((l.rawDesc || '').toString(), q);
        // auto-expand description leaf on match so the user sees it
        if (l.hasToggleDesc) {
          l.descEl.style.display = 'block';
          const marker = l.liEl.querySelector('.muted');
          if (marker && marker.textContent === '[+]') marker.textContent = '[-]';
        }
      } else {
        // url span
        if (l.rawUrl && l.rawName) {
          l.descEl.innerHTML = `— ${highlight(l.rawUrl, q)}`;
        } else {
          l.descEl.innerHTML = highlight((l.rawUrl || '').toString(), q);
        }
      }
    }
  });

  // 2) Match categories (branch labels)
  let matchedCats = 0;
  const matchedBranchHeaders = new Set();

  ALL_BRANCHES.forEach(b => {
    const label = b.labelEl || b.headerEl.querySelector('.node');
    if (!label) return;

    const raw = (label.textContent || '').toString();
    if (raw.toLowerCase().includes(q)) {
      matchedCats++;
      label.innerHTML = highlight(raw, q);
      matchedBranchHeaders.add(b.headerEl);
      b.openFn();
    }
  });

  // 3) Prune tree and auto-open matching paths
  pruneAndExpandWithCategoryMatches(ROOT_EL, matchedBranchHeaders);

  setStats(`linki/elementy: ${matchedLeafs}, kategorie: ${matchedCats}`);
}

function showAllLis(rootUl) {
  rootUl.querySelectorAll('li').forEach(li => li.classList.remove('hidden'));
}

function pruneAndExpandWithCategoryMatches(rootUl, matchedBranchHeaders) {
  const lis = Array.from(rootUl.children).filter(x => x.tagName === 'LI');

  lis.forEach(li => {
    const childUl = li.querySelector(':scope > ul');
    const headerDiv = li.querySelector(':scope > div');

    const headerMatched = headerDiv && matchedBranchHeaders.has(headerDiv);

    if (childUl) {
      pruneAndExpandWithCategoryMatches(childUl, matchedBranchHeaders);

      const anyVisibleChildLi = Array.from(childUl.querySelectorAll(':scope > li'))
        .some(x => !x.classList.contains('hidden'));

      if (headerMatched || anyVisibleChildLi) {
        li.classList.remove('hidden');

        // auto-open when something is visible under it or header is matched
        const twisty = headerDiv?.querySelector('.twisty');
        if (twisty) {
          childUl.style.display = 'block';
          twisty.textContent = '▾';
        }
      } else {
        li.classList.add('hidden');
      }
    } else {
      // Leaf LI: already filtered
      // nothing to do
    }
  });
}

function highlight(text, q) {
  if (!text) return '';

  // We want to highlight multiple occurrences; also handle special chars safely.
  // We'll do a simple loop on the original string while comparing lowercased.
  const src = text.toString();
  const lower = src.toLowerCase();
  const needle = q.toLowerCase();

  let out = '';
  let i = 0;
  while (true) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      out += escapeHtml(src.slice(i));
      break;
    }
    out += escapeHtml(src.slice(i, idx));
    out += `<mark>${escapeHtml(src.slice(idx, idx + needle.length))}</mark>`;
    i = idx + needle.length;
  }

  return out;
}

function escapeHtml(s) {
  return (s ?? '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

